import { Module } from '@nestjs/common'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { DocumentClassificationService } from './document-classification.service'
import { DocumentToInvoiceService } from './document-to-invoice.service'
import { AiModule } from '../ai/ai.module'
import { IntegrationsModule } from '../integrations/integrations.module'

@Module({
  imports: [AiModule, IntegrationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentClassificationService, DocumentToInvoiceService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
