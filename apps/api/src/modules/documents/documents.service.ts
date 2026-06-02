import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import {
  AppException,
  DocumentOcrFailedException,
  DocumentTooLargeException,
  DocumentTypeNotSupportedException,
  DocumentNotReadyException,
  AiServiceUnavailableException,
  AiResponseInvalidException,
} from '../../common/exceptions'
import { PrismaService } from '../../prisma/prisma.service'
import { StorageService } from '../../common/storage/storage.service'
import { AiService } from '../ai/ai.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import { EmailService } from '../email/email.service'
import { IntegrationsService } from '../integrations/integrations.service'
import { DocumentClassificationService } from './document-classification.service'
import { DocumentToInvoiceService } from './document-to-invoice.service'
import { ReadinessService } from '../compliance/readiness.service'
import { QUEUE_OCR } from '../../common/queue/queue.constants'
import type { OcrJobData } from './ocr.processor'
import type { UploadDocumentDto } from './dto/upload-document.dto'
import type { ListDocumentsDto } from './dto/list-documents.dto'
import type { CreateDocumentRequestDto } from './dto/create-document-request.dto'
import type { AuthenticatedUser } from '@opsc/types'
import type { DocumentType } from '@opsc/database'

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export interface OcrResult {
  status: 'PROCESSED' | 'NEEDS_REVIEW' | 'FAILED'
  documentType: string
  originalName: string
  filingPeriod?: string
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly aiService: AiService,
    private readonly configSvc: ConfigService,
    private readonly email: EmailService,
    private readonly integrations: IntegrationsService,
    private readonly classificationService: DocumentClassificationService,
    private readonly bridgeService: DocumentToInvoiceService,
    private readonly readinessService: ReadinessService,
    @InjectQueue(QUEUE_OCR) private readonly ocrQueue: Queue<OcrJobData>,
  ) {}

  async upload(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    user: AuthenticatedUser,
  ) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new DocumentTypeNotSupportedException(file.mimetype)
    }
    const maxFileSizeMb = await this.configSvc.getNum(user.companyId, ConfigKey.MAX_FILE_SIZE_MB)
    if (file.size > maxFileSizeMb * 1024 * 1024) {
      throw new DocumentTooLargeException(Math.round(file.size / 1024 / 1024))
    }

    const { key, sizeBytes } = await this.storage.save(
      file.buffer,
      file.originalname,
      file.mimetype,
      user.companyId,
    )

    const document = await this.prisma.document.create({
      data: {
        companyId: user.companyId,
        uploadedById: user.userId,
        clientId: dto.clientId ?? undefined,
        documentType: dto.documentType,
        status: 'UPLOADED',
        originalName: file.originalname,
        storageKey: key,
        fileSizeBytes: sizeBytes,
        mimeType: file.mimetype,
        notes: dto.notes,
        filingPeriod: dto.filingPeriod ?? undefined,
        sourceModule: dto.sourceModule ?? 'DOCUMENTS',
        sourceChannel: (dto.sourceChannel ?? 'MANUAL_UPLOAD') as any,
        documentOwner: (dto.documentOwner ?? (dto.sourceModule === 'COLLECTIONS' ? 'FIRM' : 'CLIENT')) as any,
        documentPurpose: (dto.documentOwner ? (dto.documentOwner === 'FIRM' ? 'RECEIVABLE' : 'TAX_PREPARATION') : 'UNKNOWN') as any,
        classificationMode: (dto.documentOwner ? 'EXPLICIT' : 'SMART') as any,
        classificationSource: dto.documentOwner ? 'USER_EXPLICIT' : null,
      },
    })

    // Enqueue OCR — worker picks up async with 3 retries on failure
    await this.ocrQueue.add('process', { documentId: document.id, companyId: user.companyId })

    // Notify uploader
    this.notifyUpload(document.id, user, 'staff').catch(() => undefined)

    return document
  }

  private async notifyUpload(
    documentId: string,
    user: AuthenticatedUser,
    via: 'staff' | 'client-link',
  ): Promise<void> {
    try {
      const doc = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: { client: { select: { name: true } } },
      })
      if (!doc) return
      await this.email.sendDocumentUploaded({
        staffEmail: user.email,
        staffName: user.name,
        clientName: doc.client?.name ?? 'Unknown client',
        documentType: doc.documentType,
        originalName: doc.originalName,
        filingPeriod: doc.filingPeriod,
        uploadedVia: via,
      })
    } catch {
      // non-critical
    }
  }

  async processOcr(documentId: string, companyId: string): Promise<OcrResult> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    })

    try {
      const doc = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId } })
      const fileBuffer = await this.storage.readFile(doc.storageKey)
      const base64 = fileBuffer.toString('base64')

      let extractedData: Record<string, unknown>
      try {
        extractedData = await this.aiService.extractDocumentData(
          base64,
          doc.mimeType,
          doc.documentType as DocumentType,
        )
        if (!extractedData || extractedData['confidence'] === undefined) {
          throw new AiResponseInvalidException('document OCR', 'No confidence score returned')
        }
      } catch (aiErr) {
        if (aiErr instanceof AppException) throw aiErr
        const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr)
        if (errMsg.includes('overloaded') || (aiErr as { status?: number }).status === 529) {
          throw new AiServiceUnavailableException('OCR', errMsg)
        }
        throw new DocumentOcrFailedException(errMsg)
      }

      const confidence = typeof extractedData['confidence'] === 'number'
        ? (extractedData['confidence'] as number)
        : 0.5

      // Auto-extract filing period from OCR data if not already set
      let filingPeriod: string | undefined
      if (!doc.filingPeriod && doc.documentType === 'GST_RETURN') {
        filingPeriod = this.extractFilingPeriod(extractedData)
      }

      const finalStatus = confidence >= 0.5 ? 'PROCESSED' : 'NEEDS_REVIEW'
      const updatedDoc = await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: finalStatus,
          extractedData: JSON.parse(JSON.stringify(extractedData)),
          ...(filingPeriod ? { filingPeriod } : {}),
        },
        include: {
          uploadedBy: { select: { email: true, name: true } },
          client: { select: { name: true } },
        },
      })

      // Classify and bridge to Invoice if applicable
      try {
        const classification = await this.classificationService.classify(documentId, companyId)
        if (classification.documentPurpose === 'RECEIVABLE') {
          await this.bridgeService.bridge(documentId, companyId)
        }
      } catch (classErr) {
        this.logger.error(`Classification failed for ${documentId}`, classErr)
      }

      // Email OCR result to uploader
      this.email.sendOcrComplete({
        staffEmail: updatedDoc.uploadedBy.email,
        staffName: updatedDoc.uploadedBy.name,
        clientName: updatedDoc.client?.name ?? 'Unknown client',
        documentType: updatedDoc.documentType,
        originalName: updatedDoc.originalName,
        filingPeriod: updatedDoc.filingPeriod,
        status: finalStatus,
      }).catch(() => undefined)

      // Auto-push to tax integration if PROCESSED and integration is active
      if (finalStatus === 'PROCESSED') {
        this.integrations.pushDocumentWithRetry(companyId, documentId)
      }

      return {
        status: finalStatus,
        documentType: updatedDoc.documentType,
        originalName: updatedDoc.originalName,
        filingPeriod: updatedDoc.filingPeriod ?? undefined,
      }
    } catch (err) {
      this.logger.error(`OCR processing failed for ${documentId}`, err)
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      })
      return { status: 'FAILED', documentType: 'OTHER', originalName: documentId }
    }
  }

  async list(companyId: string, dto: ListDocumentsDto) {
    const page = dto.page ?? 1
    const limit = Math.min(dto.limit ?? 20, 50)
    const skip = (page - 1) * limit

    const where = {
      companyId,
      ...(dto.documentType ? { documentType: dto.documentType } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          documentType: true,
          status: true,
          originalName: true,
          fileSizeBytes: true,
          mimeType: true,
          notes: true,
          filingPeriod: true,
          clientId: true,
          createdAt: true,
          updatedAt: true,
          extractedData: true,
          documentOwner: true,
          documentPurpose: true,
          classificationSource: true,
          sourceChannel: true,
          gstinConflict: true,
          gstinConflictNote: true,
          linkedInvoiceId: true,
          linkedInvoiceCreated: true,
          syncStatus: true,
          syncProvider: true,
          syncedAt: true,
          syncError: true,
          uploadedBy: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ])

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async findOne(id: string, companyId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, name: true } } },
    })
    if (!doc || doc.companyId !== companyId) {
      throw new NotFoundException('Document not found')
    }
    return { ...doc, fileUrl: await this.storage.getUrl(doc.storageKey) }
  }

  async delete(id: string, companyId: string): Promise<void> {
    const doc = await this.findOne(id, companyId)
    await this.storage.delete(doc.storageKey)
    await this.prisma.document.delete({ where: { id } })
  }

  async reprocess(id: string, companyId: string) {
    const doc = await this.findOne(id, companyId)
    await this.ocrQueue.add('process', { documentId: doc.id, companyId })
    return { message: 'Reprocessing started', documentId: id }
  }

  async verifyDocument(id: string, companyId: string) {
    const doc = await this.findOne(id, companyId)
    if (doc.status === 'VERIFIED') return doc
    if (doc.status === 'UPLOADED' || doc.status === 'PROCESSING') {
      throw new DocumentNotReadyException()
    }

    const updated = await this.prisma.document.update({
      where: { id: doc.id },
      data: { status: 'VERIFIED' },
    })

    // Auto-link to matching checklists and recalculate readiness
    this.readinessService.autoLinkDocument(id, companyId).catch((err: unknown) => {
      this.logger.error(`autoLinkDocument failed for ${id}`, err)
    })

    return updated
  }

  async createRequest(dto: CreateDocumentRequestDto, user: AuthenticatedUser) {
    const req = await this.prisma.documentRequest.create({
      data: {
        companyId: user.companyId,
        requestedById: user.userId,
        requestedFromUserId: dto.requestedFromUserId ?? user.userId,
        clientId: dto.clientId ?? undefined,
        documentType: dto.documentType,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
      },
    })

    // Auto-send WhatsApp to client if clientId provided and client has a phone
    if (dto.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: dto.clientId },
        select: { phone: true, name: true },
      })
      if (client?.phone) {
        const company = await this.prisma.company.findUnique({
          where: { id: user.companyId },
          select: { name: true },
        })
        const docLabel = dto.documentType.replace(/_/g, ' ')
        const dueDateStr = dto.dueDate ? new Date(dto.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'as soon as possible'
        const body = `Dear ${client.name},\n\nWe need the following document from you: *${docLabel}*\n\nPlease share it by ${dueDateStr}.${dto.notes ? `\n\nNote: ${dto.notes}` : ''}\n\nThank you,\n${company?.name ?? 'Your CA Firm'}`
        await this.prisma.whatsAppMessage.create({
          data: {
            companyId: user.companyId,
            clientId: dto.clientId,
            toPhone: client.phone,
            templateKey: 'doc_request',
            body,
            status: 'QUEUED',
          },
        }).catch(() => null) // non-fatal
      }
    }

    return req
  }

  async listRequests(companyId: string) {
    return this.prisma.documentRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true } },
        requestedFromUser: { select: { id: true, name: true } },
        fulfilledDocument: { select: { id: true, originalName: true, status: true } },
      },
    })
  }

  async fulfillRequest(requestId: string, documentId: string, companyId: string) {
    const req = await this.prisma.documentRequest.findUnique({ where: { id: requestId } })
    if (!req || req.companyId !== companyId) {
      throw new NotFoundException('Document request not found')
    }
    return this.prisma.documentRequest.update({
      where: { id: requestId },
      data: { status: 'FULFILLED', fulfilledDocumentId: documentId },
    })
  }

  async resolveClassification(id: string, companyId: string, documentOwner: 'FIRM' | 'CLIENT') {
    const doc = await this.findOne(id, companyId)
    const purpose = documentOwner === 'FIRM' ? 'RECEIVABLE' : 'TAX_PREPARATION'

    await this.prisma.document.update({
      where: { id: doc.id },
      data: {
        documentOwner: documentOwner as any,
        documentPurpose: purpose as any,
        gstinConflict: false,
        classificationSource: 'OCR_CONFLICT_RESOLVED',
        classificationMode: 'EXPLICIT' as any,
      },
    })

    // If firm invoice, bridge to invoice
    if (documentOwner === 'FIRM') {
      try {
        await this.bridgeService.bridge(id, companyId)
      } catch (err) {
        this.logger.error(`Bridge failed after manual classification for ${id}`, err)
      }
    }

    return { message: 'Classification resolved', documentId: id, documentOwner, documentPurpose: purpose }
  }

  async updateExtractedData(id: string, companyId: string, corrections: Record<string, unknown>) {
    const doc = await this.findOne(id, companyId)
    const current = (doc.extractedData as Record<string, unknown> | null) ?? {}
    const merged = { ...current, ...corrections }

    // Re-evaluate status: if user corrected the data, set to PROCESSED unless it was FILED
    const newStatus = doc.status === 'NEEDS_REVIEW' ? 'PROCESSED' : doc.status

    const updated = await this.prisma.document.update({
      where: { id: doc.id },
      data: {
        extractedData: merged as any,
        status: newStatus as any,
      },
    })

    // If this is a firm invoice and we just corrected data, re-run the bridge
    if (updated.documentOwner === 'FIRM' || updated.documentPurpose === 'RECEIVABLE') {
      try {
        await this.bridgeService.bridge(id, companyId)
      } catch (err) {
        this.logger.error(`Bridge failed after extracted-data correction for ${id}`, err)
      }
    }

    return updated
  }

  async updateFilingPeriod(id: string, companyId: string, filingPeriod: string) {
    const doc = await this.findOne(id, companyId)
    return this.prisma.document.update({
      where: { id: doc.id },
      data: { filingPeriod },
    })
  }

  /**
   * Attempt to parse a filing period like "Nov 2024" from OCR-extracted data.
   * Looks for period/month fields in the extracted JSON.
   */
  private extractFilingPeriod(data: Record<string, unknown>): string | undefined {
    const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

    const candidates = [
      data['period'], data['filing_period'], data['month'], data['tax_period'],
      data['return_period'], data['periodOfReturn'], data['period_of_return'],
    ]

    for (const raw of candidates) {
      if (typeof raw !== 'string') continue
      const lower = raw.toLowerCase()
      // Match "November 2024", "Nov 2024", "11/2024", "2024-11"
      const monthFull = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i
      const monthShort = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/i
      const slashFmt = /\b(\d{1,2})\/(\d{4})\b/
      const dashFmt = /\b(\d{4})-(\d{2})\b/

      let m: RegExpMatchArray | null
      m = lower.match(monthFull)
      if (m) {
        const idx = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(m[1]!.toLowerCase())
        return `${MONTH_NAMES[idx]} ${m[2]}`
      }
      m = lower.match(monthShort)
      if (m) {
        const idx = MONTHS.indexOf(m[1]!.toLowerCase())
        return `${MONTH_NAMES[idx]} ${m[2]}`
      }
      m = raw.match(slashFmt)
      if (m) {
        const idx = parseInt(m[1]!, 10) - 1
        return `${MONTH_NAMES[idx]} ${m[2]}`
      }
      m = raw.match(dashFmt)
      if (m) {
        const idx = parseInt(m[2]!, 10) - 1
        return `${MONTH_NAMES[idx]} ${m[1]}`
      }
    }

    return undefined
  }
}
