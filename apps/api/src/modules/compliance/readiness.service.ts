import { Injectable, Logger, HttpStatus } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { AppException } from '../../common/exceptions'
import type { FilingType, ChecklistStatus } from '@opsc/database'
import type { CreateChecklistDto } from './dto/create-checklist.dto'

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'Invoice',
  PURCHASE_ORDER: 'Purchase order',
  DELIVERY_NOTE: 'Delivery note',
  GST_RETURN: 'GST return',
  TDS_CERTIFICATE: 'TDS certificate',
  BANK_STATEMENT: 'Bank statement',
  FORM_16: 'Form 16',
  OTHER: 'Other document',
}

const FILING_TYPE_LABELS: Record<string, string> = {
  GST_MONTHLY: 'GST Return',
  GST_QUARTERLY: 'GST Return (Quarterly)',
  TDS_QUARTERLY: 'TDS Return',
  ITR_ANNUAL: 'Income Tax Return',
  CUSTOM: 'Filing',
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name)

  constructor(private readonly prisma: PrismaService) {}

  async recalculate(checklistId: string): Promise<void> {
    const checklist = await this.prisma.complianceChecklist.findUniqueOrThrow({
      where: { id: checklistId },
      include: { client: { select: { name: true } } },
    })

    const template = await this.prisma.filingTypeTemplate.findUnique({
      where: {
        companyId_filingType: {
          companyId: checklist.companyId,
          filingType: checklist.filingType,
        },
      },
    })

    const minCounts = (template?.minDocCounts ?? {}) as Record<string, number>

    // Fetch verified docs for this client+period (directly linked OR period-matched)
    const receivedDocs = await this.prisma.document.findMany({
      where: {
        companyId: checklist.companyId,
        clientId: checklist.clientId,
        status: 'VERIFIED',
        OR: [
          { checklistId: checklistId },
          // NOTE: filingPeriod on Document is "Apr 2026" style, checklist is "2026-04"
          // We match both formats via the normalized comparison below
        ],
      },
      select: { id: true, documentType: true, filingPeriod: true, checklistId: true },
    })

    // Also fetch docs whose filingPeriod matches (format-converted)
    const [year, month] = checklist.filingPeriod.split('-').map(Number)
    const periodLabel = `${MONTH_NAMES[(month ?? 1) - 1]} ${year}` // "Apr 2026"

    const periodDocs = await this.prisma.document.findMany({
      where: {
        companyId: checklist.companyId,
        clientId: checklist.clientId,
        status: 'VERIFIED',
        filingPeriod: periodLabel,
      },
      select: { id: true, documentType: true, filingPeriod: true },
    })

    // Merge — deduplicate by id
    const allDocMap = new Map<string, { id: string; documentType: string }>()
    for (const d of [...receivedDocs, ...periodDocs]) {
      allDocMap.set(d.id, d)
    }
    const allDocs = Array.from(allDocMap.values())

    const uniqueRequired = [...new Set(checklist.requiredDocTypes)]

    interface MissingItem {
      documentType: string
      label: string
      required: number
      received: number
      missing: number
    }

    const missingItems: MissingItem[] = []
    let satisfiedCount = 0

    for (const docType of uniqueRequired) {
      const requiredCount = minCounts[docType] ?? 1
      const receivedCount = allDocs.filter((d) => d.documentType === docType).length

      if (receivedCount >= requiredCount) {
        satisfiedCount++
      } else {
        missingItems.push({
          documentType: docType,
          label: DOC_TYPE_LABELS[docType] ?? docType,
          required: requiredCount,
          received: receivedCount,
          missing: requiredCount - receivedCount,
        })
      }
    }

    const readinessScore =
      uniqueRequired.length > 0
        ? Math.round((satisfiedCount / uniqueRequired.length) * 100)
        : 100

    // Status computation — never downgrade from FILED
    let status: ChecklistStatus = checklist.status
    if (status !== 'FILED') {
      if (readinessScore === 100) status = 'READY'
      else if (new Date() > checklist.dueDate) status = 'OVERDUE'
      else status = 'IN_PROGRESS'
    }

    const prevScore = checklist.readinessScore
    const prevStatus = checklist.status

    await this.prisma.complianceChecklist.update({
      where: { id: checklistId },
      data: {
        readinessScore,
        missingItems: JSON.parse(JSON.stringify(missingItems)),
        receivedDocIds: allDocs.map((d) => d.id),
        status,
      },
    })

    // Fire notifications on state transitions
    await this.maybeNotify(
      checklistId,
      checklist.companyId,
      checklist.client.name,
      checklist.label,
      prevScore,
      prevStatus,
      readinessScore,
      status,
      missingItems.length,
    )
  }

  private async maybeNotify(
    checklistId: string,
    companyId: string,
    clientName: string,
    label: string,
    prevScore: number,
    prevStatus: ChecklistStatus,
    newScore: number,
    newStatus: ChecklistStatus,
    missingCount: number,
  ): Promise<void> {
    try {
      // CHECKLIST_READY: score just became 100
      if (prevScore < 100 && newScore === 100) {
        await this.prisma.notification.create({
          data: {
            companyId,
            type: 'CHECKLIST_READY',
            title: `${clientName} — ${label} is ready to file`,
            body: 'All documents received. You can now proceed with filing.',
            entityId: checklistId,
            entityType: 'ComplianceChecklist',
          },
        })
      }

      // CHECKLIST_OVERDUE: status just became OVERDUE
      if (prevStatus !== 'OVERDUE' && newStatus === 'OVERDUE') {
        await this.prisma.notification.create({
          data: {
            companyId,
            type: 'CHECKLIST_OVERDUE',
            title: `${clientName} — ${label} is overdue`,
            body: `Deadline passed. ${missingCount} document${missingCount !== 1 ? 's' : ''} still missing.`,
            entityId: checklistId,
            entityType: 'ComplianceChecklist',
          },
        })
      }
    } catch (err) {
      this.logger.error('Failed to create compliance notification', err)
    }
  }

  async createChecklist(dto: CreateChecklistDto, companyId: string) {
    // Validate filingPeriod format
    if (!/^\d{4}-\d{2}$/.test(dto.filingPeriod)) {
      throw new AppException(
        'INVALID_PERIOD',
        'Filing period must be in YYYY-MM format (e.g. 2026-04).',
        'Use the format YYYY-MM, for example 2026-04 for April 2026.',
        HttpStatus.BAD_REQUEST,
      )
    }
    const [, monthStr] = dto.filingPeriod.split('-')
    const month = parseInt(monthStr!, 10)
    if (month < 1 || month > 12) {
      throw new AppException(
        'INVALID_PERIOD',
        'Month must be between 01 and 12.',
        'Use a valid month: 01–12.',
        HttpStatus.BAD_REQUEST,
      )
    }

    const template = await this.prisma.filingTypeTemplate.findUnique({
      where: { companyId_filingType: { companyId, filingType: dto.filingType as FilingType } },
    })

    if (!template) {
      throw new AppException(
        'FILING_TEMPLATE_NOT_FOUND',
        `No template configured for ${dto.filingType} filings.`,
        'Go to Settings → Filing Templates and configure the required documents for this filing type.',
        HttpStatus.NOT_FOUND,
      )
    }

    // Validate assignedUser belongs to company
    if (dto.assignedUserId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedUserId, companyId },
      })
      if (!assignee) {
        throw new AppException(
          'USER_NOT_IN_COMPANY',
          'The assigned user does not belong to this company.',
          'Select a user from your firm team.',
          HttpStatus.BAD_REQUEST,
        )
      }
    }

    const label = this.buildLabel(dto.filingType as FilingType, dto.filingPeriod)
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : this.calculateDueDate(dto.filingType as FilingType, dto.filingPeriod)

    const minCounts = (template.minDocCounts ?? {}) as Record<string, number>
    const missingItems = [...new Set(template.requiredDocTypes)].map((docType) => ({
      documentType: docType,
      label: DOC_TYPE_LABELS[docType] ?? docType,
      required: minCounts[docType] ?? 1,
      received: 0,
      missing: minCounts[docType] ?? 1,
    }))

    const checklist = await this.prisma.complianceChecklist.create({
      data: {
        companyId,
        clientId: dto.clientId,
        filingType: dto.filingType as FilingType,
        filingPeriod: dto.filingPeriod,
        label,
        dueDate,
        requiredDocTypes: template.requiredDocTypes,
        assignedUserId: dto.assignedUserId ?? null,
        readinessScore: 0,
        missingItems: JSON.parse(JSON.stringify(missingItems)),
      },
    })

    // Immediately scan existing verified docs
    await this.recalculate(checklist.id)

    return this.prisma.complianceChecklist.findUniqueOrThrow({
      where: { id: checklist.id },
      include: {
        client: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    })
  }

  async autoLinkDocument(documentId: string, companyId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, clientId: true, status: true, documentType: true, filingPeriod: true, createdAt: true },
    })
    if (!doc?.clientId || doc.status !== 'VERIFIED') return

    // Normalise filingPeriod to YYYY-MM
    let period: string | null = null
    if (doc.filingPeriod) {
      period = this.labelToPeriod(doc.filingPeriod)
    }
    if (!period) {
      // Infer from upload month
      const d = doc.createdAt
      period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    const checklists = await this.prisma.complianceChecklist.findMany({
      where: {
        companyId,
        clientId: doc.clientId,
        filingPeriod: period,
        status: { in: ['IN_PROGRESS', 'READY'] },
        requiredDocTypes: { has: doc.documentType },
      },
    })

    for (const checklist of checklists) {
      // Avoid duplicate linking
      await this.prisma.document.updateMany({
        where: { id: documentId, checklistId: null },
        data: { checklistId: checklist.id },
      })
      await this.recalculate(checklist.id)
    }
  }

  private labelToPeriod(label: string): string | null {
    // Convert "Apr 2026" → "2026-04"
    const match = label.match(/^([A-Za-z]+)\s+(\d{4})$/)
    if (!match) return null
    const monthIdx = MONTH_NAMES.findIndex(
      (m) => m.toLowerCase() === match[1]!.toLowerCase().slice(0, 3),
    )
    if (monthIdx === -1) return null
    return `${match[2]}-${String(monthIdx + 1).padStart(2, '0')}`
  }

  private buildLabel(filingType: FilingType, period: string): string {
    const [yearStr, monthStr] = period.split('-')
    const monthName = MONTH_NAMES[(parseInt(monthStr!, 10) || 1) - 1] ?? ''
    return `${FILING_TYPE_LABELS[filingType] ?? 'Filing'} — ${monthName} ${yearStr}`
  }

  private calculateDueDate(filingType: FilingType, period: string): Date {
    const [yearStr, monthStr] = period.split('-').map(Number)
    const year = yearStr ?? new Date().getFullYear()
    const month = monthStr ?? new Date().getMonth() + 1

    // GST due 20th of next month; TDS due last day of next month after quarter; ITR due July 31
    if (filingType === 'ITR_ANNUAL') return new Date(year, 6, 31, 23, 59, 59) // July 31
    if (filingType === 'TDS_QUARTERLY') {
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      return new Date(nextYear, nextMonth - 1 + 1, 0, 23, 59, 59) // last day of month after quarter
    }
    // Default: 20th of next month
    const dueMonth = month === 12 ? 1 : month + 1
    const dueYear = month === 12 ? year + 1 : year
    return new Date(dueYear, dueMonth - 1, 20, 23, 59, 59)
  }

  @Cron('0 7 1 * *')
  async createMonthlyChecklists(): Promise<void> {
    this.logger.log('Creating monthly compliance checklists')
    const companies = await this.prisma.company.findMany({
      where: { isActive: true },
      select: { id: true },
    })

    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    for (const company of companies) {
      try {
        const clients = await this.prisma.client.findMany({
          where: {
            companyId: company.id,
            isActive: true,
            filingTypes: { has: 'GST_MONTHLY' },
          },
          select: { id: true },
        })

        for (const client of clients) {
          const existing = await this.prisma.complianceChecklist.findUnique({
            where: {
              companyId_clientId_filingType_filingPeriod: {
                companyId: company.id,
                clientId: client.id,
                filingType: 'GST_MONTHLY',
                filingPeriod: period,
              },
            },
          })
          if (!existing) {
            await this.createChecklist(
              { clientId: client.id, filingType: 'GST_MONTHLY', filingPeriod: period },
              company.id,
            ).catch((err) => this.logger.error(`Failed to create checklist for client ${client.id}`, err))
          }
        }

        this.logger.log(`Processed ${clients.length} clients for ${period} — company ${company.id}`)
      } catch (err) {
        this.logger.error(`Monthly checklist cron failed for company ${company.id}`, err)
      }
    }
  }

  @Cron('0 9 * * *')
  async sendDueSoonNotifications(): Promise<void> {
    const now = new Date()
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const checklists = await this.prisma.complianceChecklist.findMany({
      where: {
        dueDate: { gte: now, lte: threeDaysLater },
        status: 'IN_PROGRESS',
        readinessScore: { lt: 100 },
      },
      include: { client: { select: { name: true } } },
    })

    for (const checklist of checklists) {
      // Check if we already sent a DUE_SOON notification today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const existingToday = await this.prisma.notification.findFirst({
        where: {
          companyId: checklist.companyId,
          type: 'CHECKLIST_DUE_SOON',
          entityId: checklist.id,
          createdAt: { gte: today },
        },
      })
      if (existingToday) continue

      await this.prisma.notification.create({
        data: {
          companyId: checklist.companyId,
          type: 'CHECKLIST_DUE_SOON',
          title: `${checklist.client.name} — ${checklist.label} due soon`,
          body: `Filing deadline in ${Math.ceil((checklist.dueDate.getTime() - now.getTime()) / 86400000)} days. Readiness: ${checklist.readinessScore}%.`,
          entityId: checklist.id,
          entityType: 'ComplianceChecklist',
        },
      }).catch((err) => this.logger.error('Failed to create DUE_SOON notification', err))
    }
  }
}
