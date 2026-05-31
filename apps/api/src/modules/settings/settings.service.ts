import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { UpdateFirmProfileDto } from './dto/update-firm-profile.dto'
import { ConfigService, ConfigSnapshot } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import { INDUSTRY_DEFAULTS, type IndustryType } from '@opsc/types'
import { AdminService } from '../admin/admin.service'
import { sanitiseModuleAccess, ROLE_DEFAULT_MODULES, ROLE_ACTION_PERMISSIONS } from '../../common/permissions/role-defaults'
import type { UserRole } from '@opsc/database'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly adminService: AdminService,
  ) {}

  async getFirmProfile(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, name: true, industry: true, subscriptionPlan: true,
        logoUrl: true, gstNumber: true, panNumber: true,
        address: true, website: true, phone: true, createdAt: true,
        tenantConfig: true,
      },
    })
    if (!company) throw new NotFoundException('Company not found')

    // Extract modulesEnabled from tenantConfig JSON, fall back to industry defaults
    const cfg = company.tenantConfig as Record<string, unknown> | null
    const modulesEnabled: string[] =
      Array.isArray(cfg?.['modulesEnabled']) ? (cfg!['modulesEnabled'] as string[]) : []
    const onboardingCompleted = cfg?.['onboardingCompleted'] === true

    return { ...company, modulesEnabled, onboardingCompleted }
  }

  async completeOnboarding(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { tenantConfig: true } })
    if (!company) throw new NotFoundException('Company not found')
    const cfg = (company.tenantConfig as Record<string, unknown> | null) ?? {}
    await this.prisma.company.update({
      where: { id: companyId },
      data: { tenantConfig: { ...cfg, onboardingCompleted: true } },
    })
    return { ok: true }
  }

  async updateFirmProfile(companyId: string, dto: UpdateFirmProfileDto) {
    const { industry, ...rest } = dto
    const data: Record<string, unknown> = { ...rest }

    if (industry && industry in INDUSTRY_DEFAULTS) {
      data['industry'] = industry
      data['tenantConfig'] = JSON.parse(JSON.stringify(INDUSTRY_DEFAULTS[industry as IndustryType]))
    }

    return this.prisma.company.update({ where: { id: companyId }, data })
  }

  async getConfig(companyId: string): Promise<ConfigSnapshot> {
    return this.configService.getAll(companyId)
  }

  async setConfig(companyId: string, key: string, value: unknown, userId: string) {
    await this.configService.set(companyId, key as ConfigKey, value, userId)
    return { key, value }
  }

  async resetConfig(companyId: string, key: string) {
    await this.configService.reset(companyId, key as ConfigKey)
    return { key, reset: true }
  }

  async listTeam(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, role: true, isActive: true, moduleAccess: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    })
  }

  async updateTeamMember(
    companyId: string,
    targetUserId: string,
    requestingUserId: string,
    dto: { role?: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'; moduleAccess?: string[] },
  ) {
    if (targetUserId === requestingUserId) {
      throw new ConflictException('You cannot change your own role or module access')
    }
    const target = await this.prisma.user.findFirst({ where: { id: targetUserId, companyId } })
    if (!target) throw new NotFoundException('User not found')

    const newRole = (dto.role ?? target.role) as UserRole

    // Last-admin check if demoting an ADMIN
    if (target.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { companyId, role: 'ADMIN', isActive: true } })
      if (adminCount <= 1) throw new ConflictException('Cannot change role — this user is the only admin in the firm')
    }

    const moduleAccess = dto.moduleAccess !== undefined
      ? sanitiseModuleAccess(newRole, dto.moduleAccess)
      : (newRole !== target.role ? ROLE_DEFAULT_MODULES[newRole] : target.moduleAccess as string[])

    const oldValues = { role: target.role, moduleAccess: target.moduleAccess }
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole, moduleAccess },
      select: { id: true, name: true, email: true, role: true, isActive: true, moduleAccess: true },
    })

    // Sync Clerk metadata
    try {
      await this.adminService.syncClerkUserMetadata(target.clerkId, { role: newRole, moduleAccess })
    } catch (err) {
      this.logger.warn(`Clerk metadata sync failed for ${targetUserId}: ${String(err)}`)
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        companyId, userId: requestingUserId,
        action: 'TEAM_MEMBER_UPDATED',
        entity: 'User', entityId: targetUserId,
        metadata: { old: oldValues, new: { role: newRole, moduleAccess } },
      },
    }).catch(() => undefined)

    return updated
  }

  async deactivateTeamMember(companyId: string, targetUserId: string, requestingUserId: string) {
    if (targetUserId === requestingUserId) {
      throw new ConflictException('You cannot deactivate your own account')
    }
    const target = await this.prisma.user.findFirst({ where: { id: targetUserId, companyId } })
    if (!target) throw new NotFoundException('User not found')

    if (target.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { companyId, role: 'ADMIN', isActive: true } })
      if (adminCount <= 1) throw new ConflictException('Cannot deactivate the only admin in the firm')
    }

    await this.prisma.user.update({ where: { id: targetUserId }, data: { isActive: false } })

    // Revoke Clerk session by deleting the Clerk user
    try {
      await this.adminService.deleteClerkUser(target.clerkId)
    } catch (err) {
      this.logger.warn(`Clerk user deletion failed for ${targetUserId}: ${String(err)}`)
    }

    await this.prisma.auditLog.create({
      data: {
        companyId, userId: requestingUserId,
        action: 'TEAM_MEMBER_DEACTIVATED',
        entity: 'User', entityId: targetUserId,
        metadata: { email: target.email, name: target.name },
      },
    }).catch(() => undefined)

    return { ok: true }
  }

  async getPendingInvitations(companyId: string) {
    return this.adminService.getPendingInvitations(companyId)
  }

  async resendInvitation(companyId: string, invitationId: string) {
    return this.adminService.resendInvitation(companyId, invitationId)
  }

  async revokeInvitation(invitationId: string) {
    return this.adminService.revokeInvitationById(invitationId)
  }

  async getMyPermissions(companyId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, moduleAccess: true },
    })
    if (!user) throw new NotFoundException('User not found')

    const role = user.role as UserRole
    const effectiveModules = user.moduleAccess.length > 0
      ? user.moduleAccess
      : ROLE_DEFAULT_MODULES[role]

    return {
      role,
      moduleAccess: effectiveModules,
      actionPermissions: ROLE_ACTION_PERMISSIONS[role],
      isAdmin: role === 'ADMIN',
      canManageTeam: role === 'ADMIN',
      canManageRules: role === 'ADMIN',
    }
  }

  // Keep old method for backwards compatibility
  async changeUserRole(companyId: string, userId: string, role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF') {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } })
    if (!user) throw new NotFoundException('User not found')
    return this.prisma.user.update({ where: { id: userId }, data: { role } })
  }

  async inviteTeamMember(
    companyId: string,
    dto: { email: string; role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'; moduleAccess?: string[] },
  ) {
    // Check for existing active user with same email in this company
    const existing = await this.prisma.user.findFirst({
      where: { companyId, email: dto.email, isActive: true },
    })
    if (existing) throw new ConflictException('A user with this email already exists in your firm')

    // Sanitise module access — cannot grant more than role allows
    const moduleAccess = dto.moduleAccess?.length
      ? sanitiseModuleAccess(dto.role as UserRole, dto.moduleAccess)
      : ROLE_DEFAULT_MODULES[dto.role as UserRole]

    await this.adminService.sendClerkInvite(dto.email, companyId, dto.role, moduleAccess)
    this.logger.log(`Team invite sent to ${dto.email} (${dto.role}) modules: [${moduleAccess.join(',')}] for company ${companyId}`)
    return { ok: true }
  }
}
