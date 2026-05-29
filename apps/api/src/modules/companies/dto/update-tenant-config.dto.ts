import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator'
import type { ModuleKey } from '@opsc/types'

export class UpdateTenantConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modulesEnabled?: ModuleKey[]

  @IsOptional()
  @IsIn(['collections-focused', 'inventory-focused', 'compliance-focused'])
  aiPersona?: string

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentTypes?: string[]
}
