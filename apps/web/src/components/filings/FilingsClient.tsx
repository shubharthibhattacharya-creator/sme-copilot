'use client'
import { useState, useCallback } from 'react'
import { useApiClient } from '@/lib/client-api'
import { FilingsHeatmap } from './FilingsHeatmap'
import type { HeatmapData } from './FilingsHeatmap'

interface FilingRow {
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
}

interface FilingSummary {
  total: number
  filed: number
  pending: number
  overdue: number
  dueSoon: number
}

interface Props {
  initialRows: FilingRow[]
  initialSummary: FilingSummary
  initialHeatmap: HeatmapData
}

const STATUS_STYLES: Record<string, string> = {
  FILED:   'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  FILED:   'Filed',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
}

function DaysChip({ days, status }: { days: number; status: string }) {
  if (status === 'FILED') return <span className="text-xs text-gray-400">—</span>
  const abs = Math.abs(days)
  const label = days < 0 ? `${abs}d overdue` : days === 0 ? 'Due today' : `${days}d left`
  const color = days < 0 ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-gray-600'
  return <span className={`text-xs font-medium ${color}`}>{label}</span>
}

type ViewMode = 'calendar' | 'heatmap'

export function FilingsClient({ initialRows, initialSummary, initialHeatmap }: Props) {
  const { request } = useApiClient()
  const [rows, setRows]         = useState(initialRows)
  const [summary, setSummary]   = useState(initialSummary)
  const [heatmap, setHeatmap]   = useState(initialHeatmap)
  const [view, setView]         = useState<ViewMode>('calendar')
  const [filter, setFilter]     = useState<'ALL' | 'OVERDUE' | 'PENDING' | 'FILED'>('ALL')
  const [search, setSearch]     = useState('')

  const refresh = useCallback(async () => {
    const [r, s, h] = await Promise.all([
      request<FilingRow[]>('/filings/calendar'),
      request<FilingSummary>('/filings/summary'),
      request<HeatmapData>('/filings/heatmap'),
    ])
    setRows(r)
    setSummary(s)
    setHeatmap(h)
  }, [request])

  const filtered = rows.filter((r) => {
    if (filter !== 'ALL' && r.status !== filter) return false
    if (search && !r.client.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total',    value: summary.total,   onClick: () => setFilter('ALL'),     active: filter === 'ALL' },
          { label: 'Filed',    value: summary.filed,   color: 'text-green-600', onClick: () => setFilter('FILED'),   active: filter === 'FILED' },
          { label: 'Pending',  value: summary.pending, color: 'text-amber-600', onClick: () => setFilter('PENDING'), active: filter === 'PENDING' },
          { label: 'Overdue',  value: summary.overdue, color: 'text-red-600',   onClick: () => setFilter('OVERDUE'), active: filter === 'OVERDUE' },
          { label: 'Due in 7d', value: summary.dueSoon, color: summary.dueSoon > 0 ? 'text-amber-600' : undefined, onClick: () => setFilter('PENDING'), active: false },
        ].map(({ label, value, color, onClick, active }) => (
          <button
            key={label}
            onClick={onClick}
            className={`text-left bg-white rounded-lg border p-4 transition-colors ${
              active ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl font-semibold mt-1 ${color ?? 'text-gray-900'}`}>{value}</p>
          </button>
        ))}
      </div>

      {/* Overdue alert */}
      {summary.overdue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {summary.overdue} client{summary.overdue > 1 ? 's are' : ' is'} overdue — file immediately to avoid penalties.
        </div>
      )}

      {/* View toggle + refresh */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setView('calendar')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              view === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView('heatmap')}
            className={`px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${
              view === 'heatmap'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Heatmap
          </button>
        </div>

        {view === 'calendar' && (
          <input
            type="text"
            placeholder="Search client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <button onClick={refresh} className="text-xs text-blue-600 hover:underline whitespace-nowrap ml-auto">
          Refresh
        </button>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">GSTIN</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Period</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Deadline</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Days</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    {search ? 'No clients match your search.' : 'No clients found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.client.id}
                    className={row.status === 'OVERDUE' ? 'bg-red-50/40' : ''}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{row.client.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{row.client.filerType.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {row.client.gstin ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.period}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.deadline}</td>
                    <td className="px-4 py-3">
                      <DaysChip days={row.daysRemaining} status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.document ? (
                        <span
                          className="text-xs text-green-700 font-medium truncate max-w-[160px] block"
                          title={row.document.originalName}
                        >
                          {row.document.originalName}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No document</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Heatmap view */}
      {view === 'heatmap' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <FilingsHeatmap data={heatmap} />
        </div>
      )}
    </div>
  )
}
