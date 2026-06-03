'use client'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

type ReconStatus = 'MATCHED' | 'POSSIBLE_MATCH' | 'NOT_IN_VAULT' | 'NOT_IN_GSTR2B'

interface LineItem {
  vendorGstin: string | null
  vendorName: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  totalAmount: string | null
}

interface PurchaseInvoice {
  id: string
  vendorName: string | null
  vendorGstin: string | null
  invoiceNumber: string | null
  totalAmount: string | null
  document: { originalName: string; id: string }
}

interface Result {
  id: string
  status: ReconStatus
  matchScore: number
  remarks: Record<string, unknown>
  userAction: string | null
  lineItem: LineItem | null
  purchaseInvoice: PurchaseInvoice | null
}

interface Upload {
  id: string
  filingPeriod: string
  totalLineItems: number
  matchedCount: number
  possibleCount: number
  notInVaultCount: number
  notInGstr2bCount: number
}

interface Props {
  initialData: { upload: Upload; results: Result[] }
}

const STATUS_STYLES: Record<ReconStatus, { badge: string; label: string }> = {
  MATCHED:        { badge: 'bg-green-100 text-green-700',  label: 'Matched' },
  POSSIBLE_MATCH: { badge: 'bg-amber-100 text-amber-700',  label: 'Possible match' },
  NOT_IN_VAULT:   { badge: 'bg-red-100 text-red-700',      label: 'Not in vault' },
  NOT_IN_GSTR2B:  { badge: 'bg-gray-100 text-gray-600',    label: 'Not in GSTR-2B' },
}

const TABS: { key: ReconStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',           label: 'All' },
  { key: 'MATCHED',       label: 'Matched' },
  { key: 'POSSIBLE_MATCH',label: 'Possible' },
  { key: 'NOT_IN_VAULT',  label: 'Not in vault' },
  { key: 'NOT_IN_GSTR2B', label: 'Not in GSTR-2B' },
]

export function ReconResultsClient({ initialData }: Props) {
  const { getToken } = useAuth()
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [activeTab, setActiveTab] = useState<ReconStatus | 'ALL'>('ALL')
  const [resolving, setResolving] = useState<string | null>(null)

  const { upload, results } = data

  const filtered = activeTab === 'ALL' ? results : results.filter((r) => r.status === activeTab)

  async function resolveResult(resultId: string, action: string, purchaseInvoiceId?: string) {
    setResolving(resultId)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/v1/reconciliation/results/${resultId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, purchaseInvoiceId }),
      })
      if (res.ok) {
        const updated = await res.json() as Result
        setData((prev) => ({
          ...prev,
          results: prev.results.map((r) => (r.id === resultId ? { ...r, ...updated } : r)),
        }))
        router.refresh()
      }
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/reconciliation" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          GSTR-2B Reconciliation — {upload.filingPeriod}
        </h1>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Matched',       count: upload.matchedCount,     color: 'text-green-700' },
          { label: 'Possible',      count: upload.possibleCount,    color: 'text-amber-700' },
          { label: 'Not in vault',  count: upload.notInVaultCount,  color: 'text-red-700' },
          { label: 'Not in GSTR-2B',count: upload.notInGstr2bCount, color: 'text-gray-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.key !== 'ALL' && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({results.filter((r) => r.status === tab.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results table */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No results in this category</div>
        )}
        {filtered.map((result) => (
          <div key={result.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[result.status]?.badge}`}>
                    {STATUS_STYLES[result.status]?.label}
                  </span>
                  {result.matchScore > 0 && (
                    <span className="text-xs text-gray-400">
                      {Math.round(result.matchScore * 100)}% confidence
                    </span>
                  )}
                  {result.userAction && (
                    <span className="text-xs text-gray-400 italic">{result.userAction}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  {result.lineItem && (
                    <div className="space-y-0.5">
                      <p className="font-medium text-gray-500 uppercase tracking-wide">GSTR-2B line</p>
                      <p className="text-gray-900">{result.lineItem.vendorName ?? '—'}</p>
                      <p className="text-gray-500">{result.lineItem.vendorGstin ?? '—'}</p>
                      <p className="text-gray-500">
                        Invoice: {result.lineItem.invoiceNumber ?? '—'}
                        {result.lineItem.invoiceDate && ` · ${result.lineItem.invoiceDate.slice(0, 10)}`}
                      </p>
                      {result.lineItem.totalAmount && (
                        <p className="text-gray-700 font-medium">
                          ₹{parseFloat(result.lineItem.totalAmount).toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                  )}

                  {result.purchaseInvoice && (
                    <div className="space-y-0.5">
                      <p className="font-medium text-gray-500 uppercase tracking-wide">Vault</p>
                      <p className="text-gray-900">{result.purchaseInvoice.vendorName ?? '—'}</p>
                      <p className="text-gray-500">{result.purchaseInvoice.vendorGstin ?? '—'}</p>
                      <p className="text-gray-500">Invoice: {result.purchaseInvoice.invoiceNumber ?? '—'}</p>
                      {result.purchaseInvoice.totalAmount && (
                        <p className="text-gray-700 font-medium">
                          ₹{parseFloat(result.purchaseInvoice.totalAmount).toLocaleString('en-IN')}
                        </p>
                      )}
                      <p className="text-gray-400 truncate">{result.purchaseInvoice.document.originalName}</p>
                    </div>
                  )}

                  {!result.purchaseInvoice && result.status !== 'NOT_IN_GSTR2B' && (
                    <div className="text-gray-400 italic flex items-center">
                      No matching invoice in vault
                    </div>
                  )}
                  {!result.lineItem && result.status === 'NOT_IN_GSTR2B' && (
                    <div className="text-gray-400 italic flex items-center">
                      Not reported in GSTR-2B
                    </div>
                  )}
                </div>

                {/* Remarks */}
                {result.remarks && Object.keys(result.remarks).length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    {(result.remarks['matchedOn'] as string[] | undefined)?.length
                      ? `Matched on: ${(result.remarks['matchedOn'] as string[]).join(', ')}`
                      : (result.remarks['reason'] as string | undefined) ?? ''}
                    {result.remarks['amountDiff'] !== undefined && (
                      ` · Diff: ₹${Number(result.remarks['amountDiff']).toLocaleString('en-IN')}`
                    )}
                  </p>
                )}
              </div>

              {/* Actions */}
              {!result.userAction && (
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {result.status === 'POSSIBLE_MATCH' && (
                    <>
                      <button
                        disabled={resolving === result.id}
                        onClick={() => resolveResult(result.id, 'ACCEPT_MATCH')}
                        className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        disabled={resolving === result.id}
                        onClick={() => resolveResult(result.id, 'REJECT_MATCH')}
                        className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
