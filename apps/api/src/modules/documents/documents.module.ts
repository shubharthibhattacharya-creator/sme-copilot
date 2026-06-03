import { Module, forwardRef } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { DocumentClassificationService } from './document-classification.service'
import { DocumentToInvoiceService } from './document-to-invoice.service'
import { OcrProcessor } from './ocr.processor'
import { AiModule } from '../ai/ai.module'
import { IntegrationsModule } from '../integrations/integrations.module'
import { ComplianceModule } from '../compliance/compliance.module'
import { ReconciliationModule } from '../reconciliation/reconciliation.module'
import { QUEUE_OCR } from '../../common/queue/queue.constants'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_OCR }),
    AiModule,
    IntegrationsModule,
    ComplianceModule,
    forwardRef(() => ReconciliationModule),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentClassificationService, DocumentToInvoiceService, OcrProcessor],
  exports: [DocumentsService],
})
export class DocumentsModule {}
