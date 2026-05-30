import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'

@Injectable()
export class DocumentToInvoiceService {
  private readonly logger = new Logger(DocumentToInvoiceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async bridge(documentId: string, companyId: string) {
    const doc = await this.prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      include: { client: true },
    })

    if (doc.documentPurpose !== 'RECEIVABLE') return null
    if (!['PROCESSED', 'NEEDS_REVIEW'].includes(doc.status as string)) return null
    if (doc.linkedInvoiceCreated) return null

    const extracted = doc.extractedData as Record<string, unknown> | null

    const rawAmount = String(extracted?.['totalAmount'] ?? extracted?.['amount'] ?? '0')
      .replace(/[₹,\s]/g, '').replace(/[^\d.]/g, '')
    const amount = parseFloat(rawAmount)
    const amountValid = !isNaN(amount) && amount > 0

    const client = await this.matchClient(
      extracted?.['buyerName'] as string | undefined,
      extracted?.['buyerGstin'] as string | undefined,
      companyId,
    )

    const paymentTermsRaw = await this.configService.get(companyId, ConfigKey.COLLECTIONS_DEFAULT_PAYMENT_TERMS_DAYS)
    const paymentTermsDays = parseInt(paymentTermsRaw as string) || 30

    const invoiceDateRaw = extracted?.['invoiceDate'] as string | undefined
    const invoiceDate = invoiceDateRaw ? new Date(invoiceDateRaw) : new Date()
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + paymentTermsDays)

    const customerName = (extracted?.['buyerName'] as string | undefined) ?? client?.name ?? 'Unknown client'

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        clientId: client?.id ?? null,
        customerName,
        customerPhone: client?.phone ?? null,
        amount: amountValid ? amount : 0,
        currency: 'INR',
        dueDate,
        status: 'PENDING',
        sourceDocumentId: documentId,
        createdFromOcr: true,
        invoiceNumber: (extracted?.['invoiceNumber'] as string | undefined) ?? null,
        invoiceDate,
        clientName: customerName,
        description: amountValid ? 'Professional services' : 'Amount could not be read from PDF — please update manually',
      },
    })

    await this.prisma.document.update({
      where: { id: documentId },
      data: { linkedInvoiceId: invoice.id, linkedInvoiceCreated: true },
    })

    // Use the exact AuditLog fields from the schema: companyId, userId, action, entity, entityId, metadata
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId: doc.uploadedById,
          action: 'INVOICE_CREATED_FROM_OCR',
          entity: 'invoice',
          entityId: invoice.id,
          metadata: { invoiceId: invoice.id, documentId, customerName },
        },
      })
    } catch {
      // Audit log is non-critical
    }

    this.logger.log(`Invoice ${invoice.id} created from document ${documentId}`)
    return invoice
  }

  private async matchClient(buyerName: string | undefined, buyerGstin: string | undefined, companyId: string) {
    if (buyerGstin) {
      const byGstin = await this.prisma.client.findFirst({ where: { gstin: buyerGstin, companyId } })
      if (byGstin) return byGstin
    }
    if (buyerName) {
      const byName = await this.prisma.client.findFirst({
        where: { name: { equals: buyerName, mode: 'insensitive' }, companyId },
      })
      if (byName) return byName
    }
    return null
  }
}
