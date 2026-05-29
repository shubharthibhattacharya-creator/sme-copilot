export class AgingBucketDto {
  label!: string
  minDays!: number
  maxDays!: number | null
  count!: number
  totalAmount!: number
  percentOfOverdue!: number
}

export class AgingBreakdownDto {
  buckets!: AgingBucketDto[]
  totalOverdue!: number
  totalCount!: number
}
