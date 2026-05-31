'use client'
import { useState, useCallback } from 'react'
import { Flame, Download, FileText, MessageSquare, CheckSquare, Send, RefreshCw } from 'lucide-react'
import { useApiClient } from '@/lib/client-api'
import { FilingsHeatmap } from './FilingsHeatmap'
import { ClientFilingDrawer } from './ClientFilingDrawer'
import { BulkModals } from './BulkModals'
import type { HeatmapData } from './FilingsHeatmap'

interface MissingItem {
  documentType: string
  label: string
  missing: number
}

export interface FilingRow {
  client: {
    id: string
    name: string
    gstin: string | null
    filerType: string
    gstDeadlineDay: number | null
    email: string | null
    phone: string | null
  }
  period: string
  deadline: string
  daysRemaining: number
  status: 'FILED' | 'PENDING' | 'OVERDUE'
  document: { id: string; originalName: string; filingPeriod: string | null } | null
  checklistId: string | null
  readinessScore: number
  missingItems: MissingItem[]
  consecutiveMissed: number
  lastReminderSentAt: string | null
}

export interface FilingSummary {
  total: number
  filed: number
  pending: number
  overdue: number
  dueSoon: number
  atRisk: number
  lateFeeExposure: number
  lateFeePerDay: number
}

interface Props {
  initialRows: FilingRow[]
  initialSummary: FilingSummary
  initialHeatmap: HeatmapData
}

type FilterType = 'ALL' | 'FILED' | 'PENDING' | 'OVERDUE' | 'ATRISK'
type ViewMode = 'calendar' | 'heatmap'
type ModalType = 'request' | 'nudge' | 'markFiled'

const STATUS_STYLE: Record<string, string> = {
  FILED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  FILED: 'Filed',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
}

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

