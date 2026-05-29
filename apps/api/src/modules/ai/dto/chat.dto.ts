import { IsString, IsArray, IsOptional, ValidateNested, IsIn } from 'class-validator'
import { Type } from 'class-transformer'

class ChatMessage {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @IsString()
  content!: string
}

export class ChatDto {
  @IsString()
  message!: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  history?: ChatMessage[]
}
