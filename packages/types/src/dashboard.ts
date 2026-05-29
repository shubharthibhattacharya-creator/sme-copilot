export interface CriticalCustomer {
  name: string
  overdueAmount: number
  oldestInvoiceDays: number
}

export interface LowStockItem {
  sku: string
  name: string
  quantity: number
  reorderLevel: number
  daysUntilStockout: number
}

export interface DashboardSummary {
  totalReceivables: number
  overdueAmount: number
  overdueCount: number
  avgAgingDays: number
  /** Week-over-week % change in paid invoices. Negative = collections declined. */
  collectionsTrend: number
  criticalCustomers: CriticalCustomer[]
  /** Count of InventoryItems where quantity <= reorderLevel */
  inventoryAlerts: number
  lowStockItems: LowStockItem[]
  generatedAt: string
  pendingDocuments: number
  documentsNeedingReview: number
}
