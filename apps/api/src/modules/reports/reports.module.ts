import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'
import { ReportExportService } from './report-export.service'
import { ReportProcessor } from './report.processor'
import { AiModule } from '../ai/ai.module'
import { QUEUE_REPORTS } from '../../common/queue/queue.constants'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_REPORTS }),
    AiModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExportService, ReportProcessor],
})
export class ReportsModule {}
