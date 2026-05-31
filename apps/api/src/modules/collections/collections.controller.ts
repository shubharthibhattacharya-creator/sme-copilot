import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { CollectionsService } from './collections.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequireModuleAccess } from '../../common/decorators/require-module.decorator'
import type { AuthenticatedUser } from '@opsc/types'
import { ListCollectionsDto } from './dto/list-collections.dto'

@Controller('collections')
@RequireModuleAccess('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCollectionsDto,
  ) {
    return this.collectionsService.listWithRisk(user.companyId, query)
  }

  @Get('aging')
  agingBreakdown(@CurrentUser() user: AuthenticatedUser) {
    return this.collectionsService.getAgingBreakdown(user.companyId)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.collectionsService.findOne(user.companyId, id)
  }

  @Post(':id/remind')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  sendReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.collectionsService.sendReminder(id, user.companyId, user.userId)
  }

  @Post('risk/calculate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  calculateRisk(@CurrentUser() user: AuthenticatedUser) {
    this.collectionsService.calculateRiskScores(user.companyId)
    return { message: 'Risk calculation started' }
  }
}
