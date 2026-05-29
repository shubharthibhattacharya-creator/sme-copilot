import { IsString, IsInt, IsNumber, IsOptional, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  reorderLevel?: number

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitCost?: number
}
