import { IsEnum, IsInt, IsOptional, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { DocumentType, DocumentStatus } from '@opsc/database'

export class ListDocumentsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20
  @IsOptional() @IsEnum(DocumentType) documentType?: DocumentType
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus
}
