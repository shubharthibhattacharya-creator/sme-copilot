import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { StorageService } from '../../common/storage/storage.service'
import { AiService } from '../ai/ai.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import { EmailService } from '../email/email.service'
import { IntegrationsService } from '../integrations/integrations.service'
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
  ) {}

  async upload(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    user: AuthenticatedUser,
  ) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, JPEG, PNG, and WebP files are allowed')
    }
    const maxFileSizeMb = await this.configSvc.getNum(user.companyId, ConfigKey.MAX_FILE_SIZE_MB)
    if (file.size > maxFileSizeMb * 1024 * 1024) {
      throw new BadRequestException(`File size must not exceed ${maxFileSizeMb} MB`)
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
      },
    })

    // Fire-and-forget OCR
    this.processOcr(document.id, user.companyId).catch((err: unknown) => {
      this.logger.error(`OCR failed for document ${document.id}`, err)
    })

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

      const extractedData = await this.aiService.extractDocumentData(
        base64,
        doc.mimeType,
        doc.documentType as DocumentType,
      )

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
    return { ...doc, fileUrl: this.storage.getUrl(doc.storageKey) }
  }

  async delete(id: string, companyId: string): Promise<void> {
    const doc = await this.findOne(id, companyId)
    await this.storage.delete(doc.storageKey)
    await this.prisma.document.delete({ where: { id } })
  }

  async reprocess(id: string, companyId: string) {
    const doc = await this.findOne(id, companyId)
    // Fire-and-forget
    this.processOcr(doc.id, companyId).catch((err: unknown) => {
      this.logger.error(`Reprocess OCR failed for ${id}`, err)
    })
    return { message: 'Reprocessing started', documentId: id }
  }

  async createRequest(dto: CreateDocumentRequestDto, user: AuthenticatedUser) {
    return this.prisma.documentRequest.create({
      data: {
        companyId: user.companyId,
        requestedById: user.userId,
        requestedFromUserId: dto.requestedFromUserId,
        documentType: dto.documentType,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
      },
    })
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
