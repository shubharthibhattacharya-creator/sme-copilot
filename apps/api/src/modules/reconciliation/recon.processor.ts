import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { QUEUE_RECON } from '../../common/queue/queue.constants'
import { ReconciliationService } from './reconciliation.service'

export interface ReconJobData {
  uploadId: string
  companyId: string
}

@Processor(QUEUE_RECON, { concurrency: 2 })
export class ReconProcessor extends WorkerHost {
  private readonly logger = new Logger(ReconProcessor.name)

  constructor(private readonly reconService: ReconciliationService) { super() }

  async process(job: Job<ReconJobData>): Promise<void> {
    this.logger.log(`Processing GSTR-2B reconciliation for upload ${job.data.uploadId}`)
    await this.reconService.processUpload(job.data.uploadId, job.data.companyId)
  }
}
