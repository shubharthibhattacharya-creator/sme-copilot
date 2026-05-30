export type DocumentType =
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'DELIVERY_NOTE'
  | 'GST_RETURN'
  | 'TDS_CERTIFICATE'
  | 'BANK_STATEMENT'
  | 'FORM_16'
  | 'OTHER'

export type DocumentStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'NEEDS_REVIEW'

export type RequestStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED'

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'NOT_APPLICABLE'
export type TaxProvider = 'NONE' | 'CLEARTAX' | 'ZOHO_BOOKS' | 'TALLY'

export interface DocumentItem {
  id: string
  documentType: DocumentType
  status: DocumentStatus
  originalName: string
  fileSizeBytes: number
  mimeType: string
  notes?: string | null
  extractedData?: Record<string, unknown> | null
  fileUrl?: string
  filingPeriod?: string | null
  syncStatus?: SyncStatus
  syncProvider?: TaxProvider | null
  syncedAt?: string | null
  externalId?: string | null
  syncError?: string | null
  createdAt: string
  updatedAt: string
  uploadedBy: { id: string; name: string }
  documentOwner?: 'FIRM' | 'CLIENT'
  documentPurpose?: 'RECEIVABLE' | 'TAX_PREPARATION' | 'FIRM_RECORD' | 'UNKNOWN'
  classificationSource?: string | null
  sourceChannel?: string | null
  gstinConflict?: boolean
  gstinConflictNote?: string | null
  linkedInvoiceId?: string | null
  linkedInvoiceCreated?: boolean
}

export interface DocumentRequest {
  id: string
  documentType: DocumentType
  status: RequestStatus
  dueDate?: string | null
  notes?: string | null
  createdAt: string
  requestedBy: { id: string; name: string }
  requestedFromUser: { id: string; name: string }
  fulfilledDocument?: { id: string; originalName: string; status: DocumentStatus } | null
}

export interface BusinessConfig {
  companyId: string
  riskWeightAging: number
  riskWeightAmount: number
  riskWeightHistory: number
  riskLowThreshold: number
  riskMediumThreshold: number
  agingBucket1Days: number
  agingBucket2Days: number
  agingBucket3Days: number
  maxAgingDaysForScore: number
  criticalOverdueAmount: number
  warningOverdueCount: number
  warningCollectionsTrendFloor: number
}
