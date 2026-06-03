import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Called after OCR completes for a CLIENT_PURCHASE_INVOICE document.
 * Extracts structured fields from extractedData and creates a PurchaseInvoice
 * record used for GSTR-2B reconciliation.
 */
@Injectable()
export class PurchaseInvoiceBridgeService {
  private readonly logger = new Logger(PurchaseInvoiceBridgeService.name)

  constructor(private readonly prisma: PrismaService) {}

  async bridge(documentId: string, companyId: string): Promise<void> {
    const doc = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId } })

    if (doc.documentType !== 'CLIENT_PURCHASE_INVOICE') return
    if (!['PROCESSED', 'NEEDS_REVIEW'].includes(doc.status as string)) return

    // Idempotent — skip if already created
    const existing = await this.prisma.purchaseInvoice.findUnique({ where: { documentId } })
    if (existing) return

    const raw = doc.extractedData as Record<string, unknown> | null

    const parseDecimal = (v: unknown): number | null => {
      if (v === null || v === undefined) return null
      const n = parseFloat(String(v).replace(/[₹,\s]/g, '').replace(/[^\d.]/g, ''))
      return isNaN(n) ? null : n
    }

    const parseDate = (v: unknown): Date | null => {
      if (!v || typeof v !== 'string') return null
      const d = new Date(v)
      return isNaN(d.getTime()) ? null : d
    }

    try {
      await this.prisma.purchaseInvoice.create({
        data: {
          companyId,
          documentId,
          clientId: doc.clientId ?? undefined,
          vendorName: (raw?.['vendorName'] as string | undefined) ?? null,
          vendorGstin: (raw?.['vendorGstin'] as string | undefined) ?? null,
          invoiceNumber: (raw?.['invoiceNumber'] as string | undefined) ?? null,
          invoiceDate: parseDate(raw?.['invoiceDate']),
          taxableAmount: parseDecimal(raw?.['amount']),
          igst: parseDecimal(raw?.['igst']),
          cgst: parseDecimal(raw?.['cgst']),
          sgst: parseDecimal(raw?.['sgst']),
          totalAmount: parseDecimal(raw?.['totalAmount']),
          filingPeriod: doc.filingPeriod ?? null,
        },
      })
      this.logger.log(`PurchaseInvoice created for document ${documentId}`)
    } catch (err) {
      this.logger.error(`Failed to create PurchaseInvoice for ${documentId}`, err)
    }
  }
}
