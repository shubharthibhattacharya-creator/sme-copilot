'use client'

import { useEffect, useState } from 'react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useApiClient } from '@/lib/client-api'
import { useRouter } from 'next/navigation'
import { useApiError } from '@/hooks/useApiError'
import type { InvoiceWithRisk } from '@opsc/types'

interface RiskFactors {
  aging: number
  amount: number
  history: number
}

interface AuditEntry {
  id: string
  action: string
  metadata: Record<string, unknown>
  createdAt: string
  user: { name: string }
}

interface InvoiceDetail extends InvoiceWithRisk {
  collectionRisk: {
    riskScore: number
    predictedDelayDays: number
    riskFactors: RiskFactors
    calculatedAt: string
  } | null
  history: AuditEntry[]
}

interface InvoiceDrawerProps {
  invoice: InvoiceWithRisk | null
  onClose: () => void
}

function RiskFactorBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(value * 100, 100)
  const color =
    pct > 40 ? 'bg-red-400' : pct > 20 ? 'bg-amber-400' : 'bg-green-400'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function InvoiceDrawer({ invoice, onClose }: InvoiceDrawerProps) {
  const [detail, setDetail] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const { request } = useApiClient()
  const router = useRouter()
  const { handleError } = useApiError()

  useEffect(() => {
    if (!invoice) {
      setDetail(null)
      return
    }
    setLoading(true)
    request<InvoiceDetail>(`/collections/${invoice.id}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [invoice, request])

  async function handleCalculateRisk() {
    setCalculating(true)
    try {
      await request('/collections/risk/calculate', { method: 'POST' })
      router.refresh()
      // Reload drawer detail
      if (invoice) {
        const updated = await request<InvoiceDetail>(`/collections/${invoice.id}`)
        setDetail(updated)
      }
    } catch (err) {
      handleError(err)
    } finally {
      setCalculating(false)
    }
  }

  const open = invoice !== null

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Invoice Detail</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading && (
            <div className="space-y-3 pt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 bg-slate-100 animate-pulse rounded" />
              ))}
            </div>
          )}

          {!loading && detail && (
            <>
              {/* Invoice basics */}
              <section className="space-y-3">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">Customer</dt>
                    <dd className="font-semibold text-slate-800">{detail.customerName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Amount</dt>
                    <dd className="font-semibold text-slate-800">
                      {formatCurrency(detail.amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Due Date</dt>
                    <dd className="text-slate-700">{formatDate(detail.dueDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Status</dt>
                    <dd className="text-slate-700">{detail.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Aging</dt>
                    <dd
                      className={cn(
                        'font-semibold',
                        detail.agingDays > 60 ? 'text-red-600' : 'text-slate-700',
                      )}
                    >
                      {detail.agingDays > 0 ? `${detail.agingDays} days` : 'Current'}
                    </dd>
                  </div>
                  {detail.customerPhone && (
                    <div>
                      <dt className="text-xs text-slate-400">Phone</dt>
                      <dd className="text-slate-700">{detail.customerPhone}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Risk breakdown */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Collection Risk</h3>
                  <button
                    onClick={handleCalculateRisk}
                    disabled={calculating}
                    className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                  >
                    {calculating ? 'Calculating…' : 'Recalculate'}
                  </button>
                </div>

                {detail.collectionRisk ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Overall risk score</span>
                      <span className="text-lg font-bold text-red-600">
                        {(detail.collectionRisk.riskScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      <RiskFactorBar
                        label="Aging contribution"
                        value={detail.collectionRisk.riskFactors.aging}
                      />
                      <RiskFactorBar
                        label="Amount contribution"
                        value={detail.collectionRisk.riskFactors.amount}
                      />
                      <RiskFactorBar
                        label="Payment history"
                        value={detail.collectionRisk.riskFactors.history}
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Predicted delay: {detail.collectionRisk.predictedDelayDays} days
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    No risk score yet — click Recalculate
                  </p>
                )}
              </section>

              {/* Audit history */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Activity</h3>
                {detail.history.length === 0 ? (
                  <p className="text-sm text-slate-400">No activity recorded</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.history.map((entry) => (
                      <li key={entry.id} className="flex gap-3 text-sm">
                        <span className="text-slate-300 mt-0.5">•</span>
                        <div>
                          <span className="font-medium text-slate-700">{entry.action}</span>
                          {' '}
                          <span className="text-slate-500">by {entry.user.name}</span>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDate(entry.createdAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}
