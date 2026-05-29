import { IsString } from 'class-validator'

export class PushDocumentDto {
  @IsString()
  documentId!: string
}
