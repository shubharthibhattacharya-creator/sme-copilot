import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type FilingStatus = 'FILED' | 'PENDING' | 'OVERDUE'

export interface HeatmapCell {
  status: FilingStatus
  documentId: string | null
}

export interface HeatmapClientRow {
  id: string
  name: string
  gstin: string | null
  filerType: string
  cells: HeatmapCell[]
}

export interface HeatmapResult {
  monthlySlots: string[]
  quarterlySlots: string[]
  monthly: HeatmapClientRow[]
  quarterly: HeatmapClientRow[]
}

export interface MissingItem {
  documentType: string
  label: string
  missing: number
}

export interface FilingRow {
  client: {
    id: string
    name: string
    gstin: string | null
    filerType: string
    gstDeadlineDay: number | null
    email: string | null
    phone: string | null
  }
  period: string
  deadline: string
  daysRemaining: number
  status: FilingStatus
  document: { id: string; originalName: string; filingPeriod: string | null } | null
  checklistId: string | null
  readinessScore: number
  missingItems: MissingItem[]
  consecutiveMissed: number
  lastReminderSentAt: string | null
}

export interface FilingSummaryResult {
  total: number
  filed: number
  pending: number
  overdue: number
  dueSoon: number
  atRisk: number
  lateFeeExposure: number
  lateFeePerDay: number
}

export interface BulkRequestResult {
  requested: number
  whatsappSent: number
  skipped: number
  errors: string[]
}

export interface BulkNudgeResult {
  sent: number
  failed: number
  errors: string[]
}

