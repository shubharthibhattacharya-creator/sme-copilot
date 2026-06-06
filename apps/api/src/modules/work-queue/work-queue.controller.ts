import { Controller, Get, Query } from '@nestjs/common'
import { WorkQueueService } from './work-queue.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller()
export class WorkQueueController {
  constructor(private readonly workQueue: WorkQueueService) {}

  @Get('my-work')
  getMyWork(@CurrentUser() user: AuthenticatedUser) {
    return this.workQueue.getMyWork(user)
  }

  @Get('admin/workload')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  getWorkload(@CurrentUser() user: AuthenticatedUser) {
    return this.workQueue.getWorkload(user.companyId)
  }
}
