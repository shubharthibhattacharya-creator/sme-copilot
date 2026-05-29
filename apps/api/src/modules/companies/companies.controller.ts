import { Controller, Get, Patch, Body } from '@nestjs/common'
import { CompaniesService } from './companies.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '@opsc/types'
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto'
import { UpsertBusinessConfigDto } from './dto/upsert-business-config.dto'

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  getMyCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findById(user.companyId)
  }

  @Patch('me/config')
  @Roles('ADMIN')
  updateTenantConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTenantConfigDto,
  ) {
    return this.companiesService.updateTenantConfig(user.companyId, dto)
  }

  @Get('me/config/business')
  getBusinessConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getBusinessConfig(user.companyId)
  }

  @Patch('me/config/business')
  @Roles('ADMIN')
  upsertBusinessConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertBusinessConfigDto,
  ) {
    return this.companiesService.upsertBusinessConfig(user.companyId, dto)
  }
}
