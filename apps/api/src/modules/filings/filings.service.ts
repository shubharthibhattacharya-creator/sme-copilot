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
  monthlySlots: string[]     // 12 monthly period labels, oldest→newest
  quarterlySlots: string[]   // 5 quarterly period labels, oldest→newest
  monthly: HeatmapClientRow[]
  quarterly: HeatmapClientRow[]
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
  period: string       // e.g. "Apr 2026"
  deadline: string     // ISO date string (the deadline date)
  daysRemaining: number
  status: FilingStatus
  document: { id: string; originalName: string; filingPeriod: string | null } | null
  checklistId: string | null  // compliance checklist id for this client+period, if one exists
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * Returns the current filing period (previous month) and deadline for a given
 * gstDeadlineDay and filerType.
 *
 * Monthly filers: file last month's return by gstDeadlineDay of the current month.
 * Quarterly filers: file last quarter's return — deadline is gstDeadlineDay of the
 *   month following the quarter-end (Apr/Jul/Oct/Jan).
 * If the current month's deadline has already passed, the *next* upcoming period is shown.
 */
function computeDeadline(
  filerType: string,
  gstDeadlineDay: number,
  today: Date,
): { period: string; deadline: Date } {
  const year = today.getFullYear()
  const month = today.getMonth() // 0-indexed

  if (filerType === 'QUARTERLY') {
    // Quarter end months (0-indexed): 2=Mar, 5=Jun, 8=Sep, 11=Dec
    // Deadline months (0-indexed): 3=Apr, 6=Jul, 9=Oct, 0=Jan
    const quarterDeadlineMonths = [3, 6, 9, 0]
    const quarterEndLabels = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec']

    // Find the next quarterly deadline >= today
    for (let i = 0; i < 4; i++) {
      const deadlineMonth = quarterDeadlineMonths[i]!
      const deadlineYear = deadlineMonth === 0 ? year + 1 : year
      const deadline = new Date(deadlineYear, deadlineMonth, gstDeadlineDay)
      if (deadline >= today) {
        // Period is the quarter ending 2 months before deadline month
        const periodLabel = quarterEndLabels[i]! + ' ' + (deadlineMonth === 0 ? year : year)
        return { period: periodLabel, deadline }
      }
    }
    // Fallback: first deadline of next year
    const deadline = new Date(year + 1, 3, gstDeadlineDay)
    return { period: 'Jan–Mar ' + (year + 1), deadline }
  }

  // Monthly: file last month's return by gstDeadlineDay of current month
  const thisMonthDeadline = new Date(year, month, gstDeadlineDay)
  if (today <= thisMonthDeadline) {
    // Period = last month
    const periodMonth = month === 0 ? 11 : month - 1
    const periodYear = month === 0 ? year - 1 : year
    return {
      period: `${MONTH_NAMES[periodMonth]} ${periodYear}`,
      deadline: thisMonthDeadline,
    }
  } else {
    // Deadline passed — show next month's deadline
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

    // Fetch all GST_RETURN documents for this company (to check what's filed)
    const filedDocs = await this.prisma.document.findMany({
      where: { companyId, documentType: 'GST_RETURN' },
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
      const deadlineDay = client.gstDeadlineDay ?? 20 // default GSTR-3B deadline
      const { period, deadline } = computeDeadline(client.filerType, deadlineDay, today)

      const msRemaining = deadline.getTime() - today.getTime()
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))

      // Check if a GST_RETURN doc exists for this client + period
      const clientDocs = docsByClient[client.id] ?? []
      const matchedDoc = clientDocs.find(
        (d) => d.filingPeriod?.toLowerCase() === period.toLowerCase(),
      ) ?? null

      let status: FilingStatus
      if (matchedDoc) {
        status = 'FILED'
      } else if (daysRemaining < 0) {
        status = 'OVERDUE'
      } else {
        status = 'PENDING'
      }

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
          ? { id: matchedDoc.id, originalName: matchedDoc.originalName, filingPeriod: matchedDoc.filingPeriod }
          : null,
        checklistId: null, // filled in below
      })
    }

    // Attach checklistId — batch-fetch all active checklists for these clients
    if (rows.length > 0) {
      const clientIds = rows.map((r) => r.client.id)
      const checklists = await this.prisma.complianceChecklist.findMany({
        where: {
          companyId,
          clientId: { in: clientIds },
          filingType: { in: ['GST_MONTHLY', 'GST_QUARTERLY'] },
          status: { not: 'FILED' },
        },
        select: { id: true, clientId: true, filingPeriod: true },
      })
      // Index by clientId → checklistId (latest match wins)
      for (const cl of checklists) {
        const row = rows.find((r) => r.client.id === cl.clientId)
        if (!row) continue
        // Convert calendar period "Apr 2026" → "2026-04" for comparison
        const [monthStr, yearStr] = row.period.split(' ')
        const monthIdx = MONTH_NAMES.indexOf(monthStr ?? '')
        if (monthIdx === -1) continue
        const periodKey = `${yearStr}-${String(monthIdx + 1).padStart(2, '0')}`
        if (cl.filingPeriod === periodKey || cl.filingPeriod === row.period) {
          row.checklistId = cl.id
        }
      }
    }

    // Sort: OVERDUE first, then by daysRemaining asc
    return rows.sort((a, b) => {
      const order: Record<FilingStatus, number> = { OVERDUE: 0, PENDING: 1, FILED: 2 }
      const diff = order[a.status] - order[b.status]
      if (diff !== 0) return diff
      return a.daysRemaining - b.daysRemaining
    })
  }

  async getSummary(companyId: string) {
    const rows = await this.getCalendar(companyId)
    return {
      total: rows.length,
      filed: rows.filter((r) => r.status === 'FILED').length,
      pending: rows.filter((r) => r.status === 'PENDING').length,
      overdue: rows.filter((r) => r.status === 'OVERDUE').length,
      dueSoon: rows.filter((r) => r.status === 'PENDING' && r.daysRemaining <= 7).length,
    }
  }

  // ─── Heatmap ────────────────────────────────────────────────────────────────
  //
  // Returns a 12-slot grid (last 12 months as filing periods) for monthly filers
  // and a 5-slot grid (last 5 quarters) for quarterly filers.
  // Both share the same `slots` array — quarterly clients have null cells for
  // months that don't align with a quarter-end.

  async getHeatmap(companyId: string): Promise<HeatmapResult> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ── Generate monthly slots: last 12 filing periods (oldest → newest) ───
    // Each slot is the period month label e.g. "Apr 2026".
    // Slot 0 = 12 months ago, slot 11 = last month (most recently completable).
    const monthlySlots: string[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i - 1, 1)
      monthlySlots.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`)
    }

    // ── Generate quarterly slots: last 5 quarter periods ────────────────────
    // Quarter periods: "Jan–Mar YYYY", "Apr–Jun YYYY", "Jul–Sep YYYY", "Oct–Dec YYYY"
    const quarterLabels = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec']
    // Quarter index: 0=Q1(Jan-Mar), 1=Q2(Apr-Jun), 2=Q3(Jul-Sep), 3=Q4(Oct-Dec)
    const currentQuarterIdx = Math.floor(today.getMonth() / 3)
    const quarterlySlots: string[] = []
    for (let i = 4; i >= 0; i--) {
      let qIdx = currentQuarterIdx - i
      let qYear = today.getFullYear()
      while (qIdx < 0) { qIdx += 4; qYear -= 1 }
      quarterlySlots.push(`${quarterLabels[qIdx]} ${qYear}`)
    }

    // ── Fetch all GST_RETURN documents for the company ───────────────────────
    const allDocs = await this.prisma.document.findMany({
      where: { companyId, documentType: 'GST_RETURN' },
      select: { id: true, clientId: true, filingPeriod: true },
    })

    // Map: clientId → { periodLower → documentId }
    const docMap: Record<string, Record<string, string>> = {}
    for (const d of allDocs) {
      if (!d.clientId || !d.filingPeriod) continue
      docMap[d.clientId] ??= {}
      docMap[d.clientId]![d.filingPeriod.toLowerCase()] = d.id
    }

    // ── Fetch active clients ─────────────────────────────────────────────────
    const clients = await this.prisma.client.findMany({
      where: { companyId, isActive: true, filerType: { in: ['MONTHLY', 'QUARTERLY'] } },
      select: { id: true, name: true, gstin: true, filerType: true, gstDeadlineDay: true },
      orderBy: { name: 'asc' },
    })

    const monthlyClients = clients.filter((c) => c.filerType === 'MONTHLY')
    const quarterlyClients = clients.filter((c) => c.filerType === 'QUARTERLY')

    // ── Build monthly client rows ────────────────────────────────────────────
    const monthly: HeatmapClientRow[] = monthlyClients.map((client) => {
      const deadlineDay = client.gstDeadlineDay ?? 20
      const filed = docMap[client.id] ?? {}

      const cells: HeatmapCell[] = monthlySlots.map((period) => {
        const docId = filed[period.toLowerCase()] ?? null
        if (docId) return { status: 'FILED', documentId: docId }

        // Determine if deadline for this period has passed
        const parts = period.split(' ')
        const monthIdx = MONTH_NAMES.indexOf(parts[0]!)
        const year = parseInt(parts[1]!, 10)
        // Deadline = deadlineDay of the NEXT month after the period
        const dlMonth = (monthIdx + 1) % 12
        const dlYear  = monthIdx === 11 ? year + 1 : year
        const deadline = new Date(dlYear, dlMonth, deadlineDay)

        if (deadline < today) return { status: 'OVERDUE', documentId: null }
        return { status: 'PENDING', documentId: null }
      })

      return { id: client.id, name: client.name, gstin: client.gstin, filerType: client.filerType, cells }
    })

    // ── Build quarterly client rows ──────────────────────────────────────────
    // quarterlySlots are like "Jan–Mar 2026"
    // Quarter deadline: "Jan–Mar" → April; "Apr–Jun" → July; "Jul–Sep" → October; "Oct–Dec" → January next year
    const quarterDeadlineMonths: Record<string, number> = {
      'Jan–Mar': 3,   // April (0-indexed)
      'Apr–Jun': 6,   // July
      'Jul–Sep': 9,   // October
      'Oct–Dec': 0,   // January (next year)
    }

    const quarterly: HeatmapClientRow[] = quarterlyClients.map((client) => {
      const deadlineDay = client.gstDeadlineDay ?? 20
      const filed = docMap[client.id] ?? {}

      const cells: HeatmapCell[] = quarterlySlots.map((period) => {
        const docId = filed[period.toLowerCase()] ?? null
        if (docId) return { status: 'FILED', documentId: docId }

        // e.g. "Jan–Mar 2026" → label="Jan–Mar", year=2026
        const spaceIdx = period.lastIndexOf(' ')
        const label = period.slice(0, spaceIdx)
        const year  = parseInt(period.slice(spaceIdx + 1), 10)
        const dlMonth = quarterDeadlineMonths[label] ?? 3
        const dlYear  = label === 'Oct–Dec' ? year + 1 : year
        const deadline = new Date(dlYear, dlMonth, deadlineDay)

        if (deadline < today) return { status: 'OVERDUE', documentId: null }
        return { status: 'PENDING', documentId: null }
      })

      return { id: client.id, name: client.name, gstin: client.gstin, filerType: client.filerType, cells }
    })

    return { monthlySlots, quarterlySlots, monthly, quarterly }
  }
}
