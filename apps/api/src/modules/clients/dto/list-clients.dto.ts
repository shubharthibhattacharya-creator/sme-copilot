import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { FilerType } from '@opsc/database'

export class ListClientsDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  isActive?: boolean = true

  @IsOptional()
  @IsEnum(FilerType)
  filerType?: FilerType

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}
