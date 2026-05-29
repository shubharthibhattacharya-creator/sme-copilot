import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminGuard } from './admin.guard'
import { AiAssistantModule } from '../ai-assistant/ai-assistant.module'
import { OpscConfigModule } from '../config/config.module'

@Module({
  imports: [AiAssistantModule, OpscConfigModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
