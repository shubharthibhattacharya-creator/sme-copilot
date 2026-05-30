import { Module } from '@nestjs/common'
import { ComplianceController } from './compliance.controller'
import { ComplianceService } from './compliance.service'
import { ReadinessService } from './readiness.service'

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, ReadinessService],
  exports: [ReadinessService],
})
export class ComplianceModule {}
