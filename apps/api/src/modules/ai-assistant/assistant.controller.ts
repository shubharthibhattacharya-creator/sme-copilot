import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
} from '@nestjs/common'
import { AssistantService } from './assistant.service'
import { KnowledgeService } from './knowledge.service'
import { ChatMessageDto } from './dto/chat.dto'
import { CreateKnowledgeDocumentDto } from './dto/knowledge.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequireModuleAccess } from '../../common/decorators/require-module.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('assistant')
@RequireModuleAccess('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly knowledge: KnowledgeService,
  ) {}

  // ─── Chat ───────────────────────────────────────────────────────────────────

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChatMessageDto) {
    return this.assistant.chat(user.companyId, user.userId, dto)
  }

  // ─── Conversations ──────────────────────────────────────────────────────────

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.assistant.listConversations(user.companyId, user.userId)
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assistant.getConversation(user.companyId, user.userId, id)
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  deleteConversation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assistant.deleteConversation(user.companyId, user.userId, id)
  }

  // ─── Knowledge Management ───────────────────────────────────────────────────

  @Get('knowledge')
  listKnowledge(@CurrentUser() user: AuthenticatedUser) {
    return this.knowledge.listDocuments(user.companyId)
  }

  @Post('knowledge')
  @Roles('ADMIN')
  ingestDocument(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateKnowledgeDocumentDto) {
    return this.knowledge.ingestDocument(user.companyId, dto)
  }

  @Delete('knowledge/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  deleteDocument(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.knowledge.deleteDocument(user.companyId, id)
  }

  @Post('knowledge/:id/toggle')
  @HttpCode(HttpStatus.OK)
  toggleDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('active', ParseBoolPipe) active: boolean,
  ) {
    return this.knowledge.toggleActive(user.companyId, id, active)
  }

  // ─── Semantic search (dev / admin) ─────────────────────────────────────────

  @Get('search')
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') query: string) {
    if (!query) return []
    return this.knowledge.searchChunks(user.companyId, query)
  }
}
