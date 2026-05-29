export type ReportType =
  | 'COLLECTIONS_AGING'
  | 'RECEIVABLES_SUMMARY'
  | 'INVENTORY_STATUS'
  | 'CASH_FLOW'
  | 'AI_INSIGHTS_DIGEST'

export type ReportStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'

export interface ReportItem {
  id: string
  reportType: ReportType
  status: ReportStatus
  format: string
  aiSummary?: string | null
  dataSnapshot?: Record<string, unknown> | null
  periodStart?: string | null
  periodEnd?: string | null
  createdAt: string
  updatedAt: string
  generatedBy: { id: string; name: string }
}
