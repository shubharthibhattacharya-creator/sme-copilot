import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { InsightsProcessor } from './insights.processor'
import { AiModule } from '../ai/ai.module'
import { CompaniesModule } from '../companies/companies.module'
import { QUEUE_INSIGHTS } from '../../common/queue/queue.constants'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_INSIGHTS }),
    AiModule,
    CompaniesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, InsightsProcessor],
})
export class DashboardModule {}
