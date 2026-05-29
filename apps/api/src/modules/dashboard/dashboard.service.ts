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

  async getSummary(companyId: string): Promise<DashboardSummaryDto> {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [
      totalReceivablesAgg,
      overdueCount,
      overdueAgg,
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
        `
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

    const currentWeekPaid = Number(currentWeekAgg._sum.amount ?? 0)
    const lastWeekPaid = Number(lastWeekAgg._sum.amount ?? 0)
    const collectionsTrend =
      lastWeekPaid === 0
        ? 0
        : Math.round(((currentWeekPaid - lastWeekPaid) / lastWeekPaid) * 10000) / 100

    return {
      totalReceivables: Number(totalReceivablesAgg._sum.amount ?? 0),
      overdueAmount: Number(overdueAgg._sum.amount ?? 0),
      overdueCount,
      avgAgingDays: Math.round(overdueAgg._avg.agingDays ?? 0),
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
      rawInsights = await this.aiService.generateDashboardInsights(summary, tenantConfig)
    } catch (err) {
      this.logger.error('AI insight generation failed', err)
      return
    }

    // Apply business-rule severity floor on top of AI-provided severity
    const severityOrder: Record<string, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 }
    const businessSeverity =
      summary.overdueAmount > criticalOverdueAmount
        ? 'CRITICAL'
        : summary.overdueCount > warningOverdueCount ||
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
