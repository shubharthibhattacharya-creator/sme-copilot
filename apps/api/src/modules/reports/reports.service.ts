import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import { QUEUE_REPORTS } from '../../common/queue/queue.constants'
import type { ReportJobData } from './report.processor'
import type { CreateReportDto } from './dto/create-report.dto'
import type { AuthenticatedUser, TenantConfig } from '@opsc/types'
import type { ReportType } from '@opsc/database'

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    @InjectQueue(QUEUE_REPORTS) private readonly reportQueue: Queue<ReportJobData>,
  ) {}

  async create(dto: CreateReportDto, user: AuthenticatedUser) {
    const report = await this.prisma.report.create({
      data: {
        companyId: user.companyId,
        generatedById: user.userId,
        reportType: dto.reportType,
        status: 'GENERATING',
        periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
      },
    })

    // Enqueue generation — worker picks up async with 3 retries on failure
    await this.reportQueue.add('generate', { reportId: report.id, companyId: user.companyId })

    return report
  }

  async generate(reportId: string, companyId: string): Promise<void> {
    try {
      const report = await this.prisma.report.findUniqueOrThrow({ where: { id: reportId } })
      const company = await this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { tenantConfig: true },
      })
      const tenantConfig = company.tenantConfig as unknown as TenantConfig

      const dataSnapshot = await this.buildDataSnapshot(companyId, report.reportType, report.periodStart, report.periodEnd)

      let aiSummary: string | undefined
      try {
        aiSummary = await this.aiService.generateReportSummary(
          report.reportType,
          dataSnapshot,
          tenantConfig,
        )
      } catch (err) {
        this.logger.warn(`AI summary failed for report ${reportId}`, err)
      }

      await this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'COMPLETED',
          dataSnapshot: JSON.parse(JSON.stringify(dataSnapshot)),
          aiSummary,
        },
      })
    } catch (err) {
      this.logger.error(`Report ${reportId} failed`, err)
      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'FAILED' },
      })
    }
  }

  async list(companyId: string) {
    return this.prisma.report.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        generatedBy: { select: { id: true, name: true } },
      },
    })
  }

  async findOne(id: string, companyId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { generatedBy: { select: { id: true, name: true } } },
    })
    if (!report || report.companyId !== companyId) {
      throw new NotFoundException('Report not found')
    }
    return report
  }

  private async buildDataSnapshot(
    companyId: string,
    reportType: ReportType,
    periodStart: Date | null,
    periodEnd: Date | null,
  ): Promise<Record<string, unknown>> {
    const dateFilter =
      periodStart && periodEnd
        ? { gte: periodStart, lte: periodEnd }
        : periodStart
          ? { gte: periodStart }
          : periodEnd
            ? { lte: periodEnd }
            : undefined

    if (reportType === 'COLLECTIONS_AGING') {
      const overdue = await this.prisma.invoice.findMany({
        where: { companyId, status: 'OVERDUE' },
        select: { customerName: true, amount: true, agingDays: true },
      })
      const buckets = [
        { label: '0–30 days', min: 0, max: 30 },
        { label: '31–60 days', min: 31, max: 60 },
        { label: '61–90 days', min: 61, max: 90 },
        { label: '90+ days', min: 91, max: Infinity },
      ].map(({ label, min, max }) => {
        const items = overdue.filter((i) => i.agingDays >= min && i.agingDays <= max)
        return {
          label,
          count: items.length,
          amount: items.reduce((s, i) => s + Number(i.amount), 0),
        }
      })
      return {
        totalOverdue: overdue.reduce((s, i) => s + Number(i.amount), 0),
        overdueCount: overdue.length,
        buckets,
      }
    }

    if (reportType === 'RECEIVABLES_SUMMARY') {
      const [agg, byStatus] = await Promise.all([
        this.prisma.invoice.aggregate({
          where: { companyId, ...(dateFilter ? { dueDate: dateFilter } : {}) },
          _sum: { amount: true },
          _count: true,
          _avg: { agingDays: true },
        }),
        this.prisma.invoice.groupBy({
          by: ['status'],
          where: { companyId, ...(dateFilter ? { dueDate: dateFilter } : {}) },
          _sum: { amount: true },
          _count: true,
        }),
      ])
      return {
        totalAmount: Number(agg._sum.amount ?? 0),
        totalInvoices: agg._count,
        avgAgingDays: Math.round(Number(agg._avg.agingDays ?? 0)),
        byStatus: byStatus.map((s) => ({
          status: s.status,
          count: s._count,
          amount: Number(s._sum.amount ?? 0),
        })),
      }
    }

    if (reportType === 'INVENTORY_STATUS') {
      const items = await this.prisma.inventoryItem.findMany({
        where: { companyId },
        select: { sku: true, name: true, category: true, quantity: true, reorderLevel: true, unitCost: true, movementVelocity: true },
      })
      const lowStock = items.filter((i) => i.quantity <= i.reorderLevel)
      const totalValue = items.reduce((s, i) => s + i.quantity * Number(i.unitCost), 0)
      return {
        totalItems: items.length,
        lowStockCount: lowStock.length,
        totalInventoryValue: totalValue,
        lowStockItems: lowStock.slice(0, 10).map((i) => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          reorderLevel: i.reorderLevel,
          daysUntilStockout:
            i.movementVelocity > 0 ? Math.round(i.quantity / i.movementVelocity) : null,
        })),
      }
    }

    if (reportType === 'CASH_FLOW') {
      const [collected, pending] = await Promise.all([
        this.prisma.invoice.aggregate({
          where: {
            companyId,
            status: 'PAID',
            ...(dateFilter ? { paidAt: dateFilter } : {}),
          },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.invoice.aggregate({
          where: { companyId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
          _sum: { amount: true },
          _count: true,
        }),
      ])
      return {
        collectedAmount: Number(collected._sum.amount ?? 0),
        collectedCount: collected._count,
        pendingAmount: Number(pending._sum.amount ?? 0),
        pendingCount: pending._count,
      }
    }

    if (reportType === 'AI_INSIGHTS_DIGEST') {
      const [insights, checklists] = await Promise.all([
        this.prisma.aIInsight.findMany({
          where: { companyId },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
          take: 20,
          select: { module: true, category: true, severity: true, summary: true, createdAt: true },
        }),
        this.prisma.complianceChecklist.findMany({
          where: { companyId, status: { in: ['IN_PROGRESS', 'READY', 'OVERDUE'] } },
          orderBy: { dueDate: 'asc' },
          take: 20,
          select: {
            id: true,
            label: true,
            dueDate: true,
            readinessScore: true,
            status: true,
            missingItems: true,
            client: { select: { id: true, name: true } },
          },
        }),
      ])

      const checklistReadiness = checklists.map((c) => ({
        clientName: c.client.name,
        label: c.label,
        dueDate: c.dueDate.toISOString().split('T')[0],
        readinessScore: c.readinessScore,
        status: c.status,
        missingCount: Array.isArray(c.missingItems) ? (c.missingItems as unknown[]).length : 0,
      }))

      return {
        totalInsights: insights.length,
        bySeverity: {
          CRITICAL: insights.filter((i) => i.severity === 'CRITICAL').length,
          WARNING: insights.filter((i) => i.severity === 'WARNING').length,
          INFO: insights.filter((i) => i.severity === 'INFO').length,
        },
        recentInsights: insights,
        complianceReadiness: {
          totalChecklists: checklists.length,
          avgReadinessScore: checklists.length > 0
            ? Math.round(checklists.reduce((s, c) => s + c.readinessScore, 0) / checklists.length)
            : null,
          overdueCount: checklists.filter((c) => c.status === 'OVERDUE').length,
          readyCount: checklists.filter((c) => c.status === 'READY').length,
          checklists: checklistReadiness,
        },
      }
    }

    return {}
  }
}