function daysSince(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

function ReadinessBar({ score, status }: { score: number; status: string }) {
  if (status === 'FILED') return <span className="text-xs text-gray-400">Complete</span>
  if (score === 0) return <span className="text-xs text-gray-400">—</span>
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-[40px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-600 tabular-nums shrink-0">{score}%</span>
    </div>
  )
}

function downloadCsv(rows: FilingRow[]) {
  const header = [
    'Client Name', 'GSTIN', 'Filer Type', 'Period', 'Deadline', 'Status',
    'Readiness %', 'Missing Items', 'Consecutive Missed', 'Last Reminder', 'Document',
  ]
  const csvRows = rows.map((r) => [
    r.client.name,
    r.client.gstin ?? '',
    r.client.filerType,
    r.period,
    r.deadline,
    r.status,
    r.readinessScore,
    r.missingItems.map((m) => `${m.label || m.documentType} x${m.missing}`).join('; '),
    r.consecutiveMissed,
    r.lastReminderSentAt ? daysSince(r.lastReminderSentAt) : 'Never',
    r.document?.originalName ?? '',
  ])
  const csv = [header, ...csvRows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gst-filing-${new Date().toISOString().slice(0, 7)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function FilingsClient({ initialRows, initialSummary, initialHeatmap }: Props) {
  const { request } = useApiClient()

  const [rows, setRows] = useState(initialRows)
  const [summary, setSummary] = useState(initialSummary)
  const [heatmap, setHeatmap] = useState(initialHeatmap)
  const [view, setView] = useState<ViewMode>('calendar')
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [search, setSearch] = useState('')

  const [filing, setFiling] = useState<string | null>(null)
  const [confirmFiling, setConfirmFiling] = useState<string | null>(null)
  const [drawerRow, setDrawerRow] = useState<FilingRow | null>(null)
  const [bulkModal, setBulkModal] = useState<ModalType | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [requestingId, setRequestingId] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const refresh = useCallback(async () => {
    const [r, s, h] = await Promise.all([
      request<FilingRow[]>('/filings/calendar'),
      request<FilingSummary>('/filings/summary'),
      request<HeatmapData>('/filings/heatmap'),
    ])
    setRows(r)
    setSummary(s)
    setHeatmap(h)
    setDrawerRow((prev) =>
      prev ? (r.find((row) => row.client.id === prev.client.id) ?? null) : null,
    )
  }, [request])

  async function handleMarkFiled(checklistId: string) {
    setFiling(checklistId)
    try {
      await request(`/compliance/checklists/${checklistId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'FILED' }),
      })
      setConfirmFiling(null)
      showToast('Client marked as filed.')
      await refresh()
    } finally {
      setFiling(null)
    }
  }

  async function handleSingleRequest(clientId: string) {
    setRequestingId(clientId)
    try {
      const res = await request<{ requested: number; whatsappSent: number; skipped: number }>(
        '/filings/bulk-request-docs',
        { method: 'POST', body: JSON.stringify({ clientIds: [clientId], sendWhatsApp: true }) },
      )
      if (res.skipped > 0) {
        showToast('Already requested today — skipped.')
      } else {
        showToast(
          `Document request sent${res.whatsappSent > 0 ? ' · WhatsApp queued' : ''}.`,
        )
      }
      await refresh()
    } finally {
      setRequestingId(null)
    }
  }

  async function handleBulkConfirm(clientIds: string[], sendWhatsApp?: boolean) {
    setBulkLoading(true)
    try {
      if (bulkModal === 'request') {
        const res = await request<{
          requested: number
          whatsappSent: number
          skipped: number
          errors: string[]
        }>('/filings/bulk-request-docs', {
          method: 'POST',
          body: JSON.stringify({ clientIds, sendWhatsApp }),
        })
        showToast(
          `Requested for ${res.requested} client${res.requested === 1 ? '' : 's'}` +
            (res.whatsappSent > 0 ? ` · ${res.whatsappSent} WhatsApp queued` : '') +
            (res.skipped > 0 ? ` · ${res.skipped} skipped (today)` : '') +
            (res.errors.length > 0 ? ` · ${res.errors.length} failed` : '') +
            '.',
        )
      } else if (bulkModal === 'nudge') {
        const res = await request<{ sent: number; failed: number; errors: string[] }>(
          '/filings/bulk-nudge',
          { method: 'POST', body: JSON.stringify({ clientIds }) },
        )
        showToast(
          `Deadline reminder sent to ${res.sent} client${res.sent === 1 ? '' : 's'}` +
            (res.failed > 0 ? ` · ${res.failed} failed` : '') +
            '.',
        )
      } else if (bulkModal === 'markFiled') {
        const res = await request<{ marked: number; errors: string[] }>(
          '/filings/bulk-mark-filed',
          { method: 'POST', body: JSON.stringify({ clientIds }) },
        )
        showToast(
          `${res.marked} client${res.marked === 1 ? '' : 's'} marked as filed` +
            (res.errors.length > 0 ? ` · ${res.errors.length} failed` : '') +
            '.',
        )
      }
      setBulkModal(null)
      await refresh()
    } finally {
      setBulkLoading(false)
    }
  }

  const nonFiledRows = rows.filter((r) => r.status !== 'FILED')

  const filtered = rows.filter((r) => {
    if (!r?.client) return false
    if (filter === 'FILED' && r.status !== 'FILED') return false
    if (filter === 'PENDING' && r.status !== 'PENDING') return false
    if (filter === 'OVERDUE' && r.status !== 'OVERDUE') return false
    if (filter === 'ATRISK' && r.consecutiveMissed < 2) return false
    if (search && !r.client.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const tabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: summary.total },
    { key: 'FILED', label: 'Filed', count: summary.filed },
    { key: 'PENDING', label: 'Pending', count: summary.pending },
    { key: 'OVERDUE', label: 'Overdue', count: summary.overdue },
    { key: 'ATRISK', label: 'At Risk', count: summary.atRisk },
  ]

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-2xl font-bold text-green-600">{summary.filed}</p>
            <p className="text-xs text-gray-500">
              of {summary.total} filed
              {summary.total > 0 && (
                <span className="ml-1 text-gray-400">
                  ({Math.round((summary.filed / summary.total) * 100)}%)
                </span>
              )}
            </p>
          </div>
          {summary.overdue > 0 && (
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
              <p className="text-xs text-gray-500">overdue</p>
            </div>
          )}
          {summary.pending > 0 && (
            <div>
              <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
              <p className="text-xs text-gray-500">
                pending
                {summary.dueSoon > 0 && (
                  <span className="ml-1 text-amber-500">({summary.dueSoon} due in 7d)</span>
                )}
              </p>
            </div>
          )}
          {summary.atRisk > 0 && (
            <div className="flex items-center gap-1">
              <Flame size={15} className="text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-500">{summary.atRisk}</p>
                <p className="text-xs text-gray-500">at risk</p>
              </div>
            </div>
          )}
        </div>
        {summary.lateFeeExposure > 0 && (
          <div className="ml-auto text-right">
            <p className="text-sm font-semibold text-red-600">{INR(summary.lateFeeExposure)}</p>
            <p className="text-xs text-gray-400">
              exposure · {INR(summary.lateFeePerDay)}/day
            </p>
          </div>
        )}
      </div>

      {/* Overdue alert */}
      {summary.overdue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {summary.overdue} client{summary.overdue > 1 ? 's are' : ' is'} overdue — file immediately
          to avoid penalties.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView('heatmap')}
            className={`px-3 py-1.5 text-sm font-medium border-l border-gray-200 transition-colors ${
              view === 'heatmap'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Heatmap
          </button>
        </div>

        {view === 'calendar' && nonFiledRows.length > 0 && (
          <>
            <button
              onClick={() => setBulkModal('request')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <MessageSquare size={13} />
              Request Docs
            </button>
            <button
              onClick={() => setBulkModal('nudge')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <Send size={13} />
              Deadline Nudge
            </button>
            <button
              onClick={() => setBulkModal('markFiled')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <CheckSquare size={13} />
              Mark Filed
            </button>
          </>
        )}

        {view === 'calendar' && (
          <input
            type="text"
            placeholder="Search client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[140px] text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <div className="flex items-center gap-1 ml-auto shrink-0">
          {view === 'calendar' && (
            <button
              onClick={() => downloadCsv(filtered)}
              title="Export CSV"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Download size={15} />
            </button>
          )}
          <button
            onClick={refresh}
            title="Refresh"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      {view === 'calendar' && (
        <div className="flex gap-0 border-b border-gray-200">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                filter === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  filter === key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Calendar table */}
      {view === 'calendar' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {summary.total > 0 && summary.filed === summary.total && (
            <div className="px-4 py-3 bg-green-50 border-b border-green-100 text-sm text-green-700 font-medium">
              All {summary.total} clients filed for this period.
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Client</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Period</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Deadline</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-[120px]">Readiness</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Last reminder</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Document</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                    {search ? 'No clients match your search.' : 'No clients in this category.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const leftBorder =
                    row.status === 'OVERDUE'
                      ? 'border-l-2 border-l-red-400'
                      : row.status === 'PENDING'
                        ? 'border-l-2 border-l-amber-400'
                        : ''
                  return (
                    <tr
                      key={row.client.id}
                      className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${
                        row.status === 'OVERDUE' ? 'bg-red-50/20' : ''
                      }`}
                      onClick={() => setDrawerRow(row)}
                    >
                      {/* Client */}
                      <td className={`px-4 py-2.5 ${leftBorder}`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-900">{row.client.name}</span>
                          {row.consecutiveMissed >= 2 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium shrink-0">
                              <Flame size={9} />
                              {row.consecutiveMissed}m
                            </span>
                          )}
                        </div>
                        {row.client.gstin && (
                          <p className="text-[11px] text-gray-400 font-mono">{row.client.gstin}</p>
                        )}
                      </td>

                      {/* Period */}
                      <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                        {row.period}
                      </td>

                      {/* Deadline */}
                      <td className="px-3 py-2.5">
                        <p className="text-xs text-gray-500 whitespace-nowrap">{row.deadline}</p>
                        {row.status !== 'FILED' && (
                          <p
                            className={`text-xs font-medium mt-0.5 ${
                              row.daysRemaining < 0
                                ? 'text-red-600'
                                : row.daysRemaining <= 3
                                  ? 'text-red-500'
                                  : row.daysRemaining <= 7
                                    ? 'text-amber-600'
                                    : 'text-gray-500'
                            }`}
                          >
                            {row.daysRemaining < 0
                              ? `${Math.abs(row.daysRemaining)}d overdue`
                              : row.daysRemaining === 0
                                ? 'Due today'
                                : `${row.daysRemaining}d left`}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[row.status]}`}
                        >
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>

                      {/* Readiness */}
                      <td className="px-3 py-2.5">
                        <ReadinessBar score={row.readinessScore} status={row.status} />
                      </td>

                      {/* Last reminder */}
                      <td className="px-3 py-2.5">
                        {row.lastReminderSentAt ? (
                          <span className="text-xs text-gray-500">
                            {daysSince(row.lastReminderSentAt)}
                          </span>
                        ) : (
                          <span
                            className={`text-xs ${
                              row.status !== 'FILED' ? 'text-red-400' : 'text-gray-400'
                            }`}
                          >
                            Never
                          </span>
                        )}
                      </td>

                      {/* Document */}
                      <td className="px-3 py-2.5">
                        {row.document ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-green-700 font-medium max-w-[120px]"
                            title={row.document.originalName}
                          >
                            <FileText size={11} className="shrink-0" />
                            <span className="truncate">{row.document.originalName}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-4 py-2.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.status !== 'FILED' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSingleRequest(row.client.id)}
                              disabled={requestingId === row.client.id}
                              title="Request documents"
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-40"
                            >
                              <MessageSquare size={13} />
                            </button>
                            {row.checklistId &&
                              (confirmFiling === row.checklistId ? (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <button
                                    onClick={() => handleMarkFiled(row.checklistId!)}
                                    disabled={filing === row.checklistId}
                                    className="px-1.5 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {filing === row.checklistId ? '…' : 'Yes'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmFiling(null)}
                                    className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 rounded text-xs"
                                  >
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmFiling(row.checklistId!)}
                                  title="Mark as filed"
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                >
                                  <CheckSquare size={13} />
                                </button>
                              ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Heatmap */}
      {view === 'heatmap' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <FilingsHeatmap data={heatmap} />
        </div>
      )}

      {/* Drawer */}
      <ClientFilingDrawer
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        onMarkFiled={handleMarkFiled}
        onRequestDocs={handleSingleRequest}
        filing={filing}
        confirmFiling={confirmFiling}
        setConfirmFiling={setConfirmFiling}
      />

      {/* Bulk modals */}
      <BulkModals
        type={bulkModal}
        rows={nonFiledRows}
        onClose={() => setBulkModal(null)}
        onConfirm={handleBulkConfirm}
        loading={bulkLoading}
      />

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm text-center pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
