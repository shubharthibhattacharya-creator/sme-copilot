export interface KpiMetric {
  current: number
  previous: number
  trendPct: number
  trendDir: 'up' | 'down' | 'flat'
  sparkline: number[]
}

export interface CriticalCustomer {
  name: string
  overdueAmount: number
  oldestInvoiceDays: number
  phone?: string
  email?: string
  invoiceId?: string
}

export interface LowStockItem {
  sku: string
  name: string
  quantity: number
  reorderLevel: number
  daysUntilStockout: number
}

export interface DashboardSummary {
  totalReceivables: KpiMetric
  overdueAmount: KpiMetric
  overdueCount: KpiMetric
  avgDaysOverdue: KpiMetric
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
