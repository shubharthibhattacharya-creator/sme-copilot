import { Injectable, NotFoundException, Logger, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ReadinessService } from './readiness.service'
import { AppException } from '../../common/exceptions'
import type { ChecklistStatus, FilingType } from '@opsc/database'
import type { CreateChecklistDto } from './dto/create-checklist.dto'
import type { UpdateChecklistDto } from './dto/update-checklist.dto'
import type { UpsertTemplateDto } from './dto/upsert-template.dto'

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly readiness: ReadinessService,
  ) {}

  async listChecklists(
    companyId: string,
    query: {
      clientId?: string
      filingType?: string
      period?: string
      status?: string
      assignedUserId?: string
      page?: number
      limit?: number
    },
  ) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 50)
    const skip = (page - 1) * limit

    const where = {
      companyId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.filingType ? { filingType: query.filingType as FilingType } : {}),
      ...(query.period ? { filingPeriod: query.period } : {}),
      ...(query.status ? { status: query.status as ChecklistStatus } : {}),
      ...(query.assignedUserId ? { assignedUserId: query.assignedUserId } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.complianceChecklist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          client: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, name: true } },
        },
      }),
      this.prisma.complianceChecklist.count({ where }),
    ])

    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  async getChecklist(id: string, companyId: string) {
    const checklist = await this.prisma.complianceChecklist.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, gstin: true } },
        assignedUser: { select: { id: true, name: true } },
        documents: {
          select: {
            id: true,
            originalName: true,
            documentType: true,
            status: true,
            filingPeriod: true,
            createdAt: true,
            uploadedBy: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!checklist || checklist.companyId !== companyId) {
      throw new NotFoundException('Checklist not found')
    }
    return checklist
  }

  async createChecklist(dto: CreateChecklistDto, companyId: string) {
    return this.readiness.createChecklist(dto, companyId)
  }

  async updateChecklist(id: string, companyId: string, dto: UpdateChecklistDto, userId: string) {
    const checklist = await this.prisma.complianceChecklist.findUnique({ where: { id } })
    if (!checklist || checklist.companyId !== companyId) {
      throw new NotFoundException('Checklist not found')
    }

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

    const isFiling = dto.status === 'FILED'

    return this.prisma.complianceChecklist.update({
      where: { id },
      data: {
        ...(dto.assignedUserId !== undefined ? { assignedUserId: dto.assignedUserId } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status ? { status: dto.status as ChecklistStatus } : {}),
        ...(isFiling ? { completedAt: new Date(), filedBy: userId } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    })
  }

  async deleteChecklist(id: string, companyId: string) {
    const checklist = await this.prisma.complianceChecklist.findUnique({ where: { id } })
    if (!checklist || checklist.companyId !== companyId) {
      throw new NotFoundException('Checklist not found')
    }
    if (checklist.status === 'FILED') {
      throw new AppException(
        'CHECKLIST_FILED',
        'Filed checklists cannot be deleted.',
        'Completed filings are kept for audit purposes.',
        HttpStatus.CONFLICT,
      )
    }
    await this.prisma.complianceChecklist.delete({ where: { id } })
    return { deleted: true }
  }

  async requestMissingDocs(id: string, companyId: string, userId: string) {
    const checklist = await this.getChecklist(id, companyId)
    const missingItems = checklist.missingItems as Array<{
      documentType: string
      label: string
      required: number
      received: number
      missing: number
    }>

    if (missingItems.length === 0) return { requestsCreated: 0, whatsappSent: false }

    // Create DocumentRequest for each missing item
    let requestsCreated = 0
    for (const item of missingItems) {
      for (let i = 0; i < item.missing; i++) {
        await this.prisma.documentRequest
          .create({
            data: {
              companyId,
              clientId: checklist.clientId,
              requestedById: userId,
              requestedFromUserId: userId, // defaults to self — staff will forward to client
              documentType: item.documentType as Parameters<typeof this.prisma.documentRequest.create>[0]['data']['documentType'],
              dueDate: checklist.dueDate,
              notes: `Required for ${checklist.label}`,
            },
          })
          .catch(() => null) // non-fatal — doc type might not match enum exactly
        requestsCreated++
      }
    }

    // Try to send WhatsApp if client has phone
    let whatsappSent = false
    const client = await this.prisma.client.findUnique({
      where: { id: checklist.clientId },
      select: { phone: true, name: true },
    })

    if (client?.phone) {
      try {
        const missingList = missingItems.map((i) => `• ${i.label}`).join('\n')
        const body = `Dear ${client.name},\n\nWe need the following documents for ${checklist.label}:\n${missingList}\n\nPlease share them at your earliest convenience.\n\nThank you`
        await this.prisma.whatsAppMessage.create({
          data: {
            companyId,
            clientId: checklist.clientId,
            toPhone: client.phone,
            templateKey: 'compliance_request',
            body,
            status: 'QUEUED',
          },
        })
        whatsappSent = true
      } catch (err) {
        this.logger.warn('WhatsApp send failed for request-missing', err)
      }
    }

    return { requestsCreated, whatsappSent }
  }

  async linkDocument(checklistId: string, documentId: string, companyId: string) {
    const checklist = await this.prisma.complianceChecklist.findUnique({ where: { id: checklistId } })
    if (!checklist || checklist.companyId !== companyId) {
      throw new NotFoundException('Checklist not found')
    }

    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })
    if (!doc || doc.companyId !== companyId) {
      throw new NotFoundException('Document not found')
    }
    if (doc.status !== 'VERIFIED') {
      throw new AppException(
        'DOCUMENT_NOT_VERIFIED',
        'Only verified documents can be linked to a checklist.',
        'Verify the document first from the document drawer.',
        HttpStatus.CONFLICT,
      )
    }
    if (doc.clientId !== checklist.clientId) {
      throw new AppException(
        'DOCUMENT_CLIENT_MISMATCH',
        'This document belongs to a different client.',
        'Only documents belonging to the same client can be linked.',
        HttpStatus.BAD_REQUEST,
      )
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { checklistId: checklistId },
    })
    await this.readiness.recalculate(checklistId)

    return this.getChecklist(checklistId, companyId)
  }

  async getDashboardSummary(companyId: string) {
    const now = new Date()
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const include = {
      client: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
    }

    const [atRisk, dueSoon, overdue, inProgressAgg] = await Promise.all([
      this.prisma.complianceChecklist.findMany({
        where: {
          companyId,
          readinessScore: { lt: 50 },
          dueDate: { lte: sevenDaysLater, gte: now },
          status: { in: ['IN_PROGRESS', 'READY'] },
        },
        take: 5,
        orderBy: { dueDate: 'asc' },
        include,
      }),
      this.prisma.complianceChecklist.findMany({
        where: {
          companyId,
          dueDate: { lte: threeDaysLater, gte: now },
          status: { in: ['IN_PROGRESS', 'READY'] },
        },
        take: 5,
        orderBy: { dueDate: 'asc' },
        include,
      }),
      this.prisma.complianceChecklist.findMany({
        where: { companyId, status: 'OVERDUE' },
        take: 5,
        orderBy: { dueDate: 'asc' },
        include,
      }),
      this.prisma.complianceChecklist.aggregate({
        where: { companyId, status: 'IN_PROGRESS' },
        _count: true,
        _avg: { readinessScore: true },
      }),
    ])

    return {
      atRisk,
      dueSoon,
      overdue,
      totalInProgress: inProgressAgg._count,
      avgReadinessScore: Math.round(inProgressAgg._avg.readinessScore ?? 0),
    }
  }

  async listTemplates(companyId: string) {
    return this.prisma.filingTypeTemplate.findMany({
      where: { companyId },
      orderBy: { filingType: 'asc' },
    })
  }

  async upsertTemplate(companyId: string, dto: UpsertTemplateDto) {
    return this.prisma.filingTypeTemplate.upsert({
      where: { companyId_filingType: { companyId, filingType: dto.filingType as FilingType } },
      create: {
        companyId,
        filingType: dto.filingType as FilingType,
        label: dto.label,
        requiredDocTypes: dto.requiredDocTypes,
        minDocCounts: dto.minDocCounts ? JSON.parse(JSON.stringify(dto.minDocCounts)) : undefined,
      },
      update: {
        label: dto.label,
        requiredDocTypes: dto.requiredDocTypes,
        minDocCounts: dto.minDocCounts ? JSON.parse(JSON.stringify(dto.minDocCounts)) : undefined,
      },
    })
  }

  async updateTemplate(id: string, companyId: string, dto: Partial<UpsertTemplateDto>) {
    const template = await this.prisma.filingTypeTemplate.findUnique({ where: { id } })
    if (!template || template.companyId !== companyId) {
      throw new NotFoundException('Template not found')
    }
    return this.prisma.filingTypeTemplate.update({
      where: { id },
      data: {
        ...(dto.label ? { label: dto.label } : {}),
        ...(dto.requiredDocTypes ? { requiredDocTypes: dto.requiredDocTypes } : {}),
        ...(dto.minDocCounts !== undefined
          ? { minDocCounts: JSON.parse(JSON.stringify(dto.minDocCounts)) }
          : {}),
      },
    })
  }
}
