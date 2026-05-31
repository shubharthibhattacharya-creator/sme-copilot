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

  @Post('tenants/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivateTenant(@Param('id') id: string) {
    return this.admin.reactivateTenant(id)
  }

  // ── User management ────────────────────────────────────────────────────────

  @Get('tenants/:id/users')
  listUsers(@Param('id') id: string) {
    return this.admin.listUsers(id)
  }

  @Post('tenants/:id/users')
  @HttpCode(HttpStatus.CREATED)
  addUser(
    @Param('id') id: string,
    @Body() dto: { email: string; name: string; role?: string },
  ) {
    return this.admin.addUser(id, dto)
  }

  @Patch('tenants/:id/users/:userId')
  @HttpCode(HttpStatus.OK)
  updateUserRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('role') role: string,
  ) {
    return this.admin.updateUserRole(id, userId, role)
  }

  @Delete('tenants/:id/users/:userId')
  @HttpCode(HttpStatus.OK)
  removeUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.admin.removeUser(id, userId)
  }

  // ── Pending invitations ────────────────────────────────────────────────────

  @Get('tenants/:id/invitations')
  listInvitations(@Param('id') id: string) {
    return this.admin.getPendingInvitations(id)
  }

  @Post('tenants/:id/invitations/:invId/resend')
  @HttpCode(HttpStatus.OK)
  resendInvitationById(
    @Param('id') id: string,
    @Param('invId') invId: string,
  ) {
    return this.admin.resendInvitation(id, invId)
  }

  @Delete('tenants/:id/invitations/:invId')
  @HttpCode(HttpStatus.OK)
  revokeInvitation(@Param('invId') invId: string) {
    return this.admin.revokeInvitationById(invId)
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

  // ── Invite ────────────────────────────────────────────────────────────────

  @Post('tenants/:id/invite')
  @HttpCode(HttpStatus.OK)
  resendInvite(
    @Param('id') id: string,
    @Body() dto: { email: string; role?: string },
  ) {
    return this.admin.resendInvite(id, dto.email, dto.role)
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
