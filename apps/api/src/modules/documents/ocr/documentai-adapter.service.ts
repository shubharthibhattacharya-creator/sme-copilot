import { Injectable, Logger } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'
import type { NormalisedOcrResult } from './ocr-normaliser.service'

export interface DocumentAiResult {
  normalised: Partial<NormalisedOcrResult>
  fieldConfidences: Record<string, number>
  overallConfidence: number
  uncertainFields: string[]
  rawText: string
  durationMs: number
  costPaise: number
}

// Google Document AI processor IDs (configured per company env or global env)
// Prebuilt processors: https://cloud.google.com/document-ai/docs/processors-list
const PROCESSOR_IDS = {
  INVOICE:          'pretrained-invoice-parser',
  BANK_STATEMENT:   'pretrained-us-bank-statement-parser',   // works for IN banks too
  EXPENSE:          'pretrained-expense-parser',
  GENERAL_LAYOUT:   'pretrained-layout-parser',             // for GST returns, tables
}

// Cost per page in paise
const COST_PAISE = {
  INVOICE:        85,    // $0.01/page
  BANK_STATEMENT: 640,   // $0.075/document (flat, ~8 pages avg)
  EXPENSE:        85,
  GENERAL_LAYOUT: 85,
}

@Injectable()
export class DocumentAiAdapterService {
  private readonly logger = new Logger(DocumentAiAdapterService.name)
  private readonly client: DocumentProcessorServiceClient | null
  private readonly projectId: string
  private readonly location: string

  constructor(private readonly nestConfig: NestConfigService) {
    const credentialsJson = nestConfig.get<string>('GOOGLE_APPLICATION_CREDENTIALS_JSON')
    this.projectId = nestConfig.get<string>('GOOGLE_CLOUD_PROJECT_ID') ?? ''
    this.location  = nestConfig.get<string>('GOOGLE_CLOUD_LOCATION') ?? 'us'  // 'eu' or 'us' or 'asia'

    if (credentialsJson && this.projectId) {
      try {
        const credentials = JSON.parse(credentialsJson)
        this.client = new DocumentProcessorServiceClient({ credentials })
        this.logger.log(`Document AI client initialised (project: ${this.projectId}, location: ${this.location})`)
      } catch {
        this.client = null
        this.logger.warn('Document AI credentials JSON is invalid — DocumentAiAdapter disabled')
      }
    } else {
      this.client = null
      this.logger.warn('Google Cloud credentials not configured — DocumentAiAdapter disabled')
    }
  }

  get isAvailable(): boolean {
    return this.client !== null && !!this.projectId
  }

  /**
   * Process invoice using prebuilt Invoice Parser.
   * Returns structured fields with per-field confidence.
   */
  async processInvoice(fileBuffer: Buffer, mimeType: string): Promise<DocumentAiResult> {
    return this.processWithProcessor(fileBuffer, mimeType, 'INVOICE')
  }

  /**
   * Process bank statement using prebuilt Bank Statement Parser.
   * Returns transactions[], opening/closing balance.
   */
  async processBankStatement(fileBuffer: Buffer, mimeType: string): Promise<DocumentAiResult> {
    return this.processWithProcessor(fileBuffer, mimeType, 'BANK_STATEMENT')
  }

  /**
   * Process general document using Layout Parser.
   * Returns structured tables and text blocks for downstream interpretation.
   * Used for GST returns where no prebuilt parser exists.
   */
  async processLayout(fileBuffer: Buffer, mimeType: string): Promise<DocumentAiResult> {
    return this.processWithProcessor(fileBuffer, mimeType, 'GENERAL_LAYOUT')
  }

  private async processWithProcessor(
    fileBuffer: Buffer,
    mimeType: string,
    processorType: keyof typeof PROCESSOR_IDS,
  ): Promise<DocumentAiResult> {
    if (!this.client) throw new Error('Document AI not configured')

    const start = Date.now()
    const processorId = PROCESSOR_IDS[processorType]

    const processorName = `projects/${this.projectId}/locations/${this.location}/processors/${processorId}`

    const [result] = await this.client.processDocument({
      name:     processorName,
      rawDocument: {
        content:  fileBuffer.toString('base64'),
        mimeType: mimeType as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',
      },
    })

    const durationMs = Date.now() - start
    const doc = result.document
    const rawText = doc?.text ?? ''

    const normalised: Partial<NormalisedOcrResult> = {}
    const fieldConfidences: Record<string, number> = {}

    // Extract entities (prebuilt processors return structured entities)
    for (const entity of doc?.entities ?? []) {
      this.mapEntity(entity, normalised, fieldConfidences, processorType)
    }

    const criticalFields = ['invoiceNumber', 'invoiceDate', 'totalAmount', 'vendorName']
    const criticalScores = criticalFields
      .map(f => fieldConfidences[f])
      .filter((v): v is number => v !== undefined)

    const overallConfidence = criticalScores.length
      ? criticalScores.reduce((a, b) => a + b, 0) / criticalScores.length
      : 0.5

    const uncertainFields = Object.entries(fieldConfidences)
      .filter(([, c]) => c < 0.7)
      .map(([f]) => f)

    return {
      normalised,
      fieldConfidences,
      overallConfidence,
      uncertainFields,
      rawText,
      durationMs,
      costPaise: COST_PAISE[processorType],
    }
  }

