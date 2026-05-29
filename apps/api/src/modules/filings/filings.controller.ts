import { Controller, Get } from '@nestjs/common'
import { FilingsService } from './filings.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('filings')
export class FilingsController {
  constructor(private readonly filings: FilingsService) {}

  @Get('calendar')
  getCalendar(@CurrentUser() user: AuthenticatedUser) {
    return this.filings.getCalendar(user.companyId)
  }

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.filings.getSummary(user.companyId)
  }

  @Get('heatmap')
  getHeatmap(@CurrentUser() user: AuthenticatedUser) {
    return this.filings.getHeatmap(user.companyId)
  }
}
