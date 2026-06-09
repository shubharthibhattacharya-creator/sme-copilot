import { Injectable, Logger } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import {
  TextractClient,
  AnalyzeExpenseCommand,
  DetectDocumentTextCommand,
  type ExpenseField,
  type LineItemGroup,
} from '@aws-sdk/client-textract'
import type { NormalisedOcrResult } from './ocr-normaliser.service'

export interface TextractResult {
  raw: Record<string, unknown>
  normalised: Partial<NormalisedOcrResult>
  fieldConfidences: Record<string, number>
  overallConfidence: number
  uncertainFields: string[]
  durationMs: number
  costPaise: number    // ₹0.85/page = 85 paise
}

const COST_PAISE_PER_PAGE_EXPENSE = 85   // $0.01 = ~₹0.85
const COST_PAISE_PER_PAGE_DETECT  = 13   // $0.0015 = ~₹0.13

@Injectable()
export class TextractAdapterService {
  private readonly logger = new Logger(TextractAdapterService.name)
  private readonly client: TextractClient | null

  constructor(private readonly nestConfig: NestConfigService) {
    const accessKeyId     = nestConfig.get<string>('AWS_ACCESS_KEY_ID') ?? nestConfig.get<string>('S3_ACCESS_KEY_ID')
    const secretAccessKey = nestConfig.get<string>('AWS_SECRET_ACCESS_KEY') ?? nestConfig.get<string>('S3_SECRET_ACCESS_KEY')
    const region          = nestConfig.get<string>('AWS_TEXTRACT_REGION') ?? 'ap-south-1'

    if (accessKeyId && secretAccessKey) {
      this.client = new TextractClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      })
      this.logger.log(`Textract client initialised (region: ${region})`)
    } else {
      this.client = null
      this.logger.warn('Textract credentials not configured — TextractAdapter disabled')
    }
  }

  get isAvailable(): boolean {
    return this.client !== null
  }

  /**
   * Analyze Expense — for INVOICE, EXPENSE, PURCHASE_INVOICE document types.
   * Returns structured fields: vendor, GSTIN, amounts, line items, tax.
   * Cost: ₹0.85/page (ap-south-1)
   */
  async analyzeExpense(fileBuffer: Buffer, mimeType: string): Promise<TextractResult> {
    if (!this.client) throw new Error('Textract not configured')
    const start = Date.now()

    const command = new AnalyzeExpenseCommand({
      Document: { Bytes: fileBuffer },
    })

    const response = await this.client.send(command)
    const durationMs = Date.now() - start
    const pageCount  = response.ExpenseDocuments?.length ?? 1
    const costPaise  = pageCount * COST_PAISE_PER_PAGE_EXPENSE

    const fieldConfidences: Record<string, number> = {}
    const normalised: Partial<NormalisedOcrResult>  = {}
    const lineItems: Array<Record<string, unknown>> = []

    for (const expDoc of response.ExpenseDocuments ?? []) {
      // Summary fields
      for (const field of expDoc.SummaryFields ?? []) {
        this.mapExpenseField(field, normalised, fieldConfidences)
      }
      // Line items
      for (const group of expDoc.LineItemGroups ?? []) {
        lineItems.push(...this.mapLineItems(group))
      }
    }

    if (lineItems.length) normalised.lineItems = lineItems

    // Compute overall confidence as mean of critical fields
    const criticalFields = ['invoiceNumber', 'invoiceDate', 'totalAmount', 'vendorGstin', 'taxableAmount']
    const criticalScores = criticalFields
      .map(f => fieldConfidences[f])
      .filter((v): v is number => v !== undefined)

    const overallConfidence = criticalScores.length
      ? criticalScores.reduce((a, b) => a + b, 0) / criticalScores.length / 100
      : 0.5

    const uncertainFields = Object.entries(fieldConfidences)
      .filter(([, conf]) => conf < 70)
      .map(([field]) => field)

    return {
      raw:               response as unknown as Record<string, unknown>,
      normalised,
      fieldConfidences,
      overallConfidence,
      uncertainFields,
      durationMs,
      costPaise,
    }
  }

  /**
   * Detect Document Text — for identity documents, certificates.
   * Returns raw text only (no structured extraction).
   * Cost: ₹0.13/page (ap-south-1)
   */
  async detectText(fileBuffer: Buffer): Promise<{ rawText: string; confidence: number; durationMs: number; costPaise: number }> {
    if (!this.client) throw new Error('Textract not configured')
    const start = Date.now()

    const response = await this.client.send(
      new DetectDocumentTextCommand({ Document: { Bytes: fileBuffer } })
    )

    const lines = (response.Blocks ?? [])
      .filter(b => b.BlockType === 'LINE')
      .map(b => b.Text ?? '')

    const confidences = (response.Blocks ?? [])
      .filter(b => b.BlockType === 'LINE' && b.Confidence !== undefined)
      .map(b => b.Confidence!)

    const rawText   = lines.join('\n')
    const confidence = confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
      : 0.5

    return {
      rawText,
      confidence,
      durationMs: Date.now() - start,
      costPaise:  COST_PAISE_PER_PAGE_DETECT,
    }
  }

  // ─── Field mappers ─────────────────────────────────────────────────────────

  private mapExpenseField(
    field: ExpenseField,
    out: Partial<NormalisedOcrResult>,
    confidences: Record<string, number>,
  ): void {
    const type  = field.Type?.Text?.toUpperCase() ?? ''
    const value = field.ValueDetection?.Text ?? ''
    const conf  = field.ValueDetection?.Confidence ?? 0

    const set = (key: keyof NormalisedOcrResult, val: unknown, c = conf) => {
      ;(out as Record<string, unknown>)[key] = val
      confidences[key] = c
    }

    switch (type) {
      case 'INVOICE_RECEIPT_ID':
      case 'INVOICE_NUMBER':
        set('invoiceNumber', value)
        break
      case 'INVOICE_RECEIPT_DATE':
      case 'DATE':
        set('invoiceDate', value)
        break
      case 'VENDOR_NAME':
      case 'SUPPLIER_NAME':
        set('vendorName', value)
        break
      case 'VENDOR_ADDRESS':
        set('vendorAddress', value)
        break
      case 'RECEIVER_NAME':
      case 'CUSTOMER_NAME':
        set('customerName', value)
        break
      case 'SUBTOTAL':
      case 'TAXABLE_AMOUNT':
        set('taxableAmount', this.parseAmount(value))
        break
      case 'TAX':
      case 'GST':
        set('totalTax', this.parseAmount(value))
        break
      case 'TOTAL':
      case 'AMOUNT_DUE':
        set('totalAmount', this.parseAmount(value))
        break
      case 'DUE_DATE':
      case 'PAYMENT_DUE_DATE':
        set('dueDate', value)
        break
      case 'GST_NUMBER':
      case 'VENDOR_GSTIN':
      case 'GSTIN':
        if (!out.vendorGstin) set('vendorGstin', value)
        break
      case 'CUSTOMER_GSTIN':
      case 'BUYER_GSTIN':
        set('customerGstin', value)
        break
      case 'PAN':
      case 'PAN_NUMBER':
        set('pan', value)
        break
    }
  }

  private mapLineItems(group: LineItemGroup): Array<Record<string, unknown>> {
    return (group.LineItems ?? []).map(item => {
      const obj: Record<string, unknown> = {}
      for (const field of item.LineItemExpenseFields ?? []) {
        const type  = field.Type?.Text?.toUpperCase() ?? ''
        const value = field.ValueDetection?.Text ?? ''
        if (type === 'ITEM')        obj.description = value
        if (type === 'QUANTITY')    obj.quantity     = value
        if (type === 'UNIT_PRICE')  obj.unitPrice    = this.parseAmount(value)
        if (type === 'PRICE')       obj.amount        = this.parseAmount(value)
        if (type === 'EXPENSE_ROW') obj.raw           = value
      }
      return obj
    })
  }

  private parseAmount(raw: string): number | null {
    const cleaned = raw.replace(/[₹,\s]/g, '').replace(/[^0-9.]/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
}
