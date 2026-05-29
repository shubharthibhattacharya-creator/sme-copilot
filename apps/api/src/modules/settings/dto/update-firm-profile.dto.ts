import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateFirmProfileDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string
  @IsOptional() @IsString() logoUrl?: string
  @IsOptional() @IsString() @MaxLength(15) gstNumber?: string
  @IsOptional() @IsString() @MaxLength(10) panNumber?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() website?: string
}
