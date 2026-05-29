import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@opsc/database'
import type { CreateInvoiceDto } from './dto/create-invoice.dto'
import type { ListInvoicesDto } from './dto/list-invoices.dto'
import type { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto'
import { differenceInDays } from '../../common/utils/date.util'
import type { WhatsAppService } from '../whatsapp/whatsapp.service'

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly whatsapp?: WhatsAppService,
  ) {}

  async list(companyId: string, query: ListInvoicesDto) {
    const { status, page = 1, limit = 20 } = query
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      ...(status ? { status } : {}),
    }

    const [total, invoices] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: { collectionRisk: true },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return {
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async agingSummary(companyId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
      select: { amount: true, agingDays: true },
    })

    const buckets = {
      current: new Prisma.Decimal(0),
      '1_30': new Prisma.Decimal(0),
      '31_60': new Prisma.Decimal(0),
      '61_90': new Prisma.Decimal(0),
      '90plus': new Prisma.Decimal(0),
    }

    for (const inv of invoices) {
      const d = inv.agingDays
      if (d <= 0) buckets.current = buckets.current.add(inv.amount)
      else if (d <= 30) buckets['1_30'] = buckets['1_30'].add(inv.amount)
      else if (d <= 60) buckets['31_60'] = buckets['31_60'].add(inv.amount)
      else if (d <= 90) buckets['61_90'] = buckets['61_90'].add(inv.amount)
      else buckets['90plus'] = buckets['90plus'].add(inv.amount)
    }

    return buckets
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: { collectionRisk: true },
    })
    if (!invoice) throw new NotFoundException('Invoice not found')
    return invoice
  }

  async create(companyId: string, dto: CreateInvoiceDto) {
    return this.prisma.invoice.create({
      data: { ...dto, companyId },
    })
  }

  async updateStatus(companyId: string, id: string, dto: UpdateInvoiceStatusDto) {
    await this.findOne(companyId, id)
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    })

    if (dto.status === 'PAID' && this.whatsapp) {
      await this.whatsapp.sendPaymentAck(id, companyId).catch(() => {
        // swallow — phone may not be set
      })
    }

    return updated
  }
}
