import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common'
import { InventoryService } from './inventory.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '@opsc/types'
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto'
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto'
import { ListInventoryDto } from './dto/list-inventory.dto'

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInventoryDto,
  ) {
    return this.inventoryService.list(user.companyId, query)
  }

  @Get('low-stock')
  lowStock(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.getLowStockItems(user.companyId)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.inventoryService.findOne(user.companyId, id)
  }

  @Post()
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.create(user.companyId, dto)
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(user.companyId, id, dto)
  }
}