  private mapEntity(
    entity: { type?: string | null; mentionText?: string | null; confidence?: number | null; properties?: unknown[] | null },
    out: Partial<NormalisedOcrResult>,
    confidences: Record<string, number>,
    processorType: string,
  ): void {
    const type  = (entity.type ?? '').toLowerCase()
    const value = entity.mentionText ?? ''
    const conf  = entity.confidence ?? 0.5

    const set = (key: keyof NormalisedOcrResult, val: unknown, c = conf) => {
      ;(out as Record<string, unknown>)[key] = val
      confidences[key] = c
    }

    // Invoice / Expense entity mapping
    if (processorType === 'INVOICE' || processorType === 'EXPENSE') {
      if (type.includes('invoice_id') || type.includes('invoice_number'))  set('invoiceNumber', value)
      if (type.includes('invoice_date') || type === 'date')                set('invoiceDate', value)
      if (type.includes('due_date'))                                        set('dueDate', value)
      if (type.includes('supplier_name') || type.includes('vendor_name'))  set('vendorName', value)
      if (type.includes('supplier_address'))                                set('vendorAddress', value)
      if (type.includes('receiver_name') || type.includes('customer'))     set('customerName', value)
      if (type.includes('net_amount') || type.includes('subtotal'))        set('taxableAmount', this.parseNum(value))
      if (type.includes('total_tax_amount') || type.includes('tax'))       set('totalTax', this.parseNum(value))
      if (type.includes('total_amount') || type === 'total')               set('totalAmount', this.parseNum(value))
      if (type.includes('gstin') && !out.vendorGstin)                      set('vendorGstin', value)
      if (type.includes('line_item')) {
        const existing = (out.lineItems as unknown[]) ?? []
        ;(out as Record<string, unknown>).lineItems = [...existing, { raw: value, confidence: conf }]
      }
    }

    // Bank statement entity mapping
    if (processorType === 'BANK_STATEMENT') {
      if (type.includes('start_balance') || type.includes('opening'))     set('openingBalance', this.parseNum(value))
      if (type.includes('end_balance') || type.includes('closing'))       set('closingBalance', this.parseNum(value))
      if (type.includes('account_number'))                                  set('accountNumber', value)
      if (type.includes('bank_name'))                                       set('bankName', value)
      if (type.includes('transaction')) {
        const existing = (out.transactions as unknown[]) ?? []
        ;(out as Record<string, unknown>).transactions = [...existing, {
          raw:        value,
          confidence: conf,
          ...this.parseTransaction(entity as { properties?: Array<{ type?: string | null; mentionText?: string | null }> | null }),
        }]
      }
    }

    // Layout parser — extract raw text blocks and tables for downstream Claude
    if (processorType === 'GENERAL_LAYOUT') {
      if (!out.rawLayoutText) {
        ;(out as Record<string, unknown>).rawLayoutText = value
      } else {
        ;(out as Record<string, unknown>).rawLayoutText =
          (out as Record<string, unknown>).rawLayoutText + '\n' + value
      }
    }
  }

  private parseTransaction(entity: { properties?: Array<{ type?: string | null; mentionText?: string | null }> | null }): Record<string, unknown> {
    const props: Record<string, unknown> = {}
    for (const prop of entity.properties ?? []) {
      const t = (prop.type ?? '').toLowerCase()
      const v = prop.mentionText ?? ''
      if (t.includes('date'))        props.date        = v
      if (t.includes('description')) props.description = v
      if (t.includes('amount'))      props.amount      = this.parseNum(v)
      if (t.includes('credit'))      props.type        = 'CREDIT'
      if (t.includes('debit'))       props.type        = 'DEBIT'
      if (t.includes('balance'))     props.balance     = this.parseNum(v)
    }
    return props
  }

  private parseNum(raw: string): number | null {
    const cleaned = raw.replace(/[₹,\s]/g, '').replace(/[^0-9.\-]/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
}
