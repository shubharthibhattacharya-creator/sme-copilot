import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { AiService } from './ai.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '@opsc/types'
import { GenerateInsightsDto } from './dto/generate-insights.dto'
import { ChatDto } from './dto/chat.dto'

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('insights')
  listInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Query('module') module?: string,
  ) {
    return this.aiService.listInsights(user.companyId, module)
  }

  @Post('insights/generate')
  generateInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateInsightsDto,
  ) {
    return this.aiService.generateInsights(user.companyId, dto.module)
  }

  @Post('chat')
  chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatDto,
  ) {
    return this.aiService.chat(user.companyId, dto.message, dto.history)
  }
}
