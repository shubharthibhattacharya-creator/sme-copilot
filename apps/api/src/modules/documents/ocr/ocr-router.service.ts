import { Injectable, Logger } from '@nestjs/common'
import type { DocumentType } from '@opsc/database'
import { TesseractPrescreenerService } from './tesseract-prescreener.service'
import { TextractAdapterService } from './textract-adapter.service'
import { DocumentAiAdapterService } from './documentai-adapter.service'
import { OcrNormaliserService, type NormalisedOcrResult, type OcrEngine } from './ocr-normaliser.service'
import { AiService } from '../../ai/ai.service'

export interface OcrAuditLog {
  tesseract?:          { confidence: number; quality: string; durationMs: number }
  routedTo:            string
  routingReason:       string
  primaryEngine?:      { name: OcrEngine; confidence: number; durationMs: number; costPaise: number; uncertainFields: string[] }
  claudeEscalation?:   { reason: string; fields?: string[]; durationMs: number; costPaise: number }
  finalEngine:         OcrEngine
  totalCostPaise:      number
  totalDurationMs:     number
}

export interface RouterResult {
  extracted:    NormalisedOcrResult
  auditLog:     OcrAuditLog
  scanQuality:  string
}

// Document types that go to AWS Textract Analyze Expense
const TEXTRACT_EXPENSE_TYPES: DocumentType[] = [
  'INVOICE',
  'CLIENT_SALES_INVOICE',
  'CLIENT_PURCHASE_INVOICE',
  'PURCHASE_ORDER',
]

// Document types that go to Google Document AI Bank Statement Parser
const DOCAI_BANK_TYPES: DocumentType[] = ['BANK_STATEMENT']

// Document types that go to Google Document AI Layout Parser (for table extraction)
// then Claude interprets the structure
const DOCAI_LAYOUT_TYPES: DocumentType[] = [
  'GST_RETURN',
  'TDS_CERTIFICATE',
]

// Document types that only need basic text detection (regex extraction)
// FORM_16 is a TDS certificate for salary — regex picks up PAN, deductor name
// OTHER covers PAN cards, GSTIN certificates, incorporation docs, etc.
const BASIC_TEXT_TYPES: DocumentType[] = [
  'FORM_16',
  'OTHER',
]

// Document types to archive without deep OCR
// DELIVERY_NOTE is a logistics document — we store it but don't extract financial data
const ARCHIVE_TYPES: DocumentType[] = [
  'DELIVERY_NOTE',
]

// Claude OCR cost estimate in paise per page
const CLAUDE_COST_PAISE_PER_PAGE = 500  // ~₹5 avg per page

@Injectable()
export class OcrRouterService {
  private readonly logger = new Logger(OcrRouterService.name)

  constructor(
    private readonly prescreener:   TesseractPrescreenerService,
    private readonly textract:       TextractAdapterService,
    private readonly documentAi:     DocumentAiAdapterService,
    private readonly normaliser:     OcrNormaliserService,
    private readonly aiService:      AiService,
  ) {}

