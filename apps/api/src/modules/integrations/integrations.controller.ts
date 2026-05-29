import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Redirect,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { IntegrationsService } from './integrations.service'
import { SetupIntegrationDto } from './dto/setup-integration.dto'
import { PushDocumentDto } from './dto/push-document.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Get()
  getIntegration(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getIntegration(user.companyId)
  }

  @Post('setup')
  setup(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetupIntegrationDto) {
    return this.svc.setupIntegration(user.companyId, dto)
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  testConnection(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.testConnection(user.companyId)
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.disconnectIntegration(user.companyId)
  }

  // ── Push ────────────────────────────────────────────────────────────────────

  @Post('push')
  @HttpCode(HttpStatus.OK)
  pushDocument(@CurrentUser() user: AuthenticatedUser, @Body() dto: PushDocumentDto) {
    return this.svc.pushDocument(user.companyId, dto.documentId)
  }

  @Post('push-all')
  @HttpCode(HttpStatus.OK)
  pushAll(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.pushAllProcessed(user.companyId)
  }

  // ── Sync logs ───────────────────────────────────────────────────────────────

  @Get('logs')
  getLogs(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getSyncLogs(user.companyId)
  }

  // ── Zoho OAuth ──────────────────────────────────────────────────────────────

  @Get('zoho/connect')
  @Redirect()
  zohoConnect(@CurrentUser() user: AuthenticatedUser) {
    const url = this.svc.getZohoAuthUrl(user.companyId)
    return { url }
  }

  @Get('zoho/callback')
  async zohoCallback(@Query('code') code: string, @Query('state') state: string) {
    await this.svc.handleZohoCallback(code, state)
    return { message: 'Zoho Books connected successfully' }
  }
}
