import { Controller, Get, Patch, Body, Param } from '@nestjs/common'
import { UsersService } from './users.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '@opsc/types'
import { UpdateUserRoleDto } from './dto/update-user-role.dto'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  listUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findByCompany(user.companyId)
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.userId)
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') targetId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(user.companyId, targetId, dto.role)
  }
}
