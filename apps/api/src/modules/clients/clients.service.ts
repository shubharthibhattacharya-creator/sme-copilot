import { Injectable, NotFoundException, ConflictException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  InvalidGstinException,
  InvalidPanException,
  ClientAlreadyExistsException,
  CsvImportPartialException,
} from '../../common/exceptions'
import type { CreateClientDto } from './dto/create-client.dto'
import type { UpdateClientDto } from './dto/update-client.dto'
import type { ListClientsDto } from './dto/list-clients.dto'
import type { GstinService } from './gstin.service'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_RE   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gstinSvc?: GstinService,
  ) {}

  private validate(dto: { gstin?: string; pan?: string }) {
    if (dto.gstin && !GSTIN_RE.test(dto.gstin)) {
      throw new InvalidGstinException(dto.gstin)
    }
    if (dto.pan && !PAN_RE.test(dto.pan)) {
      throw new InvalidPanException(dto.pan)
    }
  }

  async create(companyId: string, dto: CreateClientDto) {
    this.validate(dto)
    if (dto.gstin) {
      const existing = await this.prisma.client.findUnique({
        where: { companyId_gstin: { companyId, gstin: dto.gstin } },
      })
      if (existing) throw new ClientAlreadyExistsException(dto.gstin)
    }
    const client = await this.prisma.client.create({ data: { companyId, ...dto } })
    // Fire-and-forget GSTIN validation — result stored asynchronously
    if (dto.gstin && this.gstinSvc) {
      this.gstinSvc.validateAndStore(client.id, dto.gstin).catch(() => undefined)
    }
    return client
  }

  async list(companyId: string, query: ListClientsDto) {
    const { isActive = true, filerType, page = 1, limit = 20 } = query
    const where = {
      companyId,
      isActive,
      ...(filerType ? { filerType } : {}),
    }
    const [total, clients] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        include: {
          _count: {
            select: {
              invoices: true,
              documents: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])
    return { data: clients, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  async findOne(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { invoices: true, documents: true } },
      },
    })
    if (!client) throw new NotFoundException('Client not found')
    return client
  }

  async update(companyId: string, id: string, dto: UpdateClientDto) {
    this.validate(dto)
    await this.findOne(companyId, id)
    const updated = await this.prisma.client.update({ where: { id }, data: dto })
    // Re-validate if GSTIN changed
    if (dto.gstin && this.gstinSvc) {
      this.gstinSvc.validateAndStore(id, dto.gstin).catch(() => undefined)
    }
    return updated
  }

  async softDelete(companyId: string, id: string) {
    await this.findOne(companyId, id)
    return this.prisma.client.update({ where: { id }, data: { isActive: false } })
  }

  async getStats(companyId: string, clientId: string) {
    const client = await this.findOne(companyId, clientId)

    const [invoiceStats, overdueStats, paidStats, docCount] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { companyId, clientId },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, clientId, status: 'OVERDUE' },
        _sum: { amount: true },
        _count: { id: true },
        _avg: { agingDays: true },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, clientId, status: 'PAID' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.document.count({ where: { companyId, clientId } }),
    ])

    const lastPayment = await this.prisma.invoice.findFirst({
      where: { companyId, clientId, status: 'PAID' },
      orderBy: { paidAt: 'desc' },
      select: { paidAt: true },
    })

    return {
      client,
      totalInvoiced: Number(invoiceStats._sum.amount ?? 0),
      totalPaid: Number(paidStats._sum.amount ?? 0),
      totalOverdue: Number(overdueStats._sum.amount ?? 0),
      overdueCount: overdueStats._count.id,
      invoiceCount: invoiceStats._count.id,
      avgAgingDays: Math.round(overdueStats._avg.agingDays ?? 0),
      documentsSubmitted: docCount,
      lastPaymentDate: lastPayment?.paidAt ?? null,
    }
  }

  async importFromCsv(companyId: string, csvContent: string): Promise<{ created: number; skipped: number; errors: string[] }> {
    const lines = csvContent.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return { created: 0, skipped: 0, errors: ['CSV is empty or missing header'] }

    // Skip header
    const rows = lines.slice(1)
    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const [name, gstin, pan, contactPerson, phone, email, filerType] = cols

      if (!name) {
        errors.push(`Row ${i + 2}: name is required`)
        continue
      }

      try {
        await this.create(companyId, {
          name,
          gstin: gstin || undefined,
          pan: pan || undefined,
          contactPerson: contactPerson || undefined,
          phone: phone || undefined,
          email: email || undefined,
          filerType: (filerType as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL') || 'MONTHLY',
        })
        created++
      } catch (err) {
        if (err instanceof ConflictException) {
          skipped++
        } else {
          const errMsg = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`Row ${i + 2}: ${errMsg}`)
        }
      }
    }

    if (errors.length > 0 && created === 0) {
      throw new CsvImportPartialException(created, errors.length, errors)
    }
    if (errors.length > 0) {
      throw new CsvImportPartialException(created, errors.length, errors)
    }

    return { created, skipped, errors }
  }
}
