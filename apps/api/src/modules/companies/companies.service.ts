import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { UpdateTenantConfigDto } from './dto/update-tenant-config.dto'
import type { UpsertBusinessConfigDto } from './dto/upsert-business-config.dto'

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    })
    if (!company) throw new NotFoundException('Company not found')
    return company
  }

  async updateTenantConfig(companyId: string, dto: UpdateTenantConfigDto) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { tenantConfig: JSON.parse(JSON.stringify(dto)) },
    })
  }

  async getBusinessConfig(companyId: string) {
    const config = await this.prisma.businessConfig.findUnique({ where: { companyId } })
    if (config) return config
    // Return defaults without creating a DB record
    return {
      companyId,
      riskWeightAging: 0.5,
      riskWeightAmount: 0.3,
      riskWeightHistory: 0.2,
      riskLowThreshold: 0.3,
      riskMediumThreshold: 0.6,
      agingBucket1Days: 30,
      agingBucket2Days: 60,
      agingBucket3Days: 90,
      maxAgingDaysForScore: 90,
      criticalOverdueAmount: 100000,
      warningOverdueCount: 5,
      warningCollectionsTrendFloor: -10,
    }
  }

  async upsertBusinessConfig(companyId: string, dto: UpsertBusinessConfigDto) {
    return this.prisma.businessConfig.upsert({
      where: { companyId },
      update: { ...dto },
      create: { companyId, ...dto },
    })
  }
}
