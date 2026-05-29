import { IsEnum, IsOptional, IsDateString } from 'class-validator'
import { ReportType } from '@opsc/database'

export class CreateReportDto {
  @IsEnum(ReportType)
  reportType!: ReportType

  @IsOptional() @IsDateString() periodStart?: string
  @IsOptional() @IsDateString() periodEnd?: string
}
