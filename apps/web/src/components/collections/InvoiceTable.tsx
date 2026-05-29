'use client'

import { useState } from 'react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useApiClient } from '@/lib/client-api'
import { useRouter } from 'next/navigation'
import type { InvoiceWithRisk, RiskLevel } from '@opsc/types'

interface InvoiceTableProps {
  invoices: InvoiceWithRisk[]
  meta: { total: number; page: number; limit: number; totalPages: number }
  onRowClick: (invoice: InvoiceWithRisk) => void
  currentPage: number
  onPageChange: (page: number) => void
}

const RISK_PILL: Record<RiskLevel, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-green-100 text-green-700',
  UNSCORED: 'bg-slate-100 text-slate-500',
}

const STATUS_PILL: Record<string, string> = {
  PENDING: 'bg-blue-50 text-blue-600',
  OVERDUE: 'bg-red-50 text-red-600',
  PAID: 'bg-green-50 text-green-600',
  PARTIAL: 'bg-amber-50 text-amber-600',
}

export function InvoiceTable({
  invoices,
  meta,
  onRowClick,
  currentPage,
  onPageChange,
}: InvoiceTableProps) {
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const { request } = useApiClient()
  const router = useRouter()

  async function handleMarkPaid(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setMarkingPaid(id)
    try {
      await request(`/invoices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PAID' }),
      })
      router.refresh()
    } finally {
      setMarkingPaid(null)
    }
  }

  async function handleRemind(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSendingReminder(id)
    try {
      await request(`/collections/${id}/remind`, { method: 'POST' })
    } finally {
      setSendingReminder(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="text-left font-medium p-4">Customer</th>
              <th className="text-left font-medium p-4">Invoice #</th>
              <th className="text-right font-medium p-4">Amount</th>
              <th className="text-left font-medium p-4">Due Date</th>
              <th className="text-right font-medium p-4">Aging</th>
              <th className="text-center font-medium p-4">Risk</th>
              <th className="text-center font-medium p-4">Status</th>
              <th className="text-right font-medium p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  No invoices match your filters
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onRowClick(inv)}
              >
                <td className="p-4 font-medium text-slate-800 max-w-[160px] truncate">
                  {inv.customerName}
                </td>
                <td className="p-4 font-mono text-xs text-slate-500">{inv.id.slice(-8)}</td>
                <td className="p-4 text-right font-semibold tabular-nums">
                  {formatCurrency(inv.amount)}
                </td>
                <td className="p-4 text-slate-600">{formatDate(inv.dueDate)}</td>
                <td
                  className={cn(
                    'p-4 text-right font-semibold tabular-nums',
                    inv.agingDays > 60 ? 'text-red-600' : 'text-slate-700',
                  )}
                >
                  {inv.agingDays > 0 ? `${inv.agingDays}d` : '—'}
                </td>
                <td className="p-4 text-center">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                      RISK_PILL[inv.riskLevel],
                    )}
                  >
                    {inv.riskScore !== null
                      ? (inv.riskScore * 100).toFixed(0) + '%'
                      : inv.riskLevel}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      STATUS_PILL[inv.status] ?? 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {inv.status !== 'PAID' && (
                      <>
                        <button
                          onClick={(e) => handleRemind(e, inv.id)}
                          disabled={sendingReminder === inv.id}
                          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                        >
                          {sendingReminder === inv.id ? '…' : 'Remind'}
                        </button>
                        <button
                          onClick={(e) => handleMarkPaid(e, inv.id)}
                          disabled={markingPaid === inv.id}
                          className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50"
                        >
                          {markingPaid === inv.id ? '…' : 'Paid'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
          <p className="text-slate-500 text-xs">
            {meta.total} invoices · page {currentPage} of {meta.totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              ← Prev
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= meta.totalPages}
              className="px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
