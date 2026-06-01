import { Module } from '@nestjs/common'
import { ClientsController } from './clients.controller'
import { ClientsService } from './clients.service'
import { GstinService } from './gstin.service'

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, GstinService],
  exports: [ClientsService, GstinService],
})
export class ClientsModule {}
