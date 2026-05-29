import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { UpdateFirmProfileDto } from './dto/update-firm-profile.dto'
import { ConfigService, ConfigSnapshot } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import { INDUSTRY_DEFAULTS, type IndustryType } from '@opsc/types'
import { AdminService } from '../admin/admin.service'

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

    return { ...company, modulesEnabled }
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
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
  }

  async changeUserRole(companyId: string, userId: string, role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF') {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } })
    if (!user) throw new NotFoundException('User not found')
    return this.prisma.user.update({ where: { id: userId }, data: { role } })
  }

  async inviteTeamMember(
    companyId: string,
    dto: { email: string; role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF' },
  ) {
    // Check for existing active user with same email in this company
    const existing = await this.prisma.user.findFirst({
      where: { companyId, email: dto.email, isActive: true },
    })
    if (existing) throw new ConflictException('A user with this email already exists in your firm')

    await this.adminService.sendClerkInvite(dto.email, companyId, dto.role)
    this.logger.log(`Team invite sent to ${dto.email} (${dto.role}) for company ${companyId}`)
    return { ok: true }
  }
}
