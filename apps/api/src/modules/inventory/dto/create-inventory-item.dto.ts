import { IsString, IsInt, IsNumber, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateInventoryItemDto {
  @IsString()
  sku!: string

  @IsString()
  name!: string

  @IsString()
  category!: string

  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity!: number

  @IsInt()
  @Min(0)
  @Type(() => Number)
  reorderLevel!: number

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitCost!: number
}
