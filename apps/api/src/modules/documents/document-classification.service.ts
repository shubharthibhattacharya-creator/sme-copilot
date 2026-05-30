import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'

export interface ClassificationResult {
  action: 'ALREADY_CLASSIFIED' | 'CONTEXT_CLASSIFIED' | 'CONTEXT_CLASSIFIED_LOW_CONFIDENCE' | 'CONFIRMED_FIRM' | 'CONFIRMED_CLIENT' | 'CONFLICT_FLAGGED'
  documentPurpose: string
}

const AUTO_CHANNELS = ['WHATSAPP_INBOUND', 'EMAIL_INBOUND', 'TALLY_SYNC', 'API_PUSH']

@Injectable()
export class DocumentClassificationService {
  private readonly logger = new Logger(DocumentClassificationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async classify(documentId: string, companyId: string): Promise<ClassificationResult> {
    const doc = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } })

    // Rule 1: Auto channels
    if (AUTO_CHANNELS.includes(doc.sourceChannel as string)) {
      return { action: 'ALREADY_CLASSIFIED', documentPurpose: doc.documentPurpose as string }
    }

    // Rule 2: Already explicitly classified
    if (doc.classificationSource === 'USER_EXPLICIT' || doc.classificationSource === 'CHANNEL_INFERRED') {
      return { action: 'ALREADY_CLASSIFIED', documentPurpose: doc.documentPurpose as string }
    }

    const mode = await this.configService.get(companyId, ConfigKey.DOCUMENT_CLASSIFICATION_MODE)
    if (mode === 'explicit') {
      this.logger.warn(`Explicit mode but no user choice for document ${documentId}`)
      return { action: 'ALREADY_CLASSIFIED', documentPurpose: doc.documentPurpose as string }
    }

    // SMART MODE
    const expectedOwner = doc.sourceModule === 'COLLECTIONS' ? 'FIRM' : 'CLIENT'
    const extracted = doc.extractedData as Record<string, unknown> | null
    const extractedGstin = (extracted?.['vendorGstin'] as string | undefined) || (extracted?.['gstin'] as string | undefined) || null
    const companyAny = company as unknown as { gstin?: string }
    const firmGstin = companyAny.gstin || null

    if (!extractedGstin || !firmGstin) {
      const purpose = expectedOwner === 'FIRM' ? 'RECEIVABLE' : 'TAX_PREPARATION'
      await this.prisma.document.update({
        where: { id: documentId },
        data: { documentOwner: expectedOwner as any, documentPurpose: purpose as any, classificationSource: 'CONTEXT' },
      })
      return { action: 'CONTEXT_CLASSIFIED', documentPurpose: purpose }
    }

    const gstinMatchesFirm = extractedGstin.toUpperCase().trim() === firmGstin.toUpperCase().trim()
    const gstinConfidence = typeof extracted?.['gstinConfidence'] === 'number'
      ? (extracted['gstinConfidence'] as number)
      : typeof extracted?.['confidence'] === 'number'
        ? (extracted['confidence'] as number)
        : 1.0

    if (gstinConfidence <= 0.7) {
      const purpose = expectedOwner === 'FIRM' ? 'RECEIVABLE' : 'TAX_PREPARATION'
      this.logger.debug(`Low GSTIN confidence (${gstinConfidence}) — using context classification for ${documentId}`)
      await this.prisma.document.update({
        where: { id: documentId },
        data: { documentOwner: expectedOwner as any, documentPurpose: purpose as any, classificationSource: 'CONTEXT' },
      })
      return { action: 'CONTEXT_CLASSIFIED_LOW_CONFIDENCE', documentPurpose: purpose }
    }

    if (expectedOwner === 'FIRM' && gstinMatchesFirm) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { documentOwner: 'FIRM', documentPurpose: 'RECEIVABLE', classificationSource: 'OCR_CONFIRMED' },
      })
      return { action: 'CONFIRMED_FIRM', documentPurpose: 'RECEIVABLE' }
    }

    if (expectedOwner === 'CLIENT' && !gstinMatchesFirm) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { documentOwner: 'CLIENT', documentPurpose: 'TAX_PREPARATION', classificationSource: 'OCR_CONFIRMED' },
      })
      return { action: 'CONFIRMED_CLIENT', documentPurpose: 'TAX_PREPARATION' }
    }

    // Conflict
    let conflictNote = ''
    if (expectedOwner === 'FIRM') {
      conflictNote = `Uploaded in Collections but vendor GSTIN on the document (${extractedGstin}) does not match your firm GSTIN (${firmGstin}). This may be a client's document.`
    } else {
      conflictNote = `Uploaded in the document vault but vendor GSTIN (${extractedGstin}) matches your firm GSTIN (${firmGstin}). This may be your firm's own fee invoice.`
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        documentOwner: expectedOwner as any,
        documentPurpose: 'UNKNOWN',
        gstinConflict: true,
        gstinConflictNote: conflictNote,
        classificationSource: 'OCR_CONFLICT_DETECTED',
      },
    })

    this.logger.warn(`GSTIN conflict for document ${documentId}: ${conflictNote}`)
    return { action: 'CONFLICT_FLAGGED', documentPurpose: 'UNKNOWN' }
  }
}
