import { IsString, IsNotEmpty, IsIn } from 'class-validator'

export class UploadGstr2bDto {
  @IsString()
  @IsNotEmpty()
  filingPeriod!: string  // e.g. "Nov 2024"

  @IsIn(['PDF', 'EXCEL'])
  fileFormat!: 'PDF' | 'EXCEL'
}
