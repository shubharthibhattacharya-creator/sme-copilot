'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Partial', value: 'PARTIAL' },
]

const RISK_OPTIONS = [
  { label: 'All Risk', value: '' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
]

const SORT_OPTIONS = [
  { label: 'Aging Days', value: 'agingDays' },
  { label: 'Amount', value: 'amount' },
  { label: 'Risk Score', value: 'riskScore' },
]

export function CollectionsFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('page') // reset to page 1 on filter change
      router.push(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router],
  )

  const current = (key: string) => params.get(key) ?? ''

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status tabs */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update('status', opt.value)}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              current('status') === opt.value
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Risk filter */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
        {RISK_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update('riskLevel', opt.value)}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              current('riskLevel') === opt.value
                ? 'bg-slate-800 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-slate-500">Sort:</span>
        <select
          value={current('sortBy') || 'agingDays'}
          onChange={(e) => update('sortBy', e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            update('sortOrder', current('sortOrder') === 'asc' ? 'desc' : 'asc')
          }
          className="text-sm px-2 py-1.5 border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50"
          title="Toggle sort order"
        >
          {current('sortOrder') === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  )
}
