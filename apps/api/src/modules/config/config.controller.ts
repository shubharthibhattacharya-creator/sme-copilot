import { Controller, Get, Patch, Delete, Param, Body } from '@nestjs/common'
import { ConfigService } from './config.service'
import { ConfigKey } from './config-key.enum'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.configService.getAll(user.companyId)
  }

  @Patch(':key')
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body('value') value: unknown,
  ) {
    return this.configService.set(user.companyId, key as ConfigKey, value, user.userId)
  }

  @Delete(':key')
  reset(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.configService.reset(user.companyId, key as ConfigKey)
  }
}
