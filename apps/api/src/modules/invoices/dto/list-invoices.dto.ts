import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class ListInvoicesDto {
  @IsOptional()
  @IsIn(['PENDING', 'OVERDUE', 'PAID', 'PARTIAL'])
  status?: 'PENDING' | 'OVERDUE' | 'PAID' | 'PARTIAL'

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number
}
