import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator'
import { DocumentType } from '@opsc/database'

export class CreateDocumentRequestDto {
  @IsString() requestedFromUserId!: string
  @IsEnum(DocumentType) documentType!: DocumentType
  @IsOptional() @IsDateString() dueDate?: string
  @IsOptional() @IsString() notes?: string
}
