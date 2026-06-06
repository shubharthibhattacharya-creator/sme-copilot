import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@opsc/database'
import { AgingBreakdownDto } from './dto/aging-breakdown.dto'
import type { ListCollectionsDto } from './dto/list-collections.dto'
import type { InvoiceWithRisk, RiskLevel, AuthenticatedUser } from '@opsc/types'
import { getOwnedClientIds } from '../../common/helpers/client-scope.helper'
import { CompaniesService } from '../companies/companies.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import type { WhatsAppService } from '../whatsapp/whatsapp.service'

function toRiskLevel(
  score: number | null | undefined,
  lowThreshold: number,
  mediumThreshold: number,
): RiskLevel {
  if (score === null || score === undefined) return 'UNSCORED'
  if (score >= mediumThreshold) return 'HIGH'
  if (score >= lowThreshold) return 'MEDIUM'
  return 'LOW'
}

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly configSvc: ConfigService,
    @Optional() private readonly whatsapp?: WhatsAppService,
  ) {}

  async listWithRisk(user: AuthenticatedUser, filters: ListCollectionsDto) {
    const companyId = user.companyId
    const {
      page = 1,
      limit = 20,
      status,
      riskLevel,
      sortBy = 'agingDays',
      sortOrder = 'desc',
    } = filters

    const [low, medium] = await Promise.all([
      this.configSvc.getNum(companyId, ConfigKey.RISK_THRESHOLD_MEDIUM),
      this.configSvc.getNum(companyId, ConfigKey.RISK_THRESHOLD_HIGH),
    ])

    const riskScoreFilter: Prisma.FloatFilter | undefined =
      riskLevel === 'LOW'
        ? { lt: low }
        : riskLevel === 'MEDIUM'
          ? { gte: low, lt: medium }
          : riskLevel === 'HIGH'
            ? { gte: medium }
            : undefined

    const ownedIds = await getOwnedClientIds(user, this.prisma)
    const clientScopeFilter: Prisma.InvoiceWhereInput =
      ownedIds !== null ? { clientId: { in: ownedIds } } : {}

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      ...clientScopeFilter,
      ...(status ? { status } : {}),
      ...(riskScoreFilter
        ? { collectionRisk: { riskScore: riskScoreFilter } }
        : {}),
    }

    const orderBy: Prisma.InvoiceOrderByWithRelationInput =
      sortBy === 'riskScore'
        ? { collectionRisk: { riskScore: sortOrder } }
        : sortBy === 'amount'
          ? { amount: sortOrder }
          : { agingDays: sortOrder }

    const safeLimit = Math.min(limit, 50)

    const [total, invoices] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        select: {
          id: true,
          companyId: true,
          customerName: true,
          customerPhone: true,
          amount: true,
          currency: true,
          dueDate: true,
          paidAt: true,
          status: true,
          agingDays: true,
          createdAt: true,
          updatedAt: true,
          collectionRisk: {
            select: { riskScore: true, predictedDelayDays: true },
          },
        },
        orderBy,
        skip: (page - 1) * safeLimit,
        take: safeLimit,
      }),
    ])

    const data: InvoiceWithRisk[] = invoices.map((inv) => ({
      id: inv.id,
      companyId: inv.companyId,
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      amount: Number(inv.amount),
      currency: inv.currency,
      dueDate: inv.dueDate.toISOString(),
      paidAt: inv.paidAt?.toISOString() ?? null,
      status: inv.status,
      agingDays: inv.agingDays,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      riskScore: inv.collectionRisk?.riskScore ?? null,
      riskLevel: toRiskLevel(inv.collectionRisk?.riskScore, low, medium),
      predictedDelayDays: inv.collectionRisk?.predictedDelayDays ?? null,
    }))

    return {
      data,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    }
  }

  async getAgingBreakdown(companyId: string): Promise<AgingBreakdownDto> {
    const [b1, b2, b3] = await Promise.all([
      this.configSvc.getNum(companyId, ConfigKey.AGING_BUCKET_1_MAX),
      this.configSvc.getNum(companyId, ConfigKey.AGING_BUCKET_2_MAX),
      this.configSvc.getNum(companyId, ConfigKey.AGING_BUCKET_3_MAX),
    ])
    const BUCKETS = [
      { label: `0–${b1} days`, minDays: 0, maxDays: b1 },
      { label: `${b1 + 1}–${b2} days`, minDays: b1 + 1, maxDays: b2 },
      { label: `${b2 + 1}–${b3} days`, minDays: b2 + 1, maxDays: b3 },
      { label: `${b3}+ days`, minDays: b3 + 1, maxDays: null },
    ]

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { companyId, status: 'OVERDUE' },
      select: { agingDays: true, amount: true },
    })

    const totalCount = overdueInvoices.length
    const totalOverdue = overdueInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount),
      0,
    )

    const buckets = BUCKETS.map(({ label, minDays, maxDays }) => {
      const matching = overdueInvoices.filter((inv) => {
        const d = inv.agingDays
        return d >= minDays && (maxDays === null || d <= maxDays)
      })
      const bucketTotal = matching.reduce(
        (sum, inv) => sum + Number(inv.amount),
        0,
      )
      return {
        label,
        minDays,
        maxDays,
        count: matching.length,
        totalAmount: bucketTotal,
        percentOfOverdue:
          totalOverdue > 0
            ? Math.round((bucketTotal / totalOverdue) * 10000) / 100
            : 0,
      }
    })

    return { buckets, totalOverdue, totalCount }
  }

  async findOne(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { collectionRisk: true },
    })
    if (!invoice) throw new NotFoundException('Invoice not found')

    const history = await this.prisma.auditLog.findMany({
      where: { companyId, entity: 'invoice', entityId: invoiceId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    })

    return {
      ...invoice,
      amount: Number(invoice.amount),
      history,
    }
  }

  async sendReminder(
    invoiceId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true, customerName: true, amount: true, status: true },
    })
    if (!invoice) throw new NotFoundException('Invoice not found')

    // ── Reminder interval guard ───────────────────────────────────────────────
    const intervalDays = await this.configSvc.getNum(companyId, ConfigKey.REMINDER_INTERVAL_DAYS)
    const intervalAgo = new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000)
    const recentReminder = await this.prisma.auditLog.findFirst({
      where: {
        companyId,
        entity: 'invoice',
        entityId: invoiceId,
        action: 'REMINDER_SENT',
        createdAt: { gt: intervalAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (recentReminder) {
      const sentOn = recentReminder.createdAt.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
      throw new BadRequestException(
        `Reminder already sent on ${sentOn}. Next reminder allowed after ${intervalDays} day${intervalDays === 1 ? '' : 's'}.`,
      )
    }
    // ─────────────────────────────────────────────────────────────────────────

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { tenantConfig: true },
    })
    const config = company.tenantConfig as Record<string, unknown>
    const whatsappEnabled = config['whatsappEnabled'] === true

    if (whatsappEnabled && this.whatsapp) {
      await this.whatsapp.sendFeeReminder(invoiceId, companyId).catch(() => {
        // swallow — phone may not be set, log will have the error
      })
    }

    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'REMINDER_SENT',
        entity: 'invoice',
        entityId: invoiceId,
        metadata: {
          customerName: invoice.customerName,
          amount: Number(invoice.amount),
          channel: whatsappEnabled ? 'WHATSAPP' : 'MANUAL',
        },
      },
    })
  }

  async calculateRiskScores(companyId: string): Promise<void> {
    const [riskWeightAging, riskWeightAmount, riskWeightHistory, agingBucket3Max] = await Promise.all([
      this.configSvc.getNum(companyId, ConfigKey.RISK_WEIGHT_AGING),
      this.configSvc.getNum(companyId, ConfigKey.RISK_WEIGHT_AMOUNT),
      this.configSvc.getNum(companyId, ConfigKey.RISK_WEIGHT_HISTORY),
      this.configSvc.getNum(companyId, ConfigKey.AGING_BUCKET_3_MAX),
    ])

    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, status: { in: ['PENDING', 'OVERDUE'] } },
      select: {
        id: true,
        agingDays: true,
        amount: true,
        customerName: true,
      },
    })

    if (invoices.length === 0) return

    const avgResult = await this.prisma.invoice.aggregate({
      where: { companyId },
      _avg: { amount: true },
    })
    const companyAvgAmount = Number(avgResult._avg.amount ?? 1)

    // Per-customer late rate in a single query
    const lateRatesRaw = await this.prisma.$queryRaw<
      Array<{ customerName: string; lateRate: number }>
    >`
      SELECT "customerName",
             COUNT(CASE WHEN status IN ('OVERDUE','PARTIAL') THEN 1 END)::float
               / NULLIF(COUNT(*), 0) AS "lateRate"
      FROM   invoices
      WHERE  "companyId" = ${companyId}
      GROUP  BY "customerName"
    `
    const lateRateMap = Object.fromEntries(
      lateRatesRaw.map((r) => [r.customerName, Number(r.lateRate ?? 0)]),
    )

    const upserts = invoices.map((inv) => {
      const aging = Math.min(inv.agingDays / agingBucket3Max, 1) * riskWeightAging
      const maxAmt = Math.max(Number(inv.amount), companyAvgAmount)
      const amount = (Number(inv.amount) / maxAmt) * riskWeightAmount
      const history = (lateRateMap[inv.customerName] ?? 0) * riskWeightHistory
      const riskScore = Math.min(aging + amount + history, 1)
      const predictedDelayDays = Math.round(inv.agingDays * (1 + riskScore))

      return this.prisma.collectionRisk.upsert({
        where: { invoiceId: inv.id },
        create: {
          invoiceId: inv.id,
          riskScore,
          predictedDelayDays,
          riskFactors: { aging, amount, history },
        },
        update: {
          riskScore,
          predictedDelayDays,
          riskFactors: { aging, amount, history },
          calculatedAt: new Date(),
        },
      })
    })

    await this.prisma.$transaction(upserts)
  }
}
