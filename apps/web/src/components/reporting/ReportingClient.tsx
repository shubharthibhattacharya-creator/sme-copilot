'use client'
import { useState } from 'react'
import { useApiClient } from '@/lib/client-api'
import { useAuth } from '@clerk/nextjs'
import type { ReportItem } from '@opsc/types'
import { ApiError } from '@/lib/api-error'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const IS_DEV = process.env['NODE_ENV'] !== 'production'
function getDevToken() {
  if (!IS_DEV) return null
  try { return localStorage.getItem('dev_token') } catch { return null }
}

const TABULAR_TYPES = ['COLLECTIONS_AGING', 'RECEIVABLES_SUMMARY', 'INVENTORY_STATUS']

type ReportType =
  | 'COLLECTIONS_AGING'
  | 'RECEIVABLES_SUMMARY'
  | 'INVENTORY_STATUS'
  | 'CASH_FLOW'
  | 'AI_INSIGHTS_DIGEST'

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: 'COLLECTIONS_AGING', label: 'Collections Aging', description: 'Overdue invoices bucketed by age' },
  { value: 'RECEIVABLES_SUMMARY', label: 'Receivables Summary', description: 'Outstanding amounts by status' },
  { value: 'INVENTORY_STATUS', label: 'Inventory Status', description: 'Low-stock items and inventory value' },
  { value: 'CASH_FLOW', label: 'Cash Flow', description: 'Collected vs pending amounts' },
  { value: 'AI_INSIGHTS_DIGEST', label: 'AI Insights Digest', description: 'Summary of recent AI insights' },
]

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  GENERATING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

