import { Module } from '@nestjs/common'
import { AssistantController } from './assistant.controller'
import { AssistantService } from './assistant.service'
import { KnowledgeService } from './knowledge.service'
import { EmbeddingService } from './embedding.service'

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, KnowledgeService, EmbeddingService],
  exports: [KnowledgeService, EmbeddingService],
})
export class AiAssistantModule {}
