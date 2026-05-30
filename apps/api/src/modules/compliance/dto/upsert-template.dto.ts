import { IsString, IsArray, IsOptional, IsObject, IsIn } from 'class-validator'

export class UpsertTemplateDto {
  @IsIn(['GST_MONTHLY', 'GST_QUARTERLY', 'TDS_QUARTERLY', 'ITR_ANNUAL', 'CUSTOM']) filingType: string
  @IsString() label: string
  @IsArray() @IsString({ each: true }) requiredDocTypes: string[]
  @IsOptional() @IsObject() minDocCounts?: Record<string, number>
}
