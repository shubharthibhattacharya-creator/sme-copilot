import { Injectable, Logger } from '@nestjs/common'
import { createWorker } from 'tesseract.js'

export interface PrescreenResult {
  confidence: number        // 0–100 Tesseract mean confidence
  quality: 'HIGH' | 'MEDIUM' | 'POOR' | 'UNREADABLE'
  rawText: string
  pageCount: number
  language: string
  durationMs: number
}

/**
 * Tesseract pre-screener — runs locally, zero cost.
 *
 * Purposes:
 *  1. Detect blank/corrupted files before paying for any cloud OCR
 *  2. Assess scan quality to route to the right engine
 *  3. For very clean docs (quality=HIGH), raw text can supplement extraction
 */
@Injectable()
export class TesseractPrescreenerService {
  private readonly logger = new Logger(TesseractPrescreenerService.name)

  async prescreen(fileBuffer: Buffer, mimeType: string): Promise<PrescreenResult> {
    const start = Date.now()

    // PDF pages — Tesseract.js handles PDFs natively in Node (via PDF.js)
    // For images, pass directly
    let confidence = 0
    let rawText = ''

    try {
      const worker = await createWorker('eng', 1, {
        logger: () => undefined,   // suppress verbose Tesseract logs
      })

      const { data } = await worker.recognize(fileBuffer)
      confidence = data.confidence ?? 0
      rawText = data.text ?? ''
      await worker.terminate()
    } catch (err) {
      this.logger.warn(`Tesseract failed (non-fatal): ${err instanceof Error ? err.message : err}`)
      // If Tesseract itself errors, treat as MEDIUM — let a cloud engine try
      return {
        confidence: 50,
        quality: 'MEDIUM',
        rawText: '',
        pageCount: 1,
        language: 'eng',
        durationMs: Date.now() - start,
      }
    }

    const quality = this.scoreQuality(confidence, rawText)

    return {
      confidence,
      quality,
      rawText,
      pageCount: 1,          // Tesseract.js processes single page; caller handles multi-page PDFs
      language: 'eng',
      durationMs: Date.now() - start,
    }
  }

  private scoreQuality(confidence: number, rawText: string): PrescreenResult['quality'] {
    const textLength = rawText.replace(/\s+/g, '').length

    // Blank page / no extractable text
    if (textLength < 20 && confidence < 15) return 'UNREADABLE'

    // Poor quality scan
    if (confidence < 45 || textLength < 50) return 'POOR'

    // Readable but uncertain
    if (confidence < 72) return 'MEDIUM'

    // Clean digital or high-res scan
    return 'HIGH'
  }
}
