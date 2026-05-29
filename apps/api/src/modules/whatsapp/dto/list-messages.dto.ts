import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { MessageStatus, MessageDirection } from '@opsc/database'

export class ListMessagesDto {
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus

  @IsOptional()
  @IsEnum(MessageDirection)
  direction?: MessageDirection

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}
