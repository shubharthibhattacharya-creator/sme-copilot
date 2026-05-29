import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { AiModule } from '../ai/ai.module'
import { CompaniesModule } from '../companies/companies.module'

@Module({
  imports: [AiModule, CompaniesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
