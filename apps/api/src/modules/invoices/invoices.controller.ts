import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common'
import { InvoicesService } from './invoices.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '@opsc/types'
import { CreateInvoiceDto } from './dto/create-invoice.dto'
import { ListInvoicesDto } from './dto/list-invoices.dto'
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto'

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInvoicesDto,
  ) {
    return this.invoicesService.list(user.companyId, query)
  }

  @Get('aging-summary')
  agingSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.agingSummary(user.companyId)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.invoicesService.findOne(user.companyId, id)
  }

  @Post()
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(user.companyId, dto)
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    return this.invoicesService.updateStatus(user.companyId, id, dto)
  }
}
