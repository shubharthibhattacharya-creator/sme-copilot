export interface PushDocumentPayload {
  documentId: string
  originalName: string
  documentType: string
  filingPeriod: string | null
  fileUrl: string
  clientGstin: string | null
  clientName: string
}

export interface PushDocumentResult {
  externalId: string | null
  raw: unknown
}

export interface FilingStatusResult {
  period: string
  status: 'FILED' | 'PENDING' | 'UNKNOWN'
  raw: unknown
}

export interface ITaxIntegrationAdapter {
  /** Returns true if credentials are valid and the provider is reachable */
  testConnection(companyId: string): Promise<boolean>
  /** Pushes a single document to the provider */
  pushDocument(companyId: string, payload: PushDocumentPayload): Promise<PushDocumentResult>
  /** Fetches filing status for a given GSTIN + period from the provider */
  getFilingStatus(companyId: string, gstin: string, period: string): Promise<FilingStatusResult>
}