const SEV_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  WARNING: 'bg-amber-100 text-amber-700',
  INFO: 'bg-blue-100 text-blue-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function inr(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function StatCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-lg font-bold ${warn ? 'text-red-700' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-blue-600">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 text-xs font-medium text-white">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportDataView({ reportType, data }: { reportType: string; data: Record<string, unknown> }) {
  if (reportType === 'COLLECTIONS_AGING') {
    const d = data as { totalOverdue: number; overdueCount: number; buckets: { label: string; count: number; amount: number }[] }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Overdue" value={inr(d.totalOverdue)} warn={d.totalOverdue > 0} />
          <StatCard label="Overdue Invoices" value={String(d.overdueCount)} warn={d.overdueCount > 0} />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">Aging Buckets</div>
          <DataTable
            headers={['Bucket', 'Invoices', 'Amount']}
            rows={d.buckets.map(b => [b.label, b.count, inr(b.amount)])}
          />
        </div>
      </div>
    )
  }

  if (reportType === 'RECEIVABLES_SUMMARY') {
    const d = data as { totalAmount: number; totalInvoices: number; avgAgingDays: number; byStatus: { status: string; count: number; amount: number }[] }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Receivables" value={inr(d.totalAmount)} />
          <StatCard label="Total Invoices" value={String(d.totalInvoices)} />
          <StatCard label="Avg Aging" value={`${d.avgAgingDays} days`} warn={d.avgAgingDays > 30} />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">By Status</div>
          <DataTable
            headers={['Status', 'Count', 'Amount']}
            rows={d.byStatus.map(s => [s.status, s.count, inr(s.amount)])}
          />
        </div>
      </div>
    )
  }

  if (reportType === 'INVENTORY_STATUS') {
    const d = data as { totalItems: number; lowStockCount: number; totalInventoryValue: number; lowStockItems: { sku: string; name: string; quantity: number; reorderLevel: number; daysUntilStockout: number | null }[] }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Items" value={String(d.totalItems)} />
          <StatCard label="Low Stock" value={String(d.lowStockCount)} warn={d.lowStockCount > 0} />
          <StatCard label="Inventory Value" value={inr(d.totalInventoryValue)} />
        </div>
        {d.lowStockItems.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Low Stock Items</div>
            <DataTable
              headers={['SKU', 'Name', 'Qty', 'Reorder', 'Days to Stockout']}
              rows={d.lowStockItems.map(i => [i.sku, i.name, i.quantity, i.reorderLevel, i.daysUntilStockout != null && i.daysUntilStockout < 9999 ? i.daysUntilStockout + 'd' : '—'])}
            />
          </div>
        )}
      </div>
    )
  }

  if (reportType === 'CASH_FLOW') {
    const d = data as { collectedAmount: number; collectedCount: number; pendingAmount: number; pendingCount: number }
    const total = d.collectedAmount + d.pendingAmount
    const rate = total > 0 ? Math.round((d.collectedAmount / total) * 100) : 0
    const collectedPct = total > 0 ? (d.collectedAmount / total) * 100 : 0
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Collected" value={inr(d.collectedAmount)} sub={`${d.collectedCount} invoices`} />
          <StatCard label="Pending" value={inr(d.pendingAmount)} sub={`${d.pendingCount} invoices`} warn={d.pendingAmount > 0} />
          <StatCard label="Collection Rate" value={`${rate}%`} warn={rate < 50} />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">Collected vs Pending</div>
          <div className="h-4 rounded-full overflow-hidden bg-gray-100 flex">
            <div className="bg-green-500 h-full transition-all" style={{ width: `${collectedPct}%` }} />
            <div className="bg-amber-400 h-full flex-1" />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span className="text-green-600 font-medium">Collected {rate}%</span>
            <span className="text-amber-600 font-medium">Pending {100 - rate}%</span>
          </div>
        </div>
      </div>
    )
  }

  if (reportType === 'AI_INSIGHTS_DIGEST') {
    const d = data as { totalInsights: number; bySeverity: { CRITICAL: number; WARNING: number; INFO: number }; recentInsights: { module: string; category: string; severity: string; summary: string }[] }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total" value={String(d.totalInsights)} />
          <StatCard label="Critical" value={String(d.bySeverity.CRITICAL)} warn={d.bySeverity.CRITICAL > 0} />
          <StatCard label="Warnings" value={String(d.bySeverity.WARNING)} warn={d.bySeverity.WARNING > 0} />
          <StatCard label="Info" value={String(d.bySeverity.INFO)} />
        </div>
        {d.recentInsights.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-gray-500 mb-2">Recent Insights</div>
            {d.recentInsights.slice(0, 10).map((ins, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-100 p-2.5">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${SEV_STYLES[ins.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ins.severity}
                </span>
                <div>
                  <span className="text-xs font-medium text-gray-600">{ins.module}</span>
                  <p className="text-xs text-gray-700 mt-0.5">{ins.summary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

interface Props {
  initialReports: ReportItem[]
}

export function ReportingClient({ initialReports }: Props) {
  const { request } = useApiClient()
  const { getToken } = useAuth()
  const [reports, setReports] = useState(initialReports)
  const [selectedType, setSelectedType] = useState<ReportType>('COLLECTIONS_AGING')
  const [generating, setGenerating] = useState(false)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null) // "<reportId>-<format>"

  async function downloadReport(reportId: string, format: 'pdf' | 'excel' | 'word') {
    const key = `${reportId}-${format}`
    setDownloading(key)
    try {
      const token = getDevToken() ?? (await getToken())
      const res = await fetch(`${API_URL}/api/v1/reports/${reportId}/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${reportId}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // silent — file download failure is obvious to user
    } finally {
      setDownloading(null)
    }
  }

  async function generateReport() {
    setGenerating(true)
    setError(null)
    try {
      const report = await request<ReportItem>('/reports', {
        method: 'POST',
        body: JSON.stringify({ reportType: selectedType }),
      })
      setReports(prev => [report, ...prev])
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Generate Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-medium text-gray-900 mb-4">Generate New Report</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {REPORT_TYPES.map(rt => (
            <button
              key={rt.value}
              onClick={() => setSelectedType(rt.value)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                selectedType === rt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-medium text-gray-900">{rt.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{rt.description}</div>
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <button
          onClick={generateReport}
          disabled={generating}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-medium text-gray-900">Report History</h2>
        </div>
        {reports.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No reports yet. Generate your first report above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map(report => (
              <div key={report.id} className="px-6 py-4">
                {/* Row header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {REPORT_TYPES.find(r => r.value === report.reportType)?.label ?? report.reportType.replace(/_/g, ' ')}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[report.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {report.status === 'GENERATING' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1.5" />
                      )}
                      {report.status}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(report.createdAt)}</span>
                  </div>
                  {report.status === 'COMPLETED' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        {expandedReport === report.id ? 'Hide' : 'View Report'}
                      </button>
                      <button
                        onClick={() => downloadReport(report.id, 'pdf')}
                        disabled={downloading === `${report.id}-pdf`}
                        className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 font-medium"
                        title="Download PDF"
                      >
                        {downloading === `${report.id}-pdf` ? '…' : '↓ PDF'}
                      </button>
                      {TABULAR_TYPES.includes(report.reportType) && (
                        <button
                          onClick={() => downloadReport(report.id, 'excel')}
                          disabled={downloading === `${report.id}-excel`}
                          className="text-xs px-3 py-1 rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 font-medium"
                          title="Download Excel"
                        >
                          {downloading === `${report.id}-excel` ? '…' : '↓ Excel'}
                        </button>
                      )}
                      <button
                        onClick={() => downloadReport(report.id, 'word')}
                        disabled={downloading === `${report.id}-word`}
                        className="text-xs px-3 py-1 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 font-medium"
                        title="Download Word"
                      >
                        {downloading === `${report.id}-word` ? '…' : '↓ Word'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded view */}
                {expandedReport === report.id && report.status === 'COMPLETED' && (
                  <div className="mt-4 space-y-4">
                    {report.aiSummary && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                        <div className="text-xs font-medium text-blue-700 mb-1">AI Executive Summary</div>
                        <p className="text-sm text-blue-900">{report.aiSummary}</p>
                      </div>
                    )}
                    {report.dataSnapshot && (
                      <ReportDataView
                        reportType={report.reportType}
                        data={report.dataSnapshot as Record<string, unknown>}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
