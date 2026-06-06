import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import { CompaniesService } from '../companies/companies.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import { DashboardSummaryDto } from './dto/dashboard-summary.dto'
import type { TenantConfig, AuthenticatedUser } from '@opsc/types'
import type { InsightSeverity } from '@opsc/database'
import { getOwnedClientIds } from '../../common/helpers/client-scope.helper'

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly companiesService: CompaniesService,
    private readonly configSvc: ConfigService,
  ) {}

  private computeTrend(
    current: number,
    previous: number,
  ): { trendPct: number; trendDir: 'up' | 'down' | 'flat' } {
    if (previous === 0) return { trendPct: 0, trendDir: 'flat' }
    const pct = ((current - previous) / previous) * 100
    return {
      trendPct: Math.round(Math.abs(pct) * 10) / 10,
      trendDir: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat',
    }
  }

  private async getMonthlySparkline(
    companyId: string,
    metric: 'receivables' | 'overdueAmount' | 'overdueCount' | 'avgDays',
    monthsBack = 6,
  ): Promise<number[]> {
    const results: number[] = []
    const now = new Date()

    for (let i = monthsBack - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

      let value = 0

      if (metric === 'receivables') {
        const r = await this.prisma.invoice.aggregate({
          where: {
            companyId,
            status: { in: ['PENDING', 'OVERDUE'] },
            createdAt: { lte: monthEnd },
          },
          _sum: { amount: true },
        })
        value = Number(r._sum.amount ?? 0)
      } else if (metric === 'overdueAmount') {
        const r = await this.prisma.invoice.aggregate({
          where: {
            companyId,
            status: 'OVERDUE',
            updatedAt: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        })
        value = Number(r._sum.amount ?? 0)
      } else if (metric === 'overdueCount') {
        value = await this.prisma.invoice.count({
          where: {
            companyId,
            status: 'OVERDUE',
            updatedAt: { gte: monthStart, lte: monthEnd },
          },
        })
      } else if (metric === 'avgDays') {
        const r = await this.prisma.invoice.aggregate({
          where: {
            companyId,
            status: 'OVERDUE',
            updatedAt: { gte: monthStart, lte: monthEnd },
          },
          _avg: { agingDays: true },
        })
        value = Math.round(Number(r._avg.agingDays ?? 0))
      }

      results.push(value)
    }

    return results
  }

  async getSummary(user: AuthenticatedUser): Promise<DashboardSummaryDto> {
    const companyId = user.companyId
    const ownedIds = await getOwnedClientIds(user, this.prisma)
    const clientFilter = ownedIds !== null ? { clientId: { in: ownedIds } } : {}
    return this._getSummaryScoped(companyId, clientFilter)
  }

  private async _getSummaryScoped(companyId: string, clientFilter: Record<string, unknown>): Promise<DashboardSummaryDto> {
    const now = new Date()
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [
      totalReceivablesAgg,
      overdueCountCurrent,
      overdueAgg,
      prevTotalReceivablesAgg,
      prevOverdueCountPrev,
      prevOverdueAgg,
      prevAvgDaysAgg,
      criticalCustomersRaw,
      inventoryAlertsRaw,
      lowStockRaw,
      currentWeekAgg,
      lastWeekAgg,
      pendingDocuments,
      documentsNeedingReview,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { companyId, ...clientFilter, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: { companyId, ...clientFilter, status: 'OVERDUE' },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, ...clientFilter, status: 'OVERDUE' },
        _sum: { amount: true },
        _avg: { agingDays: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          ...clientFilter,
          status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] },
          createdAt: { lte: previousMonthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: {
          companyId,
          ...clientFilter,
          status: 'OVERDUE',
          updatedAt: { gte: previousMonthStart, lte: previousMonthEnd },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          ...clientFilter,
          status: 'OVERDUE',
          updatedAt: { gte: previousMonthStart, lte: previousMonthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          ...clientFilter,
          status: 'OVERDUE',
          updatedAt: { gte: previousMonthStart, lte: previousMonthEnd },
        },
        _avg: { agingDays: true },
      }),
      this.configSvc.getNum(companyId, ConfigKey.CRITICAL_CUSTOMER_COUNT).then((limit) =>
        this.prisma.$queryRaw<
          Array<{
            customerName: string
            phone: string | null
            email: string | null
            overdueAmount: string
            oldestInvoiceDays: number
            invoiceId: string | null
          }>
        >`
          SELECT i."customerName",
                 MAX(COALESCE(cl.phone, i."customerPhone"))          AS "phone",
                 MAX(cl.email)                                       AS "email",
                 SUM(i.amount)::text                                 AS "overdueAmount",
                 MAX(i."agingDays")                                  AS "oldestInvoiceDays",
                 (array_agg(i.id ORDER BY i."agingDays" DESC))[1]   AS "invoiceId"
          FROM   invoices i
          LEFT   JOIN clients cl ON cl.id = i."clientId"
          WHERE  i."companyId" = ${companyId}
            AND  i.status = 'OVERDUE'
          GROUP  BY i."customerName"
          ORDER  BY SUM(i.amount) DESC
          LIMIT  ${limit}
        `,
      ),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM   inventory_items
        WHERE  "companyId" = ${companyId}
          AND  quantity <= "reorderLevel"
      `,
      this.prisma.$queryRaw<
        Array<{
          sku: string
          name: string
          quantity: number
          reorderLevel: number
          movementVelocity: number
        }>
      >`
        SELECT sku, name, quantity, "reorderLevel", "movementVelocity"
        FROM   inventory_items
        WHERE  "companyId" = ${companyId}
          AND  quantity <= "reorderLevel"
        ORDER  BY
          CASE WHEN "movementVelocity" > 0
               THEN quantity::float / "movementVelocity"
               ELSE 999999
          END ASC
        LIMIT 5
      `,
      this.prisma.invoice.aggregate({
        where: { companyId, ...clientFilter, status: 'PAID', paidAt: { gte: sevenDaysAgo } },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          ...clientFilter,
          status: 'PAID',
          paidAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
        _sum: { amount: true },
      }),
      this.prisma.document.count({
        where: { companyId, ...clientFilter, status: 'UPLOADED' },
      }),
      this.prisma.document.count({
        where: { companyId, ...clientFilter, status: 'NEEDS_REVIEW' },
      }),
    ])

    // Sparklines — 4 streams in parallel, each with 6 sequential monthly queries
    const [receivablesSparkline, overdueAmountSparkline, overdueCountSparkline, avgDaysSparkline] =
      await Promise.all([
        this.getMonthlySparkline(companyId, 'receivables'),
        this.getMonthlySparkline(companyId, 'overdueAmount'),
        this.getMonthlySparkline(companyId, 'overdueCount'),
        this.getMonthlySparkline(companyId, 'avgDays'),
      ])

    // Current values
    const totalReceivablesCurrent = Number(totalReceivablesAgg._sum.amount ?? 0)
    const overdueAmountCurrent = Number(overdueAgg._sum.amount ?? 0)
    const overdueCountCurrentVal = overdueCountCurrent
    const avgDaysCurrent = Math.round(Number(overdueAgg._avg.agingDays ?? 0))

    // Previous values
    const totalReceivablesPrevious = Number(prevTotalReceivablesAgg._sum.amount ?? 0)
    const overdueAmountPrevious = Number(prevOverdueAgg._sum.amount ?? 0)
    const overdueCountPrevious = prevOverdueCountPrev
    const avgDaysPrevious = Math.round(Number(prevAvgDaysAgg._avg.agingDays ?? 0))

    // Trends
    const receivablesTrend = this.computeTrend(totalReceivablesCurrent, totalReceivablesPrevious)
    const overdueAmountTrend = this.computeTrend(overdueAmountCurrent, overdueAmountPrevious)
    const overdueCountTrend = this.computeTrend(overdueCountCurrentVal, overdueCountPrevious)
    const avgDaysTrend = this.computeTrend(avgDaysCurrent, avgDaysPrevious)

    // Collections trend (week-over-week %)
    const currentWeekPaid = Number(currentWeekAgg._sum.amount ?? 0)
    const lastWeekPaid = Number(lastWeekAgg._sum.amount ?? 0)
    const collectionsTrend =
      lastWeekPaid === 0
        ? 0
        : Math.round(((currentWeekPaid - lastWeekPaid) / lastWeekPaid) * 10000) / 100

    return {
      totalReceivables: {
        current: totalReceivablesCurrent,
        previous: totalReceivablesPrevious,
        ...receivablesTrend,
        sparkline: receivablesSparkline,
      },
      overdueAmount: {
        current: overdueAmountCurrent,
        previous: overdueAmountPrevious,
        ...overdueAmountTrend,
        sparkline: overdueAmountSparkline,
      },
      overdueCount: {
        current: overdueCountCurrentVal,
        previous: overdueCountPrevious,
        ...overdueCountTrend,
        sparkline: overdueCountSparkline,
      },
      avgDaysOverdue: {
        current: avgDaysCurrent,
        previous: avgDaysPrevious,
        ...avgDaysTrend,
        sparkline: avgDaysSparkline,
      },
      collectionsTrend,
      criticalCustomers: criticalCustomersRaw.map((c) => ({
        name: c.customerName,
        overdueAmount: Number(c.overdueAmount),
        oldestInvoiceDays: Number(c.oldestInvoiceDays),
        ...(c.phone ? { phone: c.phone } : {}),
        ...(c.email ? { email: c.email } : {}),
        ...(c.invoiceId ? { invoiceId: c.invoiceId } : {}),
      })),
      inventoryAlerts: Number(inventoryAlertsRaw[0]?.count ?? BigInt(0)),
      lowStockItems: lowStockRaw.map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        daysUntilStockout:
          item.movementVelocity > 0
            ? Math.round(item.quantity / item.movementVelocity)
            : 9999,
      })),
      generatedAt: now.toISOString(),
      pendingDocuments,
      documentsNeedingReview,
    }
  }

  async getInsights(companyId: string) {
    return this.prisma.aIInsight.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        module: true,
        category: true,
        severity: true,
        summary: true,
        createdAt: true,
      },
    })
  }

  async refreshInsights(companyId: string, force = false): Promise<void> {
    // ── Event-invalidated cache ────────────────────────────────────────────────
    if (!force) {
      const lastInsight = await this.prisma.aIInsight.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (lastInsight) {
        const ageMs = Date.now() - lastInsight.createdAt.getTime()
        if (ageMs < 60 * 60 * 1000) {
          // Insights are less than 1 hour old — only regenerate if data changed
          const since = lastInsight.createdAt
          const [changedInvoice, changedDoc, changedChecklist] = await Promise.all([
            this.prisma.invoice.findFirst({
              where: { companyId, updatedAt: { gt: since } },
              select: { id: true },
            }),
            this.prisma.document.findFirst({
              where: { companyId, updatedAt: { gt: since } },
              select: { id: true },
            }),
            this.prisma.complianceChecklist.findFirst({
              where: { companyId, updatedAt: { gt: since } },
              select: { id: true },
            }),
          ])
          if (!changedInvoice && !changedDoc && !changedChecklist) {
            this.logger.debug(`Skipping insight refresh for ${companyId} — no data changes since last generation`)
            return
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { tenantConfig: true },
    })
    const tenantConfig = company.tenantConfig as unknown as TenantConfig

    const [
      summary,
      criticalOverdueAmount,
      warningOverdueCount,
      warningTrendPercent,
      maxInsightsPerRefresh,
    ] = await Promise.all([
      this._getSummaryScoped(companyId, {}),
      this.configSvc.getNum(companyId, ConfigKey.INSIGHT_CRITICAL_OVERDUE_AMOUNT),
      this.configSvc.getNum(companyId, ConfigKey.INSIGHT_WARNING_OVERDUE_COUNT),
      this.configSvc.getNum(companyId, ConfigKey.INSIGHT_WARNING_TREND_PERCENT),
      this.configSvc.getNum(companyId, ConfigKey.MAX_INSIGHTS_PER_REFRESH),
    ])

    let rawInsights: Array<{ category: string; severity: string; summary: string }>

    try {
      rawInsights = await this.aiService.generateDashboardInsights(summary as any, tenantConfig)
    } catch (err) {
      this.logger.error('AI insight generation failed', err)
      return
    }

    // Apply business-rule severity floor on top of AI-provided severity
    const severityOrder: Record<string, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 }
    const businessSeverity =
      summary.overdueAmount.current > criticalOverdueAmount
        ? 'CRITICAL'
        : summary.overdueCount.current > warningOverdueCount ||
            summary.collectionsTrend < warningTrendPercent ||
            summary.inventoryAlerts > 0
          ? 'WARNING'
          : 'INFO'

    const insights = rawInsights.slice(0, maxInsightsPerRefresh).map((ins) => {
      const aiLevel = severityOrder[ins.severity] ?? 0
      const bizLevel = severityOrder[businessSeverity] ?? 0
      const finalSeverity = (aiLevel >= bizLevel ? ins.severity : businessSeverity) as InsightSeverity
      return { ...ins, severity: finalSeverity }
    })

    await this.prisma.$transaction(
      insights.map((ins) =>
        this.prisma.aIInsight.create({
          data: {
            companyId,
            module: 'DASHBOARD',
            category: ins.category,
            severity: ins.severity,
            summary: ins.summary,
            dataSnapshot: JSON.parse(JSON.stringify(summary)),
          },
        }),
      ),
    )
  }
}
