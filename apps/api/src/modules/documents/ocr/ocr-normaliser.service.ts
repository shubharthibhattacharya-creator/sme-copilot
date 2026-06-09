import { Injectable } from '@nestjs/common'

export type OcrEngine = 'CLAUDE' | 'TEXTRACT' | 'DOCUMENT_AI' | 'TESSERACT' | 'HYBRID'

/**
 * Unified extraction schema — identical regardless of which engine ran.
 * All downstream code (invoice bridge, recon, checklist) uses this.
 */
export interface NormalisedOcrResult {
  // ── Metadata ──────────────────────────────────────────────────────────────
  extractedBy:        OcrEngine
  overallConfidence:  number           // 0.0 – 1.0
  uncertainFields:    string[]         // field names with confidence < 0.70
  extractedAt:        string           // ISO datetime

  // ── Invoice / Expense fields ──────────────────────────────────────────────
  invoiceNumber?:     string
  invoiceDate?:       string
  dueDate?:           string
  vendorName?:        string
  vendorAddress?:     string
  vendorGstin?:       string
  customerName?:      string
  customerGstin?:     string
  pan?:               string
  taxableAmount?:     number | null
  cgst?:              number | null
  sgst?:              number | null
  igst?:              number | null
  cess?:              number | null
  totalTax?:          number | null
  totalAmount?:       number | null
  lineItems?:         Array<Record<string, unknown>>

  // ── GST Return fields ─────────────────────────────────────────────────────
  gstrType?:              string       // GSTR-1, GSTR-3B, GSTR-2B, GSTR-9
  filingPeriod?:          string       // "Nov 2024"
  totalOutwardSupply?:    number | null
  taxableTurnover?:       number | null
  itcClaimed?:            number | null
  netTaxPayable?:         number | null
  totalTaxLiability?:     number | null

  // ── Bank Statement fields ─────────────────────────────────────────────────
  accountNumber?:     string
  bankName?:          string
  openingBalance?:    number | null
  closingBalance?:    number | null
  transactions?:      Array<Record<string, unknown>>

  // ── Identity Document fields ──────────────────────────────────────────────
  panNumber?:         string
  gstin?:             string
  aadharNumber?:      string
  entityName?:        string

  // ── Layout (raw for downstream Claude interpretation) ─────────────────────
  rawLayoutText?:     string

  // ── Confidence per field (for partial review UI) ──────────────────────────
  fieldConfidences?:  Record<string, number>

  // ── Cost tracking ─────────────────────────────────────────────────────────
  costPaise?:         number
}

@Injectable()
export class OcrNormaliserService {
  /**
   * Merge partial results from multiple engines into one NormalisedOcrResult.
   * Later engines' fields override earlier ones only if confidence is higher.
   */
  merge(
    parts: Array<{ data: Partial<NormalisedOcrResult>; engine: OcrEngine; confidence: number }>,
  ): NormalisedOcrResult {
    const merged: Partial<NormalisedOcrResult> = {}
    const allConfidences: Record<string, number> = {}
    let totalCost = 0
    let engines: OcrEngine[] = []

    for (const { data, engine, confidence } of parts) {
      engines.push(engine)
      if (data.costPaise) totalCost += data.costPaise

      for (const [key, value] of Object.entries(data)) {
        if (key === 'extractedBy' || key === 'extractedAt' || key === 'costPaise') continue

        const existingConf = allConfidences[key] ?? 0
        const incomingConf = data.fieldConfidences?.[key] ?? confidence

        // Override if incoming confidence is strictly higher
        if (incomingConf > existingConf || !(key in merged)) {
          ;(merged as Record<string, unknown>)[key] = value
          allConfidences[key] = incomingConf
        }
      }
    }

    const uniqueEngines = [...new Set(engines)]
    const finalEngine: OcrEngine = uniqueEngines.length === 1
      ? uniqueEngines[0]!
      : 'HYBRID'

    // Compute overall confidence from critical fields
    const criticals = ['invoiceNumber', 'invoiceDate', 'totalAmount', 'vendorName',
                       'vendorGstin', 'closingBalance', 'filingPeriod']
    const criticalScores = criticals
      .map(f => allConfidences[f])
      .filter((v): v is number => v !== undefined)

    const overallConfidence = criticalScores.length
      ? criticalScores.reduce((a, b) => a + b, 0) / criticalScores.length
      : parts[0]?.confidence ?? 0.5

    const uncertainFields = Object.entries(allConfidences)
      .filter(([, c]) => c < 0.70)
      .map(([f]) => f)

    return {
      ...merged,
      extractedBy:       finalEngine,
      overallConfidence: Math.min(1, overallConfidence),
      uncertainFields,
      extractedAt:       new Date().toISOString(),
      fieldConfidences:  allConfidences,
      costPaise:         totalCost,
    } as NormalisedOcrResult
  }

  /**
   * Wrap a single-engine result into NormalisedOcrResult.
   */
  wrap(
    data: Partial<NormalisedOcrResult>,
    engine: OcrEngine,
    confidence: number,
    costPaise: number,
  ): NormalisedOcrResult {
    const uncertainFields = Object.entries(data.fieldConfidences ?? {})
      .filter(([, c]) => c < 0.70)
      .map(([f]) => f)

    return {
      ...data,
      extractedBy:       engine,
      overallConfidence: Math.min(1, confidence),
      uncertainFields,
      extractedAt:       new Date().toISOString(),
      costPaise,
    } as NormalisedOcrResult
  }
}
