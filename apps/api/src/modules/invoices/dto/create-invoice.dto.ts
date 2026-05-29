import { IsString, IsOptional, IsDateString, IsNumber, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateInvoiceDto {
  @IsString()
  customerName!: string

  @IsOptional()
  @IsString()
  customerPhone?: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amount!: number

  @IsOptional()
  @IsString()
  currency?: string

  @IsDateString()
  dueDate!: string
}