  async route(
    fileBuffer:   Buffer,
    mimeType:     string,
    documentType: DocumentType,
  ): Promise<RouterResult> {
    const overallStart = Date.now()
    const auditLog: OcrAuditLog = {
      routedTo:      '',
      routingReason: '',
      finalEngine:   'CLAUDE',
      totalCostPaise: 0,
      totalDurationMs: 0,
    }

    // ── Step 1: Archive check ──────────────────────────────────────────────
    if (ARCHIVE_TYPES.includes(documentType)) {
      auditLog.routedTo      = 'ARCHIVE'
      auditLog.routingReason = 'Document type is archival — OCR skipped'
      auditLog.finalEngine   = 'TESSERACT'
      auditLog.totalDurationMs = Date.now() - overallStart
      return {
        extracted: this.normaliser.wrap(
          { rawLayoutText: 'Archived without OCR' },
          'TESSERACT', 0.0, 0,
        ),
        auditLog,
        scanQuality: 'HIGH',
      }
    }

    // ── Step 2: Tesseract pre-screen (free) ────────────────────────────────
    const prescreen = await this.prescreener.prescreen(fileBuffer, mimeType)
    auditLog.tesseract = {
      confidence: prescreen.confidence,
      quality:    prescreen.quality,
      durationMs: prescreen.durationMs,
    }

    const scanQuality = prescreen.quality

    // Unreadable file — abort early, save all OCR cost
    if (prescreen.quality === 'UNREADABLE') {
      auditLog.routedTo      = 'NONE'
      auditLog.routingReason = 'File is blank or corrupted — no text detected'
      auditLog.finalEngine   = 'TESSERACT'
      auditLog.totalDurationMs = Date.now() - overallStart
      return {
        extracted: this.normaliser.wrap(
          { rawLayoutText: '' },
          'TESSERACT', 0.0, 0,
        ),
        auditLog,
        scanQuality,
      }
    }

    // Poor quality scan → Claude is the only engine that handles it well
    if (prescreen.quality === 'POOR') {
      auditLog.routedTo      = 'CLAUDE'
      auditLog.routingReason = 'Poor scan quality — routing directly to Claude Vision'
      return this.runClaude(fileBuffer, mimeType, documentType, auditLog, scanQuality, overallStart)
    }

    // ── Step 3: Route by document type ────────────────────────────────────

    // Basic text types — Google Vision / Textract detect-only + regex
    if (BASIC_TEXT_TYPES.includes(documentType)) {
      auditLog.routedTo      = 'TEXTRACT_DETECT'
      auditLog.routingReason = `Identity/certificate document — basic text detection only`
      return this.runBasicText(fileBuffer, mimeType, documentType, prescreen.rawText, auditLog, scanQuality, overallStart)
    }

    // Bank statements → Document AI Bank Statement Parser
    if (DOCAI_BANK_TYPES.includes(documentType) && this.documentAi.isAvailable) {
      auditLog.routedTo      = 'DOCUMENT_AI_BANK'
      auditLog.routingReason = 'Bank statement — Google Document AI Bank Statement Parser'
      return this.runDocumentAiBank(fileBuffer, mimeType, auditLog, scanQuality, overallStart)
    }

    // GST returns → Document AI Layout + Claude text interpretation
    if (DOCAI_LAYOUT_TYPES.includes(documentType) && this.documentAi.isAvailable) {
      auditLog.routedTo      = 'DOCUMENT_AI_LAYOUT+CLAUDE_TEXT'
      auditLog.routingReason = 'GST/TDS return — layout extraction then Claude interpretation'
      return this.runLayoutPlusClaude(fileBuffer, mimeType, documentType, auditLog, scanQuality, overallStart)
    }

    // Invoice types → AWS Textract Analyze Expense (primary)
    if (TEXTRACT_EXPENSE_TYPES.includes(documentType) && this.textract.isAvailable) {
      auditLog.routedTo      = 'TEXTRACT_EXPENSE'
      auditLog.routingReason = 'Invoice/expense document — AWS Textract Analyze Expense'
      return this.runTextractExpense(fileBuffer, mimeType, documentType, auditLog, scanQuality, overallStart)
    }

    // Fallback — Claude handles everything else (or when cloud adapters not configured)
    auditLog.routedTo      = 'CLAUDE'
    auditLog.routingReason = 'No specialist engine available or applicable — Claude Vision fallback'
    return this.runClaude(fileBuffer, mimeType, documentType, auditLog, scanQuality, overallStart)
  }

  // ── Engine runners ─────────────────────────────────────────────────────────

  private async runTextractExpense(
    fileBuffer:   Buffer,
    mimeType:     string,
    documentType: DocumentType,
    auditLog:     OcrAuditLog,
    scanQuality:  string,
    start:        number,
  ): Promise<RouterResult> {
    const result = await this.textract.analyzeExpense(fileBuffer, mimeType)

    auditLog.primaryEngine = {
      name:           'TEXTRACT',
      confidence:     result.overallConfidence,
      durationMs:     result.durationMs,
      costPaise:      result.costPaise,
      uncertainFields: result.uncertainFields,
    }

    // If uncertain fields exist, escalate just those fields to Claude
    if (result.uncertainFields.length > 0 && result.overallConfidence >= 0.60) {
      const escalated = await this.escalateFields(
        fileBuffer, mimeType, documentType,
        result.uncertainFields, result.normalised, auditLog,
      )
      const merged = this.normaliser.merge([
        { data: result.normalised, engine: 'TEXTRACT', confidence: result.overallConfidence },
        { data: escalated.data,    engine: 'CLAUDE',   confidence: escalated.confidence },
      ])
      auditLog.finalEngine    = 'HYBRID'
      auditLog.totalCostPaise = result.costPaise + (escalated.costPaise ?? 0)
      auditLog.totalDurationMs = Date.now() - start
      return { extracted: merged, auditLog, scanQuality }
    }

    // Low overall confidence → full Claude escalation
    if (result.overallConfidence < 0.60) {
      this.logger.warn(`Textract confidence ${result.overallConfidence} too low — escalating to Claude`)
      auditLog.routedTo      = 'TEXTRACT→CLAUDE'
      auditLog.routingReason += ' | Textract confidence too low — escalated to Claude'
      return this.runClaude(fileBuffer, mimeType, documentType, auditLog, scanQuality, start, result.costPaise)
    }

    const extracted = this.normaliser.wrap(result.normalised, 'TEXTRACT', result.overallConfidence, result.costPaise)
    auditLog.finalEngine    = 'TEXTRACT'
    auditLog.totalCostPaise = result.costPaise
    auditLog.totalDurationMs = Date.now() - start
    return { extracted, auditLog, scanQuality }
  }

