import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SchedulerService } from './scheduler.service'
import { FilingsModule } from '../filings/filings.module'
import { ClientsModule } from '../clients/clients.module'

@Module({
  imports: [ScheduleModule.forRoot(), FilingsModule, ClientsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
