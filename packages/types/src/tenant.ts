export type IndustryType = 'CA_FIRM' | 'DISTRIBUTOR' | 'MANUFACTURER'

export type ModuleKey =
  | 'dashboard'
  | 'collections'
  | 'inventory'
  | 'whatsapp'
  | 'reporting'
  | 'documents'
  | 'assistant'
  | 'filings'

export interface TenantConfig {
  industryType: IndustryType
  modulesEnabled: ModuleKey[]
  aiPersona: 'collections-focused' | 'inventory-focused' | 'compliance-focused'
  whatsappEnabled: boolean
  documentTypes: string[]
  defaultCurrency: 'INR'
  taxIntegration?: {
    provider: 'NONE' | 'CLEARTAX' | 'ZOHO_BOOKS' | 'TALLY'
    isActive: boolean
  }
}

// Industry defaults — used during onboarding to pre-populate tenantConfig
export const INDUSTRY_DEFAULTS: Record<IndustryType, TenantConfig> = {
  CA_FIRM: {
    industryType: 'CA_FIRM',
    modulesEnabled: ['dashboard', 'collections', 'filings', 'reporting', 'documents', 'assistant'],
    aiPersona: 'compliance-focused',
    whatsappEnabled: true,
    documentTypes: ['invoice', 'gst_return', 'tds_certificate', 'statement'],
    defaultCurrency: 'INR',
  },
  DISTRIBUTOR: {
    industryType: 'DISTRIBUTOR',
    modulesEnabled: ['dashboard', 'collections', 'inventory', 'whatsapp', 'reporting'],
    aiPersona: 'collections-focused',
    whatsappEnabled: true,
    documentTypes: ['invoice', 'purchase_order', 'delivery_note'],
    defaultCurrency: 'INR',
  },
  MANUFACTURER: {
    industryType: 'MANUFACTURER',
    modulesEnabled: ['dashboard', 'inventory', 'reporting', 'documents', 'assistant'],
    aiPersona: 'inventory-focused',
    whatsappEnabled: false,
    documentTypes: ['invoice', 'purchase_order', 'delivery_note', 'quality_report'],
    defaultCurrency: 'INR',
  },
}
