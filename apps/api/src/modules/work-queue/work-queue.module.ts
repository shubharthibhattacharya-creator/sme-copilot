import { Module } from '@nestjs/common'
import { WorkQueueController } from './work-queue.controller'
import { WorkQueueService } from './work-queue.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [WorkQueueController],
  providers: [WorkQueueService],
})
export class WorkQueueModule {}
