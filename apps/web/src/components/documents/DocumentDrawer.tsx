'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'
import { useApiError } from '@/hooks/useApiError'
import type { DocumentItem } from '@opsc/types'

interface Props {
  document: DocumentItem | null
  onClose: () => void
  onDeleted?: (id: string) => void
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

const OCR_LABEL: Record<string, { label: string; cls: string }> = {
  UPLOADED:     { label: 'Pending',    cls: 'text-gray-500' },
  PROCESSING:   { label: 'Extracting…', cls: 'text-blue-600' },
  PROCESSED:    { label: 'Done',       cls: 'text-green-600' },
  NEEDS_REVIEW: { label: 'Needs review', cls: 'text-amber-600' },
  FAILED:       { label: 'Failed',     cls: 'text-red-600' },
}

const SYNC_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING:        { label: 'Not synced',  cls: 'text-gray-400' },
  SYNCING:        { label: 'Syncing…',    cls: 'text-blue-600 animate-pulse' },
  SYNCED:         { label: 'Synced',      cls: 'text-green-600' },
  FAILED:         { label: 'Sync failed', cls: 'text-red-500' },
  NOT_APPLICABLE: { label: 'N/A',         cls: 'text-gray-400' },
}

const PROVIDER_LABEL: Record<string, string> = {
  CLEARTAX:   'ClearTax',
  ZOHO_BOOKS: 'Zoho Books',
  TALLY:      'Tally Prime',
}

function FileAttachment({ doc }: { doc: DocumentItem }) {
  const isImage = doc.mimeType.startsWith('image/')
  const isPdf = doc.mimeType === 'application/pdf'
  const fileUrl = doc.fileUrl

  if (!fileUrl) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-2xl">{isPdf ? '📄' : isImage ? '🖼️' : '📎'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{doc.originalName}</p>
          <p className="text-xs text-gray-400">Loading file link…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {isImage && (
        <div className="bg-gray-50 flex items-center justify-center max-h-64 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl} alt={doc.originalName} className="max-h-64 max-w-full object-contain" />
        </div>
      )}
      <div className="flex items-center gap-3 p-3 bg-white">
        <span className="text-xl">{isPdf ? '📄' : isImage ? '🖼️' : '📎'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{doc.originalName}</p>
          <p className="text-xs text-gray-400">{doc.mimeType}</p>
        </div>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 whitespace-nowrap"
        >
          {isPdf ? 'View PDF' : isImage ? 'Full size' : 'Download'}
        </a>
      </div>
    </div>
  )
}

