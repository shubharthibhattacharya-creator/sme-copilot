import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator'

export enum TaxProviderDto {
  NONE = 'NONE',
  CLEARTAX = 'CLEARTAX',
  ZOHO_BOOKS = 'ZOHO_BOOKS',
  TALLY = 'TALLY',
}

export class SetupIntegrationDto {
  @IsEnum(TaxProviderDto)
  provider!: TaxProviderDto

  // ClearTax
  @IsOptional() @IsString() clearTaxApiKey?: string
  @IsOptional() @IsString() clearTaxClientSecret?: string
  @IsOptional() @IsString() clearTaxOrgId?: string

  // Zoho
  @IsOptional() @IsString() zohoClientId?: string
  @IsOptional() @IsString() zohoClientSecret?: string
  @IsOptional() @IsString() zohoOrgId?: string

  // Tally
  @IsOptional() @IsUrl() tallyBridgeUrl?: string
  @IsOptional() @IsString() tallyCompanyName?: string
}
