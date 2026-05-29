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
  totalReceivables!: number
  overdueAmount!: number
  overdueCount!: number
  avgAgingDays!: number
  collectionsTrend!: number
  criticalCustomers!: CriticalCustomerDto[]
  inventoryAlerts!: number
  lowStockItems!: LowStockItemDto[]
  generatedAt!: string
  pendingDocuments!: number
  documentsNeedingReview!: number
}
