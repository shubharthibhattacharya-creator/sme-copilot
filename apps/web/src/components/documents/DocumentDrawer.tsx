'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useApiClient } from '@/lib/client-api'
import type { DocumentItem } from '@opsc/types'

interface Props {
  document: DocumentItem | null
  onClose: () => void
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.8 ? 'bg-green-500' : value >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
  const label = value >= 0.8 ? 'High confidence' : value >= 0.6 ? 'Review recommended' : 'Low confidence — verify manually'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const SYNC_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING:        { label: 'Not synced',  cls: 'text-gray-400' },
  SYNCING:        { label: 'Syncing…',    cls: 'text-blue-600 animate-pulse' },
  SYNCED:         { label: 'Synced',      cls: 'text-green-600' },
  FAILED:         { label: 'Sync failed', cls: 'text-red-500' },
  NOT_APPLICABLE: { label: 'N/A',         cls: 'text-gray-400' },
}

export function DocumentDrawer({ document, onClose }: Props) {
  const { getToken } = useAuth()
  const { request } = useApiClient()
  const [detail, setDetail] = useState<DocumentItem | null>(document)
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  useEffect(() => {
    setDetail(document)
    if (!document) return

    // Poll until processed
    if (document.status === 'UPLOADED' || document.status === 'PROCESSING') {
      const interval = setInterval(async () => {
        const token = await getToken()
        const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
        const res = await fetch(`${apiUrl}/api/v1/documents/${document.id}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        })
        if (res.ok) {
          const updated = await res.json() as DocumentItem
          setDetail(updated)
          if (updated.status !== 'UPLOADED' && updated.status !== 'PROCESSING') {
            clearInterval(interval)
          }
        }
      }, 3000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [document, getToken])

  const pushToIntegration = async () => {
    if (!detail) return
    setPushing(true)
    setPushMsg(null)
    try {
      await request('/integrations/push', {
        method: 'POST',
        body: JSON.stringify({ documentId: detail.id }),
      })
      setPushMsg('Document queued for sync.')
    } catch (e) {
      setPushMsg((e as Error).message)
    } finally {
      setPushing(false)
    }
  }

  if (!document) return null

  const doc = detail ?? document
  const extractedData = doc.extractedData as Record<string, unknown> | null
  const confidence = extractedData?.confidence
  const syncInfo = doc.syncStatus ? SYNC_STATUS_LABEL[doc.syncStatus] : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 truncate">{doc.originalName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Type</span><br /><span className="font-medium">{doc.documentType.replace(/_/g, ' ')}</span></div>
            <div><span className="text-gray-500">Status</span><br /><span className="font-medium">{doc.status}</span></div>
            <div><span className="text-gray-500">Uploaded by</span><br /><span className="font-medium">{doc.uploadedBy.name}</span></div>
            <div><span className="text-gray-500">Date</span><br /><span className="font-medium">{new Date(doc.createdAt).toLocaleDateString('en-IN')}</span></div>
          </div>

          {(doc.status === 'UPLOADED' || doc.status === 'PROCESSING') && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Processing document — extracting data...
            </div>
          )}

          {typeof confidence === 'number' && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Extraction confidence</p>
              <ConfidenceBar value={confidence} />
            </div>
          )}

          {extractedData && Object.keys(extractedData).length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Extracted data</p>
              <div className="space-y-2">
                {Object.entries(extractedData)
                  .filter(([k]) => k !== 'confidence' && k !== 'documentType' && k !== 'error' && k !== 'raw')
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium text-gray-900 text-right max-w-48 truncate">
                        {value === null ? '—' : String(value)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {doc.notes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
              <p className="text-sm text-gray-600">{doc.notes}</p>
            </div>
          )}

          {/* Tax integration sync section */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Tax Software Sync</p>
            <div className="flex items-center justify-between">
              <div className="text-sm space-y-0.5">
                {syncInfo ? (
                  <span className={`font-medium ${syncInfo.cls}`}>{syncInfo.label}</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
                {doc.syncProvider && doc.syncProvider !== 'NONE' && (
                  <p className="text-xs text-gray-400">
                    via {PROVIDER_LABEL[doc.syncProvider] ?? doc.syncProvider}
                    {doc.syncedAt ? ` · ${new Date(doc.syncedAt).toLocaleDateString('en-IN')}` : ''}
                  </p>
                )}
                {doc.externalId && (
                  <p className="text-xs text-gray-400 font-mono">ID: {doc.externalId}</p>
                )}
                {doc.syncError && (
                  <p className="text-xs text-red-400 max-w-xs truncate" title={doc.syncError}>{doc.syncError}</p>
                )}
              </div>
              {doc.status === 'PROCESSED' && doc.syncStatus !== 'SYNCING' && (
                <button
                  onClick={pushToIntegration}
                  disabled={pushing}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {pushing ? 'Pushing…' : doc.syncStatus === 'SYNCED' ? 'Re-sync' : 'Push to integration'}
                </button>
              )}
            </div>
            {pushMsg && (
              <p className="text-xs text-gray-500 mt-2">{pushMsg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const PROVIDER_LABEL: Record<string, string> = {
  CLEARTAX:  'ClearTax',
  ZOHO_BOOKS: 'Zoho Books',
  TALLY:     'Tally Prime',
}
