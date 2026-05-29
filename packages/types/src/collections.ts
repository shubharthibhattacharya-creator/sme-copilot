export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNSCORED'

export interface InvoiceWithRisk {
  id: string
  companyId: string
  customerName: string
  customerPhone: string | null
  amount: number
  currency: string
  dueDate: string
  paidAt: string | null
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'PARTIAL'
  agingDays: number
  createdAt: string
  updatedAt: string
  riskScore: number | null
  riskLevel: RiskLevel
  predictedDelayDays: number | null
}

export interface AgingBucket {
  label: string
  minDays: number
  maxDays: number | null
  count: number
  totalAmount: number
  percentOfOverdue: number
}

export interface AgingBreakdown {
  buckets: AgingBucket[]
  totalOverdue: number
  totalCount: number
}
