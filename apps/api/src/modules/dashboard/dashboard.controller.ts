import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name)

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user.companyId)
  }

  @Get('insights')
  getInsights(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getInsights(user.companyId)
  }

  @Post('insights/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  refreshInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Query('force') force?: string,
  ) {
    // Fire-and-forget — AI generation is async
    this.dashboardService.refreshInsights(user.companyId, force === 'true').catch((err: unknown) => {
      this.logger.error('Insight refresh failed for company ' + user.companyId, err)
    })
    return { message: 'Insight generation started' }
  }
}
