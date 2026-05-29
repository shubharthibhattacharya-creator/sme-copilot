import { IsNumber, IsOptional, Min, Max } from 'class-validator'

export class UpsertBusinessConfigDto {
  @IsOptional() @IsNumber() @Min(0) @Max(1) riskWeightAging?: number
  @IsOptional() @IsNumber() @Min(0) @Max(1) riskWeightAmount?: number
  @IsOptional() @IsNumber() @Min(0) @Max(1) riskWeightHistory?: number
  @IsOptional() @IsNumber() @Min(0) @Max(1) riskLowThreshold?: number
  @IsOptional() @IsNumber() @Min(0) @Max(1) riskMediumThreshold?: number
  @IsOptional() @IsNumber() @Min(1) agingBucket1Days?: number
  @IsOptional() @IsNumber() @Min(1) agingBucket2Days?: number
  @IsOptional() @IsNumber() @Min(1) agingBucket3Days?: number
  @IsOptional() @IsNumber() @Min(1) maxAgingDaysForScore?: number
  @IsOptional() @IsNumber() @Min(0) criticalOverdueAmount?: number
  @IsOptional() @IsNumber() @Min(0) warningOverdueCount?: number
  @IsOptional() @IsNumber() warningCollectionsTrendFloor?: number
}
