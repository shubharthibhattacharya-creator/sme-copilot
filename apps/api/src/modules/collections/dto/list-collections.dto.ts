import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class ListCollectionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number

  @IsOptional()
  @IsIn(['PENDING', 'OVERDUE', 'PAID', 'PARTIAL'])
  status?: 'PENDING' | 'OVERDUE' | 'PAID' | 'PARTIAL'

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'

  @IsOptional()
  @IsIn(['agingDays', 'amount', 'riskScore'])
  sortBy?: 'agingDays' | 'amount' | 'riskScore'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc'
}
