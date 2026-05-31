import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import { CompaniesService } from '../companies/companies.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import { DashboardSummaryDto } from './dto/dashboard-summary.dto'
import type { TenantConfig } from '@opsc/types'
import type { InsightSeverity } from '@opsc/database'

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

  async getSummary(companyId: string): Promise<DashboardSummaryDto> {
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
        where: { companyId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: { companyId, status: 'OVERDUE' },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, status: 'OVERDUE' },
        _sum: { amount: true },
        _avg: { agingDays: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] },
          createdAt: { lte: previousMonthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: {
          companyId,
          status: 'OVERDUE',
          updatedAt: { gte: previousMonthStart, lte: previousMonthEnd },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          status: 'OVERDUE',
          updatedAt: { gte: previousMonthStart, lte: previousMonthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          status: 'OVERDUE',
          updatedAt: { gte: previousMonthStart, lte: previousMonthEnd },
        },
        _avg: { agingDays: true },
      }),
      this.configSvc.getNum(companyId, ConfigKey.CRITICAL_CUSTOMER_COUNT).then((limit) =>
        this.prisma.$queryRaw<
          Array<{ customerName: string; overdueAmount: string; oldestInvoiceDays: number }>
        >`
          SELECT "customerName",
                 SUM(amount)::text  AS "overdueAmount",
                 MAX("agingDays")   AS "oldestInvoiceDays"
          FROM   invoices
          WHERE  "companyId" = ${companyId}
            AND  status = 'OVERDUE'
          GROUP  BY "customerName"
          ORDER  BY SUM(amount) DESC
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
        where: { companyId, status: 'PAID', paidAt: { gte: sevenDaysAgo } },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          status: 'PAID',
          paidAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
        _sum: { amount: true },
      }),
      this.prisma.document.count({
        where: { companyId, status: 'UPLOADED' },
      }),
      this.prisma.document.count({
        where: { companyId, status: 'NEEDS_REVIEW' },
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

  async refreshInsights(companyId: string): Promise<void> {
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
      this.getSummary(companyId),
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