export function DocumentDrawer({ document, onClose, onDeleted }: Props) {
  const { getToken } = useAuth()
  const { request } = useApiClient()
  const { handleError } = useApiError()
  const [detail, setDetail] = useState<DocumentItem | null>(document)
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch full detail (including fileUrl) whenever the document changes
  useEffect(() => {
    if (!document) { setDetail(null); return }
    setDetail(document) // show immediately with list data
    let cancelled = false
    getToken().then(token => {
      if (cancelled) return
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
      return fetch(`${apiUrl}/api/v1/documents/${document.id}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
    }).then(res => {
      if (!res || cancelled) return
      return res.ok ? res.json() : null
    }).then(data => {
      if (data && !cancelled) setDetail(data as DocumentItem)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [document?.id, getToken])

  // Poll while UPLOADED or PROCESSING
  useEffect(() => {
    if (!detail) return
    if (detail.status !== 'UPLOADED' && detail.status !== 'PROCESSING') return
    const interval = setInterval(async () => {
      const token = await getToken()
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/v1/documents/${detail.id}`, {
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
  }, [detail?.id, detail?.status, getToken])

  const deleteDocument = async () => {
    if (!detail) return
    setDeleting(true)
    try {
      await request(`/documents/${detail.id}`, { method: 'DELETE' })
      onDeleted?.(detail.id)
      onClose()
    } catch (e) {
      setConfirmDelete(false)
      setDeleting(false)
      handleError(e)
    }
  }

  const reprocess = async () => {
    if (!detail) return
    setReprocessing(true)
    setReprocessMsg(null)
    try {
      await request(`/documents/${detail.id}/reprocess`, { method: 'POST' })
      setDetail(prev => prev ? { ...prev, status: 'PROCESSING' } : prev)
      setReprocessMsg('Reprocessing started — status will update automatically.')
    } catch (e) {
      setReprocessMsg(e instanceof ApiError ? e.userMessage : (e as Error).message)
    } finally {
      setReprocessing(false)
    }
  }

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
      setPushMsg(e instanceof ApiError ? e.userMessage : (e as Error).message)
    } finally {
      setPushing(false)
    }
  }

  if (!document) return null

  const doc = detail ?? document
  const extractedData = doc.extractedData as Record<string, unknown> | null
  const confidence = extractedData?.confidence
  const syncInfo = doc.syncStatus ? SYNC_STATUS_LABEL[doc.syncStatus] : null
  const ocrInfo = OCR_LABEL[doc.status] ?? OCR_LABEL['FAILED']!

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-xl flex flex-col h-full overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 truncate pr-4">{doc.originalName}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-600 font-medium">Delete file?</span>
                <button
                  onClick={deleteDocument}
                  disabled={deleting}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? '…' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
                >
                  No
                </button>
              </div>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* File attachment */}
          <FileAttachment doc={doc} />

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wide">Type</span>
              <p className="font-medium mt-0.5">{doc.documentType.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wide">Uploaded by</span>
              <p className="font-medium mt-0.5">{doc.uploadedBy?.name ?? '—'}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wide">Upload status</span>
              <p className="font-medium mt-0.5 flex items-center gap-1.5 text-green-700">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Saved to storage
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wide">OCR / Extraction</span>
              <p className={`font-medium mt-0.5 flex items-center gap-1.5 ${ocrInfo.cls}`}>
                {(doc.status === 'UPLOADED' || doc.status === 'PROCESSING') && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
                )}
                {ocrInfo.label}
              </p>
            </div>
            <div suppressHydrationWarning>
              <span className="text-gray-500 text-xs uppercase tracking-wide">Date</span>
              <p className="font-medium mt-0.5">{new Date(doc.createdAt).toLocaleDateString('en-IN')}</p>
            </div>
            {doc.filingPeriod && (
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Filing period</span>
                <p className="font-medium mt-0.5">{doc.filingPeriod}</p>
              </div>
            )}
          </div>

          {/* Extraction confidence */}
          {typeof confidence === 'number' && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Extraction confidence</p>
              <ConfidenceBar value={confidence} />
            </div>
          )}

          {/* Extracted data */}
          {extractedData && Object.keys(extractedData).length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Extracted data</p>
              <div className="space-y-1">
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

          {/* Reprocess */}
          {(doc.status === 'FAILED' || doc.status === 'NEEDS_REVIEW') && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {doc.status === 'FAILED' ? 'OCR failed' : 'Needs manual review'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {doc.status === 'FAILED'
                      ? 'Re-run AI extraction on this document.'
                      : 'Low confidence — re-run to try again.'}
                  </p>
                </div>
                <button
                  onClick={reprocess}
                  disabled={reprocessing}
                  className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {reprocessing ? 'Starting…' : 'Reprocess'}
                </button>
              </div>
              {reprocessMsg && <p className="text-xs text-gray-500 mt-2">{reprocessMsg}</p>}
            </div>
          )}

          {/* Tax sync */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Tax Software Sync</p>
            <div className="flex items-center justify-between">
              <div className="text-sm space-y-0.5">
                {syncInfo
                  ? <span className={`font-medium ${syncInfo.cls}`}>{syncInfo.label}</span>
                  : <span className="text-gray-400">—</span>}
                {doc.syncProvider && doc.syncProvider !== 'NONE' && (
                  <p className="text-xs text-gray-400">
                    via {PROVIDER_LABEL[doc.syncProvider] ?? doc.syncProvider}
                    {doc.syncedAt ? ` · ${new Date(doc.syncedAt).toLocaleDateString('en-IN')}` : ''}
                  </p>
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
            {pushMsg && <p className="text-xs text-gray-500 mt-2">{pushMsg}</p>}
          </div>

        </div>
      </div>
    </div>
  )
}