  private async runDocumentAiBank(
    fileBuffer:  Buffer,
    mimeType:    string,
    auditLog:    OcrAuditLog,
    scanQuality: string,
    start:       number,
  ): Promise<RouterResult> {
    const result = await this.documentAi.processBankStatement(fileBuffer, mimeType)

    auditLog.primaryEngine = {
      name:            'DOCUMENT_AI',
      confidence:      result.overallConfidence,
      durationMs:      result.durationMs,
      costPaise:       result.costPaise,
      uncertainFields: result.uncertainFields,
    }

    const extracted = this.normaliser.wrap(result.normalised, 'DOCUMENT_AI', result.overallConfidence, result.costPaise)
    auditLog.finalEngine    = 'DOCUMENT_AI'
    auditLog.totalCostPaise = result.costPaise
    auditLog.totalDurationMs = Date.now() - start
    return { extracted, auditLog, scanQuality }
  }

  private async runLayoutPlusClaude(
    fileBuffer:   Buffer,
    mimeType:     string,
    documentType: DocumentType,
    auditLog:     OcrAuditLog,
    scanQuality:  string,
    start:        number,
  ): Promise<RouterResult> {
    // Step A: Layout Parser extracts tables as structured text
    const layout = await this.documentAi.processLayout(fileBuffer, mimeType)

    auditLog.primaryEngine = {
      name:            'DOCUMENT_AI',
      confidence:      layout.overallConfidence,
      durationMs:      layout.durationMs,
      costPaise:       layout.costPaise,
      uncertainFields: [],
    }

    // Step B: Claude interprets the structured text (cheap text call, no vision)
    const structuredText = layout.normalised.rawLayoutText ?? layout.rawText
    const claudeStart    = Date.now()

    let claudeData: Record<string, unknown> = {}
    let claudeCost = 100  // ~₹1 for text-only call

    try {
      claudeData = await this.aiService.extractFromStructuredText(
        structuredText,
        documentType,
      )
    } catch (err) {
      this.logger.warn(`Claude text interpretation failed — using layout-only result: ${err}`)
      claudeCost = 0
    }

    auditLog.claudeEscalation = {
      reason:    'GST return — Claude interprets layout-extracted text',
      durationMs: Date.now() - claudeStart,
      costPaise:  claudeCost,
    }

    const merged = this.normaliser.merge([
      { data: layout.normalised, engine: 'DOCUMENT_AI', confidence: layout.overallConfidence },
      { data: claudeData as Partial<NormalisedOcrResult>, engine: 'CLAUDE', confidence: (claudeData['confidence'] as number | undefined) ?? 0.8 },
    ])

    auditLog.finalEngine    = 'HYBRID'
    auditLog.totalCostPaise = layout.costPaise + claudeCost
    auditLog.totalDurationMs = Date.now() - start
    return { extracted: merged, auditLog, scanQuality }
  }

