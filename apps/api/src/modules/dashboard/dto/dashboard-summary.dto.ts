export class KpiMetricDto {
  current!: number
  previous!: number
  trendPct!: number
  trendDir!: 'up' | 'down' | 'flat'
  sparkline!: number[]
}

export class CriticalCustomerDto {
  name!: string
  overdueAmount!: number
  oldestInvoiceDays!: number
}

export class LowStockItemDto {
  sku!: string
  name!: string
  quantity!: number
  reorderLevel!: number
  daysUntilStockout!: number
}

export class DashboardSummaryDto {
  totalReceivables!: KpiMetricDto
  overdueAmount!: KpiMetricDto
  overdueCount!: KpiMetricDto
  avgDaysOverdue!: KpiMetricDto
  collectionsTrend!: number
  criticalCustomers!: CriticalCustomerDto[]
  inventoryAlerts!: number
  lowStockItems!: LowStockItemDto[]
  generatedAt!: string
  pendingDocuments!: number
  documentsNeedingReview!: number
}
