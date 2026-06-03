import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@opsc/database'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import type { Gstr2bLineItem, PurchaseInvoice } from '@opsc/database'

type ReconStatus = 'MATCHED' | 'POSSIBLE_MATCH' | 'NOT_IN_VAULT' | 'NOT_IN_GSTR2B'

interface MatchResult {
  lineItemId: string | null
  purchaseInvoiceId: string | null
  status: ReconStatus
  matchScore: number
  remarks: Record<string, unknown>
}

@Injectable()
export class ReconciliationMatchingService {
  private readonly logger = new Logger(ReconciliationMatchingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async matchUpload(uploadId: string, companyId: string): Promise<void> {
    const toleranceTypeRaw = await this.configService.get(companyId, ConfigKey.RECON_TOLERANCE_TYPE)
    const toleranceValueRaw = await this.configService.get(companyId, ConfigKey.RECON_TOLERANCE_VALUE)
    const toleranceType = (toleranceTypeRaw as string) || 'PERCENTAGE'
    const toleranceValue = parseFloat((toleranceValueRaw as string) || '5')

    const lineItems = await this.prisma.gstr2bLineItem.findMany({ where: { uploadId } })

    // Load purchase invoices for this company (optionally filter by filing period)
    const upload = await this.prisma.gstr2bUpload.findUniqueOrThrow({ where: { id: uploadId } })
    const purchaseInvoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        ...(upload.filingPeriod ? { filingPeriod: upload.filingPeriod } : {}),
      },
    })

    const matchResults: MatchResult[] = []
    const matchedPiIds = new Set<string>()

    for (const lineItem of lineItems) {
      const result = this.matchLineItem(lineItem, purchaseInvoices, toleranceType, toleranceValue)
      matchResults.push(result)
      if (result.purchaseInvoiceId) matchedPiIds.add(result.purchaseInvoiceId)
    }

    // Purchase invoices not matched to any GSTR-2B line → NOT_IN_GSTR2B
    for (const pi of purchaseInvoices) {
      if (!matchedPiIds.has(pi.id)) {
        matchResults.push({
          lineItemId: null,
          purchaseInvoiceId: pi.id,
          status: 'NOT_IN_GSTR2B',
          matchScore: 0,
          remarks: { reason: 'Purchase invoice not found in GSTR-2B' },
        })
      }
    }

    // Persist results
    await this.prisma.$transaction(async (tx) => {
      for (const r of matchResults) {
        await tx.reconciliationResult.create({
          data: {
            uploadId,
            companyId,
            lineItemId: r.lineItemId ?? undefined,
            purchaseInvoiceId: r.purchaseInvoiceId ?? undefined,
            status: r.status as any,
            matchScore: r.matchScore,
            remarks: r.remarks as Prisma.InputJsonValue,
          },
        })
      }
    })

    // Update summary counts on the upload
    const counts = matchResults.reduce(
      (acc, r) => {
        if (r.status === 'MATCHED') acc.matched++
        else if (r.status === 'POSSIBLE_MATCH') acc.possible++
        else if (r.status === 'NOT_IN_VAULT') acc.notInVault++
        else if (r.status === 'NOT_IN_GSTR2B') acc.notInGstr2b++
        return acc
      },
      { matched: 0, possible: 0, notInVault: 0, notInGstr2b: 0 },
    )

    await this.prisma.gstr2bUpload.update({
      where: { id: uploadId },
      data: {
        matchedCount: counts.matched,
        possibleCount: counts.possible,
        notInVaultCount: counts.notInVault,
        notInGstr2bCount: counts.notInGstr2b,
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    })

    this.logger.log(
      `Reconciliation complete for upload ${uploadId}: ${counts.matched} matched, ${counts.possible} possible, ${counts.notInVault} not in vault, ${counts.notInGstr2b} not in GSTR-2B`,
    )
  }

  private matchLineItem(
    lineItem: Gstr2bLineItem,
    purchaseInvoices: PurchaseInvoice[],
    toleranceType: string,
    toleranceValue: number,
  ): MatchResult {
    const normalise = (s: string | null | undefined) =>
      (s ?? '').toUpperCase().trim().replace(/\s+/g, '')

    const lineGstin = normalise(lineItem.vendorGstin)
    const lineInvoice = normalise(lineItem.invoiceNumber)
    const lineAmount = lineItem.totalAmount ? Number(lineItem.totalAmount) : null

    // Pass 1: Exact GSTIN + invoice number
    if (lineGstin && lineInvoice) {
      const exact = purchaseInvoices.find(
        (pi) =>
          normalise(pi.vendorGstin) === lineGstin &&
          normalise(pi.invoiceNumber) === lineInvoice,
      )
      if (exact) {
        return {
          lineItemId: lineItem.id,
          purchaseInvoiceId: exact.id,
          status: 'MATCHED',
          matchScore: 1.0,
          remarks: { matchedOn: ['gstin', 'invoiceNumber'] },
        }
      }
    }

    // Pass 2: GSTIN + amount within tolerance
    if (lineGstin && lineAmount !== null) {
      const gstinCandidates = purchaseInvoices.filter(
        (pi) => normalise(pi.vendorGstin) === lineGstin,
      )
      for (const pi of gstinCandidates) {
        const piAmount = pi.totalAmount ? Number(pi.totalAmount) : null
        if (piAmount !== null && this.withinTolerance(lineAmount, piAmount, toleranceType, toleranceValue)) {
          const diff = Math.abs(lineAmount - piAmount)
          return {
            lineItemId: lineItem.id,
            purchaseInvoiceId: pi.id,
            status: 'POSSIBLE_MATCH',
            matchScore: 0.8,
            remarks: {
              matchedOn: ['gstin', 'amount'],
              amountDiff: diff,
              lineAmount,
              vaultAmount: piAmount,
            },
          }
        }
      }
    }

    // Pass 3: Invoice number only (without GSTIN — useful when GSTIN missing from vault)
    if (lineInvoice) {
      const byInvoice = purchaseInvoices.find(
        (pi) => normalise(pi.invoiceNumber) === lineInvoice,
      )
      if (byInvoice) {
        return {
          lineItemId: lineItem.id,
          purchaseInvoiceId: byInvoice.id,
          status: 'POSSIBLE_MATCH',
          matchScore: 0.65,
          remarks: { matchedOn: ['invoiceNumber'], note: 'GSTIN not confirmed' },
        }
      }
    }

    return {
      lineItemId: lineItem.id,
      purchaseInvoiceId: null,
      status: 'NOT_IN_VAULT',
      matchScore: 0,
      remarks: { reason: 'No matching purchase invoice found in vault' },
    }
  }

  private withinTolerance(a: number, b: number, type: string, value: number): boolean {
    if (type === 'FIXED') return Math.abs(a - b) <= value
    const pct = Math.abs(a - b) / Math.max(Math.abs(a), 1) * 100
    return pct <= value
  }
}