  private async runBasicText(
    fileBuffer:   Buffer,
    mimeType:     string,
    documentType: DocumentType,
    tesseractText: string,
    auditLog:     OcrAuditLog,
    scanQuality:  string,
    start:        number,
  ): Promise<RouterResult> {
    // For clean documents use Textract detect (cheaper), else use Tesseract raw text
    let rawText = tesseractText
    let costPaise = 0
    let confidence = 0.85

    if (this.textract.isAvailable && scanQuality !== 'POOR') {
      try {
        const detect = await this.textract.detectText(fileBuffer)
        rawText   = detect.rawText
        costPaise = detect.costPaise
        confidence = detect.confidence
      } catch {
        // Tesseract text already available as fallback
      }
    }

    // Regex extraction for known patterns
    const extracted = this.extractIdentityFields(rawText, documentType)

    const result = this.normaliser.wrap(
      { ...extracted, rawLayoutText: rawText },
      costPaise > 0 ? 'TEXTRACT' : 'TESSERACT',
      confidence,
      costPaise,
    )

    auditLog.finalEngine    = result.extractedBy
    auditLog.totalCostPaise = costPaise
    auditLog.totalDurationMs = Date.now() - start
    return { extracted: result, auditLog, scanQuality }
  }

  private async runClaude(
    fileBuffer:   Buffer,
    mimeType:     string,
    documentType: DocumentType,
    auditLog:     OcrAuditLog,
    scanQuality:  string,
    start:        number,
    priorCostPaise = 0,
  ): Promise<RouterResult> {
    const claudeStart = Date.now()
    const base64      = fileBuffer.toString('base64')

    const claudeData = await this.aiService.extractDocumentData(base64, mimeType, documentType)
    const confidence = typeof claudeData['confidence'] === 'number' ? claudeData['confidence'] : 0.5
    const durationMs = Date.now() - claudeStart
    const costPaise  = CLAUDE_COST_PAISE_PER_PAGE

    auditLog.claudeEscalation = {
      reason:    auditLog.routingReason,
      durationMs,
      costPaise,
    }
    auditLog.finalEngine    = 'CLAUDE'
    auditLog.totalCostPaise = priorCostPaise + costPaise
    auditLog.totalDurationMs = Date.now() - start

    const extracted = this.normaliser.wrap(
      claudeData as Partial<NormalisedOcrResult>,
      'CLAUDE',
      confidence,
      priorCostPaise + costPaise,
    )
    return { extracted, auditLog, scanQuality }
  }

  // ── Field-level escalation ─────────────────────────────────────────────────

  /**
   * Send only the uncertain fields to Claude for targeted correction.
   * Much cheaper than a full-page Claude call.
   */
  private async escalateFields(
    fileBuffer:      Buffer,
    mimeType:        string,
    documentType:    DocumentType,
    uncertainFields: string[],
    existingData:    Partial<NormalisedOcrResult>,
    auditLog:        OcrAuditLog,
  ): Promise<{ data: Partial<NormalisedOcrResult>; confidence: number; costPaise: number }> {
    const claudeStart = Date.now()
    const base64      = fileBuffer.toString('base64')

    let claudeResult: Record<string, unknown> = {}
    const costPaise = Math.max(50, uncertainFields.length * 30)  // ~₹0.30 per uncertain field

    try {
      claudeResult = await this.aiService.extractSpecificFields(
        base64,
        mimeType,
        documentType,
        uncertainFields,
      )
    } catch (err) {
      this.logger.warn(`Field-level Claude escalation failed: ${err}`)
    }

    const durationMs = Date.now() - claudeStart
    auditLog.claudeEscalation = {
      reason:    'Field-level escalation for uncertain fields',
      fields:    uncertainFields,
      durationMs,
      costPaise,
    }

    const confidence = (claudeResult['confidence'] as number | undefined) ?? 0.9
    return {
      data:       claudeResult as Partial<NormalisedOcrResult>,
      confidence,
      costPaise,
    }
  }

  // ── Identity field extraction via regex ───────────────────────────────────

  private extractIdentityFields(
    rawText:      string,
    documentType: DocumentType,
  ): Partial<NormalisedOcrResult> {
    const out: Partial<NormalisedOcrResult> = {}

    const gstinMatch = rawText.match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/g)
    if (gstinMatch?.length) out.gstin = gstinMatch[0]

    const panMatch = rawText.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/g)
    if (panMatch?.length) out.panNumber = panMatch[0]

    const nameMatch = rawText.match(/(?:Name|GSTIN of|Legal Name|Trade Name)[:\s]+([A-Z][A-Za-z\s&.]+)/i)
    if (nameMatch?.[1]) out.entityName = nameMatch[1].trim()

    return out
  }
}
