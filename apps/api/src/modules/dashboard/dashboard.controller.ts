import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { DashboardService } from './dashboard.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { QUEUE_INSIGHTS } from '../../common/queue/queue.constants'
import type { InsightsJobData } from './insights.processor'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    @InjectQueue(QUEUE_INSIGHTS) private readonly insightsQueue: Queue<InsightsJobData>,
  ) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user)
  }

  @Get('insights')
  getInsights(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getInsights(user.companyId)
  }

  @Post('insights/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  async refreshInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Query('force') force?: string,
  ) {
    await this.insightsQueue.add('refresh', {
      companyId: user.companyId,
      force: force === 'true',
    })
    return { message: 'Insight generation started' }
  }
}
