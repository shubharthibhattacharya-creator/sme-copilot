import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ClientsService } from './clients.service'
import { GstinService } from './gstin.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { ListClientsDto } from './dto/list-clients.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly gstin: GstinService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListClientsDto) {
    return this.clients.list(user, query)
  }

  @Patch(':id/owner')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  setOwner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('ownerId') ownerId: string | null,
  ) {
    return this.clients.setOwner(user.companyId, id, ownerId ?? null)
  }

  @Post('bulk-assign-owners')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  @HttpCode(HttpStatus.OK)
  bulkSetOwners(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { assignments: { clientId: string; ownerId: string | null }[] },
  ) {
    return this.clients.bulkSetOwners(user.companyId, body.assignments)
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) {
    return this.clients.create(user.companyId, dto)
  }

  @Get(':id/stats')
  getStats(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clients.getStats(user.companyId, id)
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clients.findOne(user.companyId, id)
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(user.companyId, id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  softDelete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clients.softDelete(user.companyId, id)
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  importCsv(@CurrentUser() user: AuthenticatedUser, @Body('csv') csv: string) {
    return this.clients.importFromCsv(user.companyId, csv)
  }

  // ── GSTIN real-time lookup (called from form on blur) ───────────────────────
  @Get('gstin/validate')
  validateGstin(@Query('gstin') gstin: string) {
    return this.gstin.lookup(gstin)
  }
}
