import { IsString, IsIn, IsOptional, Matches } from 'class-validator'

export class CreateChecklistDto {
  @IsString() clientId: string
  @IsIn(['GST_MONTHLY', 'GST_QUARTERLY', 'TDS_QUARTERLY', 'ITR_ANNUAL', 'CUSTOM']) filingType: string
  @IsString() @Matches(/^\d{4}-\d{2}$/) filingPeriod: string // YYYY-MM
  @IsOptional() @IsString() dueDate?: string
  @IsOptional() @IsString() assignedUserId?: string
}
