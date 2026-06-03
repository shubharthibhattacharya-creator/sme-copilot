import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ReconciliationController } from './reconciliation.controller'
import { ReconciliationService } from './reconciliation.service'
import { PurchaseInvoiceBridgeService } from './purchase-invoice-bridge.service'
import { Gstr2bParserService } from './gstr2b-parser.service'
import { ReconciliationMatchingService } from './reconciliation-matching.service'
import { ReconProcessor } from './recon.processor'
import { StorageModule } from '../../common/storage/storage.module'
import { QUEUE_RECON } from '../../common/queue/queue.constants'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_RECON }),
    StorageModule,
  ],
  controllers: [ReconciliationController],
  providers: [
    ReconciliationService,
    PurchaseInvoiceBridgeService,
    Gstr2bParserService,
    ReconciliationMatchingService,
    ReconProcessor,
  ],
  exports: [PurchaseInvoiceBridgeService],
})
export class ReconciliationModule {}
