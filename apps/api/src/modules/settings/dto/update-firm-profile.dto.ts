import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class UpdateFirmProfileDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string
  @IsOptional() @IsString() logoUrl?: string
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN' })
  gstNumber?: string
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN' })
  panNumber?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() website?: string
}
