import { Module } from '@nestjs/common'
import { CollectionsController } from './collections.controller'
import { CollectionsService } from './collections.service'
import { CompaniesModule } from '../companies/companies.module'
import { WhatsAppModule } from '../whatsapp/whatsapp.module'

@Module({
  imports: [CompaniesModule, WhatsAppModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
