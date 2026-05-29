'use client'
import { useState, useCallback } from 'react'
import { useApiClient } from '@/lib/client-api'

type TaxProvider = 'NONE' | 'CLEARTAX' | 'ZOHO_BOOKS' | 'TALLY'

interface TaxIntegration {
  id: string
  provider: TaxProvider
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

interface Props {
  initialIntegration: TaxIntegration | null
  initialLogs: SyncLog[]
}

const STATUS_STYLES: Record<string, string> = {
  SYNCED:  'bg-green-100 text-green-700',
  FAILED:  'bg-red-100 text-red-700',
  SYNCING: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-gray-100 text-gray-600',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

export function IntegrationsClient({ initialIntegration, initialLogs }: Props) {
  const { request } = useApiClient()
  const [integration, setIntegration] = useState<TaxIntegration | null>(initialIntegration)
  const [logs, setLogs] = useState<SyncLog[]>(initialLogs)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // ClearTax form state
  const [ctApiKey, setCtApiKey] = useState('')
  const [ctSecret, setCtSecret] = useState('')
  const [ctOrgId, setCtOrgId] = useState(integration?.clearTaxOrgId ?? '')

  // Zoho form state
  const [zohoClientId, setZohoClientId] = useState(integration?.zohoClientId ?? '')
  const [zohoClientSecret, setZohoClientSecret] = useState('')
  const [zohoOrgId, setZohoOrgId] = useState(integration?.zohoOrgId ?? '')

  // Tally form state
  const [tallyBridgeUrl, setTallyBridgeUrl] = useState(integration?.tallyBridgeUrl ?? 'http://localhost:9998')
  const [tallyCompany, setTallyCompany] = useState(integration?.tallyCompanyName ?? '')

  const active = integration?.provider ?? 'NONE'

  const refreshData = useCallback(async () => {
    const [i, l] = await Promise.all([
      request<TaxIntegration | null>('/integrations').catch(() => null),
      request<SyncLog[]>('/integrations/logs').catch((): SyncLog[] => []),
    ])
    setIntegration(i)
    setLogs(l)
  }, [request])

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const save = async (provider: TaxProvider, data: Record<string, string>) => {
    setSaving(true)
    try {
      const result = await request<TaxIntegration>('/integrations/setup', {
        method: 'POST',
        body: JSON.stringify({ provider, ...data }),
      })
      setIntegration(result)
      showMsg('Settings saved.', true)
    } catch (e) {
      showMsg((e as Error).message, false)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const r = await request<{ ok: boolean; message: string }>('/integrations/test', { method: 'POST' })
      showMsg(r.message, r.ok)
      if (r.ok) await refreshData()
    } catch (e) {
      showMsg((e as Error).message, false)
    } finally {
      setTesting(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Disconnect the integration? Your sync history will be preserved.')) return
    await request('/integrations', { method: 'DELETE' }).catch(() => null)
    await refreshData()
    showMsg('Integration disconnected.', true)
  }

  const pushAll = async () => {
    try {
      const r = await request<{ queued: number }>('/integrations/push-all', { method: 'POST' })
      showMsg(`${r.queued} document${r.queued !== 1 ? 's' : ''} queued for sync.`, true)
      setTimeout(refreshData, 5000)
    } catch (e) {
      showMsg((e as Error).message, false)
    }
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Status bar */}
      {integration && active !== 'NONE' && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${integration.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium text-gray-900">
              {PROVIDER_LABEL[active]} {integration.isActive ? '— Connected' : '— Not verified'}
            </span>
            {integration.lastSyncAt && (
              <span className="text-xs text-gray-400">
                Last sync: {new Date(integration.lastSyncAt).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={pushAll}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              Sync all processed
            </button>
            <button
              onClick={testConnection}
              disabled={testing}
              className="text-xs text-blue-600 hover:underline"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button onClick={disconnect} className="text-xs text-red-500 hover:underline">
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* ClearTax */}
      <Section title="ClearTax">
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Connect via OAuth client credentials. Get your API key from{' '}
            <span className="font-medium text-gray-700">ClearTax Dashboard → API Access</span>.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="API Key" name="ctApiKey" type="password" placeholder={integration?.clearTaxApiKey ?? 'sk-ct-…'} value={ctApiKey} onChange={setCtApiKey} />
            <Field label="Client Secret" name="ctSecret" type="password" placeholder="Enter new secret to update" value={ctSecret} onChange={setCtSecret} />
            <Field label="Organisation ID" name="ctOrgId" placeholder="org_xxxxx" value={ctOrgId} onChange={setCtOrgId} />
          </div>
          <button
            disabled={saving}
            onClick={() => save('CLEARTAX', {
              clearTaxApiKey: ctApiKey,
              clearTaxClientSecret: ctSecret,
              clearTaxOrgId: ctOrgId,
            })}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : active === 'CLEARTAX' ? 'Update ClearTax' : 'Connect ClearTax'}
          </button>
        </div>
      </Section>

      {/* Zoho Books */}
      <Section title="Zoho Books">
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Connect via OAuth. Create a self-client app in{' '}
            <span className="font-medium text-gray-700">Zoho API Console → Create Client</span> with scope{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">ZohoBooks.gstreturns.ALL</code>.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Client ID" name="zohoClientId" placeholder="1000.xxxxx" value={zohoClientId} onChange={setZohoClientId} />
            <Field label="Client Secret" name="zohoClientSecret" type="password" placeholder="Enter to update" value={zohoClientSecret} onChange={setZohoClientSecret} />
            <Field label="Organisation ID" name="zohoOrgId" placeholder="12345678" value={zohoOrgId} onChange={setZohoOrgId} />
          </div>
          <div className="flex gap-3">
            <button
              disabled={saving}
              onClick={() => save('ZOHO_BOOKS', {
                zohoClientId,
                zohoClientSecret,
                zohoOrgId,
              })}
              className="text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Zoho credentials'}
            </button>
            <a
              href="/api/v1/integrations/zoho/connect"
              className="text-sm bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 inline-block"
            >
              Authorise with Zoho →
            </a>
          </div>
        </div>
      </Section>

      {/* Tally */}
      <Section title="Tally Prime">
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Requires the OpsCopilot Tally Bridge running on the same PC as Tally Prime.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Bridge URL" name="tallyBridgeUrl" placeholder="http://localhost:9998" value={tallyBridgeUrl} onChange={setTallyBridgeUrl} />
            <Field label="Tally Company Name" name="tallyCompany" placeholder="My CA Firm Ltd" value={tallyCompany} onChange={setTallyCompany} />
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium text-gray-700">Setup instructions</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600 text-xs">
              <li>Enable HTTP server in Tally Prime (Help → Settings → Connectivity) on port 9000</li>
              <li>Download and extract the Tally Bridge on the same PC</li>
              <li>Run <code className="bg-gray-100 px-1 rounded">npm install && npm start</code></li>
              <li>Enter the Bridge URL above and click Connect</li>
            </ol>
            <a
              href="/tally-bridge.zip"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mt-1"
            >
              ↓ Download Tally Bridge
            </a>
          </div>

          <button
            disabled={saving}
            onClick={() => save('TALLY', { tallyBridgeUrl, tallyCompanyName: tallyCompany })}
            className="text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : active === 'TALLY' ? 'Update Tally' : 'Connect Tally'}
          </button>
        </div>
      </Section>

      {/* Sync log */}
      <Section title="Sync History">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400">No sync events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left py-2 pr-4">Time</th>
                  <th className="text-left py-2 pr-4">Provider</th>
                  <th className="text-left py-2 pr-4">Document</th>
                  <th className="text-left py-2 pr-4">Direction</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 pr-4 text-xs font-medium text-gray-700">
                      {PROVIDER_LABEL[log.provider as TaxProvider] ?? log.provider}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-600 truncate max-w-[200px]" title={log.document?.originalName}>
                      {log.document?.originalName ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500">{log.direction}</td>
                    <td className="py-2">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[log.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.status}
                      </span>
                      {log.errorMessage && (
                        <span className="ml-2 text-xs text-red-500 truncate max-w-[180px]" title={log.errorMessage}>
                          {log.errorMessage.slice(0, 60)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

const PROVIDER_LABEL: Record<string, string> = {
  NONE: 'None',
  CLEARTAX: 'ClearTax',
  ZOHO_BOOKS: 'Zoho Books',
  TALLY: 'Tally Prime',
}
