import { Module } from '@nestjs/common'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { AiModule } from '../ai/ai.module'
import { IntegrationsModule } from '../integrations/integrations.module'

@Module({
  imports: [AiModule, IntegrationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
