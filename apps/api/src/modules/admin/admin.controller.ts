import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  HttpCode, HttpStatus, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AdminGuard } from './admin.guard'
import { AdminService } from './admin.service'
import { Public } from '../../common/decorators/public.decorator'
import type { IndustryType } from '@opsc/types'

@Public() // bypass Clerk — AdminGuard handles auth instead
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ── Platform stats ─────────────────────────────────────────────────────────

  @Get('stats')
  getStats() {
    return this.admin.getPlatformStats()
  }

  // ── Audit log ──────────────────────────────────────────────────────────────

  @Get('audit')
  getAudit(
    @Query('limit') limit?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.admin.getAuditLog(limit ? parseInt(limit, 10) : 50, companyId)
  }

  // ── Tenant management ──────────────────────────────────────────────────────

  @Get('tenants')
  listTenants() {
    return this.admin.listTenants()
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  createTenant(@Body() dto: {
    name: string
    industry: IndustryType
    subscriptionPlan: string
    adminEmail: string
    adminName: string
    gstNumber?: string
    panNumber?: string
    phone?: string
    address?: string
    modulesEnabled?: string[]
  }) {
    return this.admin.createTenant(dto)
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.admin.getTenant(id)
  }

  @Patch('tenants/:id')
  updateTenant(
    @Param('id') id: string,
    @Body() dto: {
      name?: string
      subscriptionPlan?: string
      gstNumber?: string
      panNumber?: string
      phone?: string
      address?: string
      modulesEnabled?: string[]
    },
  ) {
    return this.admin.updateTenant(id, dto)
  }

  @Delete('tenants/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivateTenant(@Param('id') id: string) {
    return this.admin.deactivateTenant(id)
  }

  // ── Client import ──────────────────────────────────────────────────────────

  @Post('tenants/:id/clients/import')
  @UseInterceptors(FileInterceptor('file'))
  importClients(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const csv = file.buffer.toString('utf-8')
    return this.admin.importClients(id, csv)
  }

  // ── Tenant config ──────────────────────────────────────────────────────────

  @Get('tenants/:id/config')
  getTenantConfig(@Param('id') id: string) {
    return this.admin.getTenantConfig(id)
  }

  @Patch('tenants/:id/config/:key')
  setTenantConfig(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body('value') value: unknown,
  ) {
    return this.admin.setTenantConfig(id, key, value)
  }

  @Delete('tenants/:id/config/:key')
  @HttpCode(HttpStatus.OK)
  resetTenantConfig(@Param('id') id: string, @Param('key') key: string) {
    return this.admin.resetTenantConfig(id, key)
  }

  // ── Knowledge base ─────────────────────────────────────────────────────────

  @Get('tenants/:id/knowledge')
  listKnowledge(@Param('id') id: string) {
    return this.admin.listKnowledge(id)
  }

  @Post('tenants/:id/knowledge')
  createKnowledge(
    @Param('id') id: string,
    @Body() dto: { title: string; category: string; content: string },
  ) {
    return this.admin.createKnowledge(id, dto)
  }

  @Delete('tenants/:id/knowledge/:docId')
  @HttpCode(HttpStatus.OK)
  deleteKnowledge(@Param('id') id: string, @Param('docId') docId: string) {
    return this.admin.deleteKnowledge(id, docId)
  }

  // ── Impersonation ──────────────────────────────────────────────────────────

  @Post('tenants/:id/impersonate')
  impersonate(@Param('id') id: string) {
    return this.admin.createImpersonation(id)
  }

  @Post('impersonate/verify')
  verifyImpersonation(@Body('token') token: string) {
    return this.admin.verifyImpersonation(token)
  }

  // ── System config ──────────────────────────────────────────────────────────

  @Get('system-config')
  getSystemConfig() {
    return this.admin.getSystemConfig()
  }

  @Patch('system-config/:key')
  updateSystemConfig(@Param('key') key: string, @Body('value') value: unknown) {
    return this.admin.updateSystemConfig(key, value)
  }
}
