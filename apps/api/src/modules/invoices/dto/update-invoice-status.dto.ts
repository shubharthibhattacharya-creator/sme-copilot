import { IsIn } from 'class-validator'

export class UpdateInvoiceStatusDto {
  @IsIn(['PENDING', 'OVERDUE', 'PAID', 'PARTIAL'])
  status!: 'PENDING' | 'OVERDUE' | 'PAID' | 'PARTIAL'
}
