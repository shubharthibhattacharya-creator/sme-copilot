import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator'
import { DocumentType } from '@opsc/database'

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  documentType!: DocumentType

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  requestId?: string

  /** Filing period this document belongs to, e.g. "Nov 2024" */
  @IsOptional()
  @IsString()
  filingPeriod?: string

  /** Client ID to associate the document with */
  @IsOptional()
  @IsString()
  clientId?: string

  @IsOptional()
  @IsString()
  sourceModule?: string

  @IsOptional()
  @IsString()
  sourceChannel?: string

  @IsOptional()
  @IsIn(['FIRM', 'CLIENT'])
  documentOwner?: 'FIRM' | 'CLIENT'
}
