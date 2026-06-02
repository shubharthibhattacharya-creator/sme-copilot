import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { DashboardService } from './dashboard.service'
import { QUEUE_INSIGHTS } from '../../common/queue/queue.constants'

export interface InsightsJobData {
  companyId: string
  force?: boolean
}

@Processor(QUEUE_INSIGHTS, { concurrency: 2 })
export class InsightsProcessor extends WorkerHost {
  private readonly logger = new Logger(InsightsProcessor.name)

  constructor(private readonly dashboardService: DashboardService) {
    super()
  }

  async process(job: Job<InsightsJobData>): Promise<void> {
    const { companyId, force } = job.data
    this.logger.log(`Processing insights job ${job.id} for company ${companyId}`)
    await this.dashboardService.refreshInsights(companyId, force ?? false)
  }
}
