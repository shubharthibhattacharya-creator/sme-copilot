import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../prisma/prisma.service'
import { StorageService } from '../../common/storage/storage.service'
import { Gstr2bParserService } from './gstr2b-parser.service'
import { ReconciliationMatchingService } from './reconciliation-matching.service'
import { QUEUE_RECON } from '../../common/queue/queue.constants'
import type { ReconJobData } from './recon.processor'
import type { UploadGstr2bDto } from './dto/upload-gstr2b.dto'
import type { ResolveResultDto } from './dto/resolve-result.dto'
import type { AuthenticatedUser } from '@opsc/types'

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parser: Gstr2bParserService,
    private readonly matcher: ReconciliationMatchingService,
    @InjectQueue(QUEUE_RECON) private readonly reconQueue: Queue<ReconJobData>,
  ) {}

  async uploadGstr2b(
    file: Express.Multer.File,
    dto: UploadGstr2bDto,
    user: AuthenticatedUser,
  ) {
    const { key } = await this.storage.save(
      file.buffer,
      file.originalname,
      file.mimetype,
      user.companyId,
    )

    const upload = await this.prisma.gstr2bUpload.create({
      data: {
        companyId: user.companyId,
        uploadedById: user.userId,
        filingPeriod: dto.filingPeriod,
        fileFormat: dto.fileFormat as any,
        fileKey: key,
        originalName: file.originalname,
        status: 'PENDING',
      },
    })

    await this.reconQueue.add('process', { uploadId: upload.id, companyId: user.companyId })
    return upload
  }

  async listUploads(companyId: string) {
    return this.prisma.gstr2bUpload.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { uploadedBy: { select: { name: true } } },
    })
  }

  async getResults(uploadId: string, companyId: string) {
    const upload = await this.prisma.gstr2bUpload.findFirst({
      where: { id: uploadId, companyId },
    })
    if (!upload) throw new NotFoundException('Upload not found')

    const results = await this.prisma.reconciliationResult.findMany({
      where: { uploadId },
      include: {
        lineItem: true,
        purchaseInvoice: {
          include: { document: { select: { originalName: true, id: true } } },
        },
      },
      orderBy: { status: 'asc' },
    })

    return { upload, results }
  }

  async resolveResult(resultId: string, dto: ResolveResultDto, user: AuthenticatedUser) {
    const result = await this.prisma.reconciliationResult.findFirst({
      where: { id: resultId, companyId: user.companyId },
    })
    if (!result) throw new NotFoundException('Result not found')

    return this.prisma.reconciliationResult.update({
      where: { id: resultId },
      data: {
        userAction: dto.action,
        resolvedById: user.userId,
        resolvedAt: new Date(),
        ...(dto.action === 'MANUAL_LINK' && dto.purchaseInvoiceId
          ? { purchaseInvoiceId: dto.purchaseInvoiceId, status: 'MATCHED' as any, matchScore: 1.0 }
          : {}),
        ...(dto.action === 'REJECT_MATCH'
          ? { purchaseInvoiceId: null, status: 'NOT_IN_VAULT' as any, matchScore: 0 }
          : {}),
      },
    })
  }

  async listPurchaseInvoices(companyId: string, filingPeriod?: string) {
    return this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        ...(filingPeriod ? { filingPeriod } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { document: { select: { originalName: true, status: true } } },
    })
  }

  // Called by the BullMQ processor
  async processUpload(uploadId: string, companyId: string): Promise<void> {
    await this.prisma.gstr2bUpload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING' },
    })

    try {
      const upload = await this.prisma.gstr2bUpload.findUniqueOrThrow({ where: { id: uploadId } })
      const fileBuffer = await this.storage.readFile(upload.fileKey)

      let lineItems: Awaited<ReturnType<Gstr2bParserService['parseExcel']>>

      if (upload.fileFormat === 'PDF') {
        lineItems = await this.parser.parsePdf(fileBuffer.toString('base64'))
      } else {
        lineItems = await this.parser.parseExcel(fileBuffer)
      }

      if (lineItems.length === 0) {
        await this.prisma.gstr2bUpload.update({
          where: { id: uploadId },
          data: { status: 'COMPLETED', processedAt: new Date(), totalLineItems: 0 },
        })
        this.logger.warn(`No line items found in GSTR-2B upload ${uploadId}`)
        return
      }

      // Persist line items
      await this.prisma.gstr2bLineItem.createMany({
        data: lineItems.map((li) => ({
          uploadId,
          companyId,
          vendorGstin: li.vendorGstin,
          vendorName: li.vendorName,
          invoiceNumber: li.invoiceNumber,
          invoiceDate: li.invoiceDate,
          taxableAmount: li.taxableAmount,
          igst: li.igst,
          cgst: li.cgst,
          sgst: li.sgst,
          totalAmount: li.totalAmount,
        })),
      })

      await this.prisma.gstr2bUpload.update({
        where: { id: uploadId },
        data: { totalLineItems: lineItems.length },
      })

      // Run matching
      await this.matcher.matchUpload(uploadId, companyId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`GSTR-2B processing failed for upload ${uploadId}`, err)
      await this.prisma.gstr2bUpload.update({
        where: { id: uploadId },
        data: { status: 'FAILED', errorMessage: msg },
      })
      throw err
    }
  }
}
