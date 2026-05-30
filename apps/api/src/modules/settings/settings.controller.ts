import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common'
import { SettingsService } from './settings.service'
import { UpdateFirmProfileDto } from './dto/update-firm-profile.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getFirmProfile(user.companyId)
  }

  @Post('complete-onboarding')
  @HttpCode(HttpStatus.OK)
  completeOnboarding(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.completeOnboarding(user.companyId)
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFirmProfileDto) {
    return this.settings.updateFirmProfile(user.companyId, dto)
  }

  @Get('config')
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getConfig(user.companyId)
  }

  @Patch('config/:key')
  setConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body('value') value: unknown,
  ) {
    return this.settings.setConfig(user.companyId, key, value, user.userId)
  }

  @Delete('config/:key')
  @HttpCode(HttpStatus.OK)
  resetConfig(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.settings.resetConfig(user.companyId, key)
  }

  @Get('team')
  listTeam(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.listTeam(user.companyId)
  }

  @Patch('team/:userId/role')
  changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body('role') role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF',
  ) {
    return this.settings.changeUserRole(user.companyId, userId, role)
  }

  @Post('team/invite')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  inviteTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { email: string; role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF' },
  ) {
    return this.settings.inviteTeamMember(user.companyId, dto)
  }
}
