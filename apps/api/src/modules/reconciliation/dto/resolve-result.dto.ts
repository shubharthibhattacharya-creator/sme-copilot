import { IsString, IsIn, IsOptional } from 'class-validator'

export class ResolveResultDto {
  @IsIn(['ACCEPT_MATCH', 'REJECT_MATCH', 'MANUAL_LINK'])
  action!: 'ACCEPT_MATCH' | 'REJECT_MATCH' | 'MANUAL_LINK'

  @IsOptional()
  @IsString()
  purchaseInvoiceId?: string  // required when action === MANUAL_LINK
}
