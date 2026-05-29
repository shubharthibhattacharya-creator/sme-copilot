import { IsString, IsEnum, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator'
import { KnowledgeCategory } from '@opsc/database'

export class CreateKnowledgeDocumentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string

  @IsEnum(KnowledgeCategory)
  category: KnowledgeCategory

  @IsString()
  @MinLength(10)
  content: string
}

export class UpdateKnowledgeDocumentDto {
  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  content?: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}
