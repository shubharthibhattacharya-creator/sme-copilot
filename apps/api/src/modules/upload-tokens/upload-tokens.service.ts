import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { StorageService } from '../../common/storage/storage.service'
import { AiService } from '../ai/ai.service'

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB
const DEFAULT_EXPIRY_HOURS = 72

@Injectable()
export class UploadTokensService {
  private readonly logger = new Logger(UploadTokensService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
  ) {}

  async createToken(
    companyId: string,
    clientId: string | undefined,
    label: string | undefined,
    expiryHours = DEFAULT_EXPIRY_HOURS,
  ) {
    // Use crypto random hex so the token is URL-safe and unpredictable
    const token = randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    if (clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, companyId },
      })
      if (!client) throw new NotFoundException('Client not found')
    }

    return this.prisma.uploadToken.create({
      data: { token, companyId, clientId, label, expiresAt },
      select: {
        id: true,
        token: true,
        label: true,
        expiresAt: true,
        client: { select: { id: true, name: true } },
      },
    })
  }

  async listTokens(companyId: string) {
    return this.prisma.uploadToken.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        label: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    })
  }

  /** Resolve a public token — returns metadata for the upload page (no company data leaked). */
  async resolveToken(token: string) {
    const rec = await this.prisma.uploadToken.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        label: true,
        expiresAt: true,
        usedAt: true,
        client: { select: { name: true } },
      },
    })
    if (!rec) throw new NotFoundException('Upload link not found')
    if (rec.expiresAt < new Date()) throw new BadRequestException('This upload link has expired')
    // Don't block re-uploads — allow multiple files per token
    return rec
  }

  /** Public upload endpoint — no user auth, just a valid token. */
  async uploadWithToken(
    token: string,
    file: Express.Multer.File,
    documentType: string,
    filingPeriod: string | undefined,
    notes: string | undefined,
  ) {
    const rec = await this.prisma.uploadToken.findUnique({ where: { token } })
    if (!rec) throw new NotFoundException('Upload link not found')
    if (rec.expiresAt < new Date()) throw new BadRequestException('This upload link has expired')

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, JPEG, PNG, and WebP files are allowed')
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size must not exceed 15 MB')
    }

    // Find a staff user from this company to assign as uploader
    const staffUser = await this.prisma.user.findFirst({
      where: { companyId: rec.companyId },
      orderBy: { createdAt: 'asc' },
    })
    if (!staffUser) throw new BadRequestException('Company has no users')

    const { key, sizeBytes } = await this.storage.save(
      file.buffer,
      file.originalname,
      file.mimetype,
      rec.companyId,
    )

    const document = await this.prisma.document.create({
      data: {
        companyId: rec.companyId,
        uploadedById: staffUser.id,
        clientId: rec.clientId ?? undefined,
        documentType: documentType as never,
        status: 'UPLOADED',
        originalName: file.originalname,
        storageKey: key,
        fileSizeBytes: sizeBytes,
        mimeType: file.mimetype,
        notes: notes ?? `Uploaded via client link${rec.label ? ': ' + rec.label : ''}`,
        filingPeriod: filingPeriod ?? undefined,
      },
    })

    // Mark token used (first use)
    if (!rec.usedAt) {
      await this.prisma.uploadToken.update({
        where: { id: rec.id },
        data: { usedAt: new Date() },
      })
    }

    // Fire-and-forget OCR
    this.triggerOcr(document.id, rec.companyId).catch((err: unknown) => {
      this.logger.error(`OCR failed for token-uploaded doc ${document.id}`, err)
    })

    return { documentId: document.id, message: 'Document uploaded successfully' }
  }

  private async triggerOcr(documentId: string, companyId: string): Promise<void> {
    await this.prisma.document.update({ where: { id: documentId }, data: { status: 'PROCESSING' } })
    try {
      const doc = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId } })
      const fileBuffer = await this.storage.readFile(doc.storageKey)
      const base64 = fileBuffer.toString('base64')
      const extractedData = await this.ai.extractDocumentData(base64, doc.mimeType, doc.documentType as never)
      const confidence = typeof extractedData['confidence'] === 'number' ? (extractedData['confidence'] as number) : 0.5
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: confidence >= 0.5 ? 'PROCESSED' : 'NEEDS_REVIEW',
          extractedData: JSON.parse(JSON.stringify(extractedData)),
        },
      })
    } catch {
      await this.prisma.document.update({ where: { id: documentId }, data: { status: 'FAILED' } })
    }
  }
}
