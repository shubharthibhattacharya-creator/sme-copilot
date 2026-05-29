import { IsIn } from 'class-validator'

export class GenerateInsightsDto {
  @IsIn(['DASHBOARD', 'COLLECTIONS', 'INVENTORY', 'WHATSAPP', 'REPORTING'])
  module!: 'DASHBOARD' | 'COLLECTIONS' | 'INVENTORY' | 'WHATSAPP' | 'REPORTING'
}
