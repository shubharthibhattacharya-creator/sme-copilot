import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { ReportsService } from './reports.service'
import { QUEUE_REPORTS } from '../../common/queue/queue.constants'

export interface ReportJobData {
  reportId: string
  companyId: string
}

@Processor(QUEUE_REPORTS, { concurrency: 2 })
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name)

  constructor(private readonly reportsService: ReportsService) {
    super()
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const { reportId, companyId } = job.data
    this.logger.log(`Processing report job ${job.id} for report ${reportId}`)
    await this.reportsService.generate(reportId, companyId)
  }
}
