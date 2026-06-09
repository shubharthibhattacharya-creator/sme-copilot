import { Module, forwardRef } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { DocumentClassificationService } from './document-classification.service'
import { DocumentToInvoiceService } from './document-to-invoice.service'
import { OcrProcessor } from './ocr.processor'
import { TesseractPrescreenerService } from './ocr/tesseract-prescreener.service'
import { TextractAdapterService } from './ocr/textract-adapter.service'
import { DocumentAiAdapterService } from './ocr/documentai-adapter.service'
import { OcrNormaliserService } from './ocr/ocr-normaliser.service'
import { OcrRouterService } from './ocr/ocr-router.service'
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
  providers: [
    DocumentsService,
    DocumentClassificationService,
    DocumentToInvoiceService,
    OcrProcessor,
    TesseractPrescreenerService,
    TextractAdapterService,
    DocumentAiAdapterService,
    OcrNormaliserService,
    OcrRouterService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
