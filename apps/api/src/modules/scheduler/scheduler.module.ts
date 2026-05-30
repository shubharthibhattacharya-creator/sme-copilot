import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SchedulerService } from './scheduler.service'
import { FilingsModule } from '../filings/filings.module'

@Module({
  imports: [ScheduleModule.forRoot(), FilingsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
