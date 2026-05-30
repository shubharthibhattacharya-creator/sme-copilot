import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ComplianceService } from './compliance.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { CreateChecklistDto } from './dto/create-checklist.dto'
import { UpdateChecklistDto } from './dto/update-checklist.dto'
import { UpsertTemplateDto } from './dto/upsert-template.dto'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly svc: ComplianceService) {}

  @Get('checklists')
  listChecklists(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId?: string,
    @Query('filingType') filingType?: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listChecklists(user.companyId, {
      clientId,
      filingType,
      period,
      status,
      assignedUserId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Get('checklists/:id')
  getChecklist(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.getChecklist(id, user.companyId)
  }

  @Post('checklists')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  createChecklist(@Body() dto: CreateChecklistDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.createChecklist(dto, user.companyId)
  }

  @Patch('checklists/:id')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  updateChecklist(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.updateChecklist(id, user.companyId, dto, user.userId)
  }

  @Delete('checklists/:id')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteChecklist(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.deleteChecklist(id, user.companyId)
  }

  @Post('checklists/:id/request-missing')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  requestMissing(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.requestMissingDocs(id, user.companyId, user.userId)
  }

  @Post('checklists/:id/link-document')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  linkDocument(
    @Param('id') id: string,
    @Body('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.linkDocument(id, documentId, user.companyId)
  }

  @Get('dashboard-summary')
  dashboardSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getDashboardSummary(user.companyId)
  }

  @Get('templates')
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.listTemplates(user.companyId)
  }

  @Post('templates')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  upsertTemplate(@Body() dto: UpsertTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.upsertTemplate(user.companyId, dto)
  }

  @Patch('templates/:id')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertTemplateDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.updateTemplate(id, user.companyId, dto)
  }
}