export interface BulkMarkFiledResult {
  marked: number
  errors: string[]
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function computeDeadline(
  filerType: string,
  gstDeadlineDay: number,
  today: Date,
): { period: string; deadline: Date } {
  const year = today.getFullYear()
  const month = today.getMonth()

  if (filerType === 'QUARTERLY') {
    const quarterDeadlineMonths = [3, 6, 9, 0]
    const quarterEndLabels = ['Jan\u2013Mar', 'Apr\u2013Jun', 'Jul\u2013Sep', 'Oct\u2013Dec']
    for (let i = 0; i < 4; i++) {
      const deadlineMonth = quarterDeadlineMonths[i]!
      const deadlineYear = deadlineMonth === 0 ? year + 1 : year
      const deadline = new Date(deadlineYear, deadlineMonth, gstDeadlineDay)
      if (deadline >= today) {
        const periodLabel = quarterEndLabels[i]! + ' ' + (deadlineMonth === 0 ? year : year)
        return { period: periodLabel, deadline }
      }
    }
    const deadline = new Date(year + 1, 3, gstDeadlineDay)
    return { period: 'Jan\u2013Mar ' + (year + 1), deadline }
  }

  const thisMonthDeadline = new Date(year, month, gstDeadlineDay)
  if (today <= thisMonthDeadline) {
    const periodMonth = month === 0 ? 11 : month - 1
    const periodYear = month === 0 ? year - 1 : year
    return {
      period: `${MONTH_NAMES[periodMonth]} ${periodYear}`,
      deadline: thisMonthDeadline,
    }
  } else {
    const nextMonth = (month + 1) % 12
    const nextYear = month === 11 ? year + 1 : year
    const deadline = new Date(nextYear, nextMonth, gstDeadlineDay)
    return {
      period: `${MONTH_NAMES[month]} ${year}`,
      deadline,
    }
  }
}

@Injectable()
export class FilingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCalendar(companyId: string): Promise<FilingRow[]> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const clients = await this.prisma.client.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        gstin: true,
        filerType: true,
        gstDeadlineDay: true,
        email: true,
        phone: true,
      },
      orderBy: { name: 'asc' },
    })

    const filedDocs = await this.prisma.document.findMany({
      where: { companyId, documentType: 'GST_RETURN' as any },
      select: { id: true, clientId: true, originalName: true, filingPeriod: true },
    })
    const docsByClient: Record<string, typeof filedDocs> = {}
    for (const d of filedDocs) {
      if (d.clientId) {
        docsByClient[d.clientId] ??= []
        docsByClient[d.clientId]!.push(d)
      }
    }

    const rows: FilingRow[] = []

    for (const client of clients) {
      const deadlineDay = client.gstDeadlineDay ?? 20
      const { period, deadline } = computeDeadline(client.filerType, deadlineDay, today)
      const msRemaining = deadline.getTime() - today.getTime()
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
      const clientDocs = docsByClient[client.id] ?? []
      const matchedDoc =
        clientDocs.find((d) => d.filingPeriod?.toLowerCase() === period.toLowerCase()) ?? null

      let status: FilingStatus
      if (matchedDoc) status = 'FILED'
      else if (daysRemaining < 0) status = 'OVERDUE'
      else status = 'PENDING'

      rows.push({
        client: {
          id: client.id,
          name: client.name,
          gstin: client.gstin,
          filerType: client.filerType,
          gstDeadlineDay: client.gstDeadlineDay,
          email: client.email,
          phone: client.phone,
        },
        period,
        deadline: deadline.toISOString().split('T')[0]!,
        daysRemaining,
        status,
        document: matchedDoc
          ? {
              id: matchedDoc.id,
              originalName: matchedDoc.originalName,
              filingPeriod: matchedDoc.filingPeriod,
            }
          : null,
        checklistId: null,
        readinessScore: 0,
        missingItems: [],
        consecutiveMissed: 0,
        lastReminderSentAt: null,
      })
    }

    if (rows.length === 0) return []

    const clientIds = rows.map((r) => r.client.id)

    // ── Batch 1: current-period checklists (readiness + missing items) ────────
    const checklists = await this.prisma.complianceChecklist.findMany({
      where: {
        companyId,
        clientId: { in: clientIds },
        filingType: { in: ['GST_MONTHLY' as any, 'GST_QUARTERLY' as any] },
      },
      select: {
        id: true,
        clientId: true,
        filingPeriod: true,
        readinessScore: true,
        missingItems: true,
        status: true,
      },
    })
    for (const cl of checklists) {
      const row = rows.find((r) => r.client.id === cl.clientId)
      if (!row) continue
      const [monthStr, yearStr] = row.period.split(' ')
      const monthIdx = MONTH_NAMES.indexOf(monthStr ?? '')
      if (monthIdx === -1) continue
      const periodKey = `${yearStr}-${String(monthIdx + 1).padStart(2, '0')}`
      if (cl.filingPeriod === periodKey || cl.filingPeriod === row.period) {
        row.checklistId = cl.id
        row.readinessScore = cl.readinessScore
        row.missingItems = Array.isArray(cl.missingItems) ? (cl.missingItems as unknown as MissingItem[]) : []
      }
    }

    // ── Batch 2: last WhatsApp message per client ─────────────────────────────
    const lastReminders = await this.prisma.whatsAppMessage.findMany({
      where: { companyId, clientId: { in: clientIds } },
      select: { clientId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['clientId'],
    })
    const lastReminderMap: Record<string, string> = {}
    for (const r of lastReminders) {
      if (r.clientId) lastReminderMap[r.clientId] = r.createdAt.toISOString()
    }
    for (const row of rows) {
      row.lastReminderSentAt = lastReminderMap[row.client.id] ?? null
    }

    // ── Batch 3: historical FILED checklists for consecutiveMissed ────────────
    const last6PeriodKeys: string[] = []
    for (let i = 1; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      last6PeriodKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const historicalFiled = await this.prisma.complianceChecklist.findMany({
      where: {
        companyId,
        clientId: { in: clientIds },
        filingType: { in: ['GST_MONTHLY' as any, 'GST_QUARTERLY' as any] },
        status: 'FILED' as any,
        filingPeriod: { in: last6PeriodKeys },
      },
      select: { clientId: true, filingPeriod: true },
    })
    const historicalFiledMap: Record<string, Set<string>> = {}
    for (const cl of historicalFiled) {
      if (!cl.clientId) continue
      historicalFiledMap[cl.clientId] ??= new Set()
      historicalFiledMap[cl.clientId]!.add(cl.filingPeriod)
    }
    for (const row of rows) {
      if (row.client.filerType !== 'MONTHLY') {
        row.consecutiveMissed = 0
        continue
      }
      let missed = 0
      for (const key of last6PeriodKeys) {
        if (historicalFiledMap[row.client.id]?.has(key)) break
        missed++
      }
      row.consecutiveMissed = missed
    }

    return rows.sort((a, b) => {
      const order: Record<FilingStatus, number> = { OVERDUE: 0, PENDING: 1, FILED: 2 }
      const diff = order[a.status] - order[b.status]
      if (diff !== 0) return diff
      return a.daysRemaining - b.daysRemaining
    })
  }

  async getSummary(companyId: string): Promise<FilingSummaryResult> {
    const rows = await this.getCalendar(companyId)

    const feeConfig = await (this.prisma as any).companyConfig
      ?.findFirst?.({ where: { companyId, key: 'late_fee_rate_per_day' }, select: { value: true } })
      .catch(() => null)
    const lateFeePerDay = parseInt(feeConfig?.value ?? '50', 10) || 50
    const outstanding = rows.filter((r) => r.status !== 'FILED').length

    return {
      total: rows.length,
      filed: rows.filter((r) => r.status === 'FILED').length,
      pending: rows.filter((r) => r.status === 'PENDING').length,
      overdue: rows.filter((r) => r.status === 'OVERDUE').length,
      dueSoon: rows.filter((r) => r.status === 'PENDING' && r.daysRemaining <= 7).length,
      atRisk: rows.filter((r) => r.consecutiveMissed >= 2).length,
      lateFeeExposure: outstanding * lateFeePerDay,
      lateFeePerDay,
    }
  }

  // ── Bulk: request missing documents ──────────────────────────────────────────
  async bulkRequestDocs(
    companyId: string,
    userId: string,
    clientIds: string[],
    sendWhatsApp: boolean,
  ): Promise<BulkRequestResult> {
    const result: BulkRequestResult = { requested: 0, whatsappSent: 0, skipped: 0, errors: [] }

    const clients = await this.prisma.client.findMany({
      where: { companyId, id: { in: clientIds } },
      select: { id: true, name: true, phone: true },
    })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    for (const client of clients) {
      try {
        const existing = await this.prisma.documentRequest.findFirst({
          where: { companyId, clientId: client.id, createdAt: { gte: todayStart } },
          select: { id: true },
        })
        if (existing) {
          result.skipped++
          continue
        }

        await this.prisma.documentRequest.create({
          data: {
            companyId,
            requestedById: userId,
            requestedFromUserId: userId,
            clientId: client.id,
            documentType: 'GST_RETURN' as any,
            notes: 'Requested via GST Filing bulk action',
          },
        })
        result.requested++

        if (sendWhatsApp && client.phone) {
          await this.prisma.whatsAppMessage
            .create({
              data: {
                companyId,
                clientId: client.id,
                toPhone: client.phone,
                templateKey: 'doc_request',
                body: `Hi ${client.name}, please send your GST documents at the earliest for filing. Contact your CA firm if you have any questions.`,
                status: 'QUEUED',
              },
            })
            .catch(() => null)
          result.whatsappSent++
        }
      } catch {
        result.errors.push(client.name)
      }
    }

    return result
  }

  // ── Bulk: deadline nudge ───────────────────────────────────────────────────
  async bulkNudge(companyId: string, clientIds: string[]): Promise<BulkNudgeResult> {
    const result: BulkNudgeResult = { sent: 0, failed: 0, errors: [] }

    const rows = await this.getCalendar(companyId)
    const targets = rows.filter((r) => clientIds.includes(r.client.id) && r.status !== 'FILED')

    for (const row of targets) {
      if (!row.client.phone) {
        result.errors.push(`${row.client.name}: no phone number`)
        result.failed++
        continue
      }
      try {
        const daysText =
          row.daysRemaining <= 0
            ? 'The deadline has passed'
            : `The GST filing deadline is in ${row.daysRemaining} day${row.daysRemaining === 1 ? '' : 's'} (${row.deadline})`
        await this.prisma.whatsAppMessage.create({
          data: {
            companyId,
            clientId: row.client.id,
            toPhone: row.client.phone,
            templateKey: 'deadline_nudge',
            body: `Hi ${row.client.name}, ${daysText}. Please send your documents immediately to avoid late fees.`,
            status: 'QUEUED',
          },
        })
        result.sent++
      } catch {
        result.errors.push(row.client.name)
        result.failed++
      }
    }

    return result
  }

  // ── Bulk: mark as filed ───────────────────────────────────────────────────
  async bulkMarkFiled(
    companyId: string,
    userId: string,
    clientIds: string[],
  ): Promise<BulkMarkFiledResult> {
    const result: BulkMarkFiledResult = { marked: 0, errors: [] }

    const rows = await this.getCalendar(companyId)
    const targets = rows.filter((r) => clientIds.includes(r.client.id) && r.status !== 'FILED')

    for (const row of targets) {
      try {
        const [monthStr, yearStr] = row.period.split(' ')
        const monthIdx = MONTH_NAMES.indexOf(monthStr ?? '')
        const periodKey =
          monthIdx !== -1 ? `${yearStr}-${String(monthIdx + 1).padStart(2, '0')}` : row.period

        if (row.checklistId) {
          await this.prisma.complianceChecklist.update({
            where: { id: row.checklistId },
            data: { status: 'FILED' as any, completedAt: new Date(), filedBy: userId },
          })
        } else {
          await this.prisma.complianceChecklist.upsert({
            where: {
              companyId_clientId_filingType_filingPeriod: {
                companyId,
                clientId: row.client.id,
                filingType: 'GST_MONTHLY' as any,
                filingPeriod: periodKey,
              },
            },
            create: {
              companyId,
              clientId: row.client.id,
              filingType: 'GST_MONTHLY' as any,
              filingPeriod: periodKey,
              label: `GST ${row.period}`,
              dueDate: new Date(row.deadline),
              requiredDocTypes: ['GST_RETURN'],
              receivedDocIds: [],
              readinessScore: 100,
              missingItems: [],
              status: 'FILED' as any,
              completedAt: new Date(),
              filedBy: userId,
              assignedUserId: userId,
            },
            update: {
              status: 'FILED' as any,
              completedAt: new Date(),
              filedBy: userId,
            },
          })
        }

        await this.prisma.auditLog
          .create({
            data: {
              companyId,
              userId,
              action: 'GST_CLIENT_MARKED_FILED',
              entity: 'complianceChecklist',
              entityId: row.checklistId ?? row.client.id,
              metadata: { clientName: row.client.name, period: row.period },
            },
          })
          .catch(() => null)

        result.marked++
      } catch {
        result.errors.push(row.client.name)
      }
    }

    return result
  }

  // ── Heatmap ────────────────────────────────────────────────────────────────
  async getHeatmap(companyId: string): Promise<HeatmapResult> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const monthlySlots: string[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i - 1, 1)
      monthlySlots.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`)
    }

    const quarterLabels = ['Jan\u2013Mar', 'Apr\u2013Jun', 'Jul\u2013Sep', 'Oct\u2013Dec']
    const currentQuarterIdx = Math.floor(today.getMonth() / 3)
    const quarterlySlots: string[] = []
    for (let i = 4; i >= 0; i--) {
      let qIdx = currentQuarterIdx - i
      let qYear = today.getFullYear()
      while (qIdx < 0) {
        qIdx += 4
        qYear -= 1
      }
      quarterlySlots.push(`${quarterLabels[qIdx]} ${qYear}`)
    }

    const allDocs = await this.prisma.document.findMany({
      where: { companyId, documentType: 'GST_RETURN' as any },
      select: { id: true, clientId: true, filingPeriod: true },
    })

    const docMap: Record<string, Record<string, string>> = {}
    for (const d of allDocs) {
      if (!d.clientId || !d.filingPeriod) continue
      docMap[d.clientId] ??= {}
      docMap[d.clientId]![d.filingPeriod.toLowerCase()] = d.id
    }

    const clients = await this.prisma.client.findMany({
      where: { companyId, isActive: true, filerType: { in: ['MONTHLY', 'QUARTERLY'] as any } },
      select: { id: true, name: true, gstin: true, filerType: true, gstDeadlineDay: true },
      orderBy: { name: 'asc' },
    })

    const monthlyClients = clients.filter((c) => c.filerType === 'MONTHLY')
    const quarterlyClients = clients.filter((c) => c.filerType === 'QUARTERLY')

    const monthly: HeatmapClientRow[] = monthlyClients.map((client) => {
      const deadlineDay = client.gstDeadlineDay ?? 20
      const filed = docMap[client.id] ?? {}
      const cells: HeatmapCell[] = monthlySlots.map((period) => {
        const docId = filed[period.toLowerCase()] ?? null
        if (docId) return { status: 'FILED', documentId: docId }
        const parts = period.split(' ')
        const monthIdx = MONTH_NAMES.indexOf(parts[0]!)
        const year = parseInt(parts[1]!, 10)
        const dlMonth = (monthIdx + 1) % 12
        const dlYear = monthIdx === 11 ? year + 1 : year
        const deadline = new Date(dlYear, dlMonth, deadlineDay)
        if (deadline < today) return { status: 'OVERDUE', documentId: null }
        return { status: 'PENDING', documentId: null }
      })
      return { id: client.id, name: client.name, gstin: client.gstin, filerType: client.filerType, cells }
    })

    const quarterDeadlineMonths: Record<string, number> = {
      'Jan\u2013Mar': 3,
      'Apr\u2013Jun': 6,
      'Jul\u2013Sep': 9,
      'Oct\u2013Dec': 0,
    }

    const quarterly: HeatmapClientRow[] = quarterlyClients.map((client) => {
      const deadlineDay = client.gstDeadlineDay ?? 20
      const filed = docMap[client.id] ?? {}
      const cells: HeatmapCell[] = quarterlySlots.map((period) => {
        const docId = filed[period.toLowerCase()] ?? null
        if (docId) return { status: 'FILED', documentId: docId }
        const spaceIdx = period.lastIndexOf(' ')
        const label = period.slice(0, spaceIdx)
        const year = parseInt(period.slice(spaceIdx + 1), 10)
        const dlMonth = quarterDeadlineMonths[label] ?? 3
        const dlYear = label === 'Oct\u2013Dec' ? year + 1 : year
        const deadline = new Date(dlYear, dlMonth, deadlineDay)
        if (deadline < today) return { status: 'OVERDUE', documentId: null }
        return { status: 'PENDING', documentId: null }
      })
      return { id: client.id, name: client.name, gstin: client.gstin, filerType: client.filerType, cells }
    })

    return { monthlySlots, quarterlySlots, monthly, quarterly }
  }
}
