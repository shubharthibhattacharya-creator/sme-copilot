import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator'

export enum SendMessageType {
  FEE_REMINDER = 'FEE_REMINDER',
  DOC_REQUEST = 'DOC_REQUEST',
  DEADLINE_NUDGE = 'DEADLINE_NUDGE',
  PAYMENT_ACK = 'PAYMENT_ACK',
}

export class SendMessageDto {
  @IsEnum(SendMessageType)
  type: SendMessageType

  @IsString()
  @IsOptional()
  invoiceId?: string

  @IsString()
  @IsOptional()
  documentRequestId?: string

  // Override variables for the template (merged on top of auto-resolved vars)
  @IsObject()
  @IsOptional()
  variables?: Record<string, string>
}
