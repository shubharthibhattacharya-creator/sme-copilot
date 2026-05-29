import { Module, forwardRef } from '@nestjs/common'
import { WhatsAppController } from './whatsapp.controller'
import { WhatsAppService } from './whatsapp.service'
import { TwilioService } from './twilio.service'
import { TemplateService } from './template.service'
import { DocumentsModule } from '../documents/documents.module'
import { FilingsModule } from '../filings/filings.module'

@Module({
  imports: [forwardRef(() => DocumentsModule), FilingsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, TwilioService, TemplateService],
  exports: [WhatsAppService, TemplateService],
})
export class WhatsAppModule {}
