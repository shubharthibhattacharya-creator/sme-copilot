import { IsString, IsOptional, IsEnum, IsArray, IsInt, IsBoolean, Min, Max, Matches } from 'class-validator'
import { FilerType, FilingCategory } from '@opsc/database'

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GSTIN format (must be 15-char: 2 digits + 5 letters + 4 digits + 4 chars)',
  })
  gstin?: string

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'Invalid PAN format (must be 10-char: 5 letters + 4 digits + 1 letter)',
  })
  pan?: string

  @IsOptional() @IsString() contactPerson?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsString() address?: string

  @IsOptional()
  @IsEnum(FilerType)
  filerType?: FilerType

  @IsOptional()
  @IsEnum(FilingCategory)
  filingCategory?: FilingCategory

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceScope?: string[]

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  gstDeadlineDay?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
