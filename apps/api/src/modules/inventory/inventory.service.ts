import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@opsc/database'
import type { CreateInventoryItemDto } from './dto/create-inventory-item.dto'
import type { UpdateInventoryItemDto } from './dto/update-inventory-item.dto'
import type { ListInventoryDto } from './dto/list-inventory.dto'

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: ListInventoryDto) {
    const { category, page = 1, limit = 20 } = query
    const where: Prisma.InventoryItemWhereInput = {
      companyId,
      ...(category ? { category } : {}),
    }

    const [total, items] = await Promise.all([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async getLowStockItems(companyId: string) {
    // Raw query needed because Prisma doesn't support column-to-column comparisons
    return this.prisma.$queryRaw<Array<{ id: string; sku: string; name: string; quantity: number; reorderLevel: number }>>`
      SELECT id, sku, name, quantity, "reorderLevel"
      FROM inventory_items
      WHERE "companyId" = ${companyId}
        AND quantity <= "reorderLevel"
      ORDER BY quantity ASC
    `
  }

  async findOne(companyId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, companyId } })
    if (!item) throw new NotFoundException('Inventory item not found')
    return item
  }

  async create(companyId: string, dto: CreateInventoryItemDto) {
    return this.prisma.inventoryItem.create({
      data: { ...dto, companyId },
    })
  }

  async update(companyId: string, id: string, dto: UpdateInventoryItemDto) {
    await this.findOne(companyId, id)
    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.quantity !== undefined ? { lastMovementAt: new Date() } : {}),
      },
    })
  }
}
