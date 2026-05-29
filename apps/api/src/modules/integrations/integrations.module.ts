import { Module, forwardRef } from '@nestjs/common'
import { IntegrationsController } from './integrations.controller'
import { IntegrationsService } from './integrations.service'
import { ClearTaxAdapter } from './adapters/cleartax.adapter'
import { ZohoAdapter } from './adapters/zoho.adapter'
import { TallyAdapter } from './adapters/tally.adapter'

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ClearTaxAdapter, ZohoAdapter, TallyAdapter],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
