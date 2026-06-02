import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { DocumentsService } from './documents.service'
import { QUEUE_OCR } from '../../common/queue/queue.constants'

export interface OcrJobData {
  documentId: string
  companyId: string
}

@Processor(QUEUE_OCR, { concurrency: 3 })
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name)

  constructor(private readonly documentsService: DocumentsService) {
    super()
  }

  async process(job: Job<OcrJobData>): Promise<void> {
    const { documentId, companyId } = job.data
    this.logger.log(`Processing OCR job ${job.id} for document ${documentId}`)
    await this.documentsService.processOcr(documentId, companyId)
  }
}
