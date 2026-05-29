import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { IntegrationsClient } from '@/components/integrations/IntegrationsClient'

interface TaxIntegration {
  id: string
  provider: 'NONE' | 'CLEARTAX' | 'ZOHO_BOOKS' | 'TALLY'
  isActive: boolean
  clearTaxApiKey: string | null
  clearTaxOrgId: string | null
  zohoClientId: string | null
  zohoOrgId: string | null
  tallyBridgeUrl: string | null
  tallyCompanyName: string | null
  lastSyncAt: string | null
  lastSyncStatus: string
  updatedAt: string
}

interface SyncLog {
  id: string
  provider: string
  direction: string
  status: string
  errorMessage: string | null
  createdAt: string
  document: { id: string; originalName: string; documentType: string } | null
}

export default async function IntegrationsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [integration, logs] = await Promise.all([
    apiClient<TaxIntegration | null>('/api/v1/integrations', { cache: 'no-store' }).catch(() => null),
    apiClient<SyncLog[]>('/api/v1/integrations/logs', { cache: 'no-store' }).catch((): SyncLog[] => []),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Tax Software Integration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect to ClearTax, Zoho Books, or Tally to automatically sync filings
        </p>
      </div>
      <IntegrationsClient initialIntegration={integration} initialLogs={logs} />
    </div>
  )
}
