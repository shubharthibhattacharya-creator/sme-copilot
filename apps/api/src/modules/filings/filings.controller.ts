import { Body, Controller, Get, Post } from '@nestjs/common'
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

  @Post('bulk-request-docs')
  bulkRequestDocs(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { clientIds: string[]; sendWhatsApp?: boolean },
  ) {
    return this.filings.bulkRequestDocs(
      user.companyId,
      user.userId,
      body.clientIds ?? [],
      body.sendWhatsApp ?? true,
    )
  }

  @Post('bulk-nudge')
  bulkNudge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { clientIds: string[] },
  ) {
    return this.filings.bulkNudge(user.companyId, body.clientIds ?? [])
  }

  @Post('bulk-mark-filed')
  bulkMarkFiled(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { clientIds: string[] },
  ) {
    return this.filings.bulkMarkFiled(user.companyId, user.userId, body.clientIds ?? [])
  }
}
