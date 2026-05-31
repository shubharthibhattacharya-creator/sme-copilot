'use client'
import { useEffect, useRef } from 'react'
import { X, Phone, Mail, AlertTriangle, Flame, FileText, CheckCircle2, Clock } from 'lucide-react'

interface MissingItem {
  documentType: string
  label: string
  missing: number
}

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
  checklistId: string | null
  readinessScore: number
  missingItems: MissingItem[]
  consecutiveMissed: number
  lastReminderSentAt: string | null
}

interface Props {
  row: FilingRow | null
  onClose: () => void
  onMarkFiled: (checklistId: string) => Promise<void>
  onRequestDocs: (clientId: string) => void
  filing: string | null
  confirmFiling: string | null
  setConfirmFiling: (id: string | null) => void
}

const STATUS_STYLE: Record<string, string> = {
  FILED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
}

function daysSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

export function ClientFilingDrawer({
  row,
  onClose,
  onMarkFiled,
  onRequestDocs,
  filing,
  confirmFiling,
  setConfirmFiling,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!row) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [row, onClose])

  if (!row) return null

  const daysColor =
    row.daysRemaining <= 3
      ? 'text-red-600'
      : row.daysRemaining <= 7
        ? 'text-amber-600'
        : 'text-green-600'

  const readinessColor =
    row.readinessScore >= 80
      ? 'bg-green-500'
      : row.readinessScore >= 50
        ? 'bg-amber-400'
        : 'bg-red-400'

  const isActionable = row.status !== 'FILED'

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/20" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="w-[480px] bg-white shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900 truncate">{row.client.name}</h2>
              {row.consecutiveMissed >= 2 && (
                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium shrink-0">
                  <Flame size={11} />
                  {row.consecutiveMissed}m missed
                </span>
              )}
            </div>
            {row.client.gstin && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">{row.client.gstin}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Consecutive missed alert */}
          {row.consecutiveMissed >= 2 && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={15} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">
                This client has missed <strong>{row.consecutiveMissed} consecutive months</strong> of
                filing. Escalation recommended.
              </p>
            </div>
          )}

          {/* Status + Period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Filing period</p>
              <p className="text-sm font-semibold text-gray-900">{row.period}</p>
              <span
                className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[row.status]}`}
              >
                {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Deadline</p>
              <p className="text-sm font-semibold text-gray-900">{row.deadline}</p>
              {row.status !== 'FILED' && (
                <p className={`text-xs font-medium mt-1 ${daysColor}`}>
                  {row.daysRemaining < 0
                    ? `${Math.abs(row.daysRemaining)}d overdue`
                    : row.daysRemaining === 0
                      ? 'Due today'
                      : `${row.daysRemaining}d remaining`}
                </p>
              )}
            </div>
          </div>

          {/* Readiness */}
          {row.checklistId && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-700">Readiness</p>
                <span
                  className={`text-xs font-semibold ${
                    row.readinessScore >= 80
                      ? 'text-green-700'
                      : row.readinessScore >= 50
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}
                >
                  {row.readinessScore}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${readinessColor}`}
                  style={{ width: `${row.readinessScore}%` }}
                />
              </div>
            </div>
          )}

          {/* Missing items */}
          {row.missingItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Missing documents</p>
              <div className="space-y-1.5">
                {row.missingItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-3 bg-amber-50 border border-amber-100 rounded-md"
                  >
                    <span className="text-xs text-amber-800">{item.label || item.documentType}</span>
                    <span className="text-xs font-semibold text-amber-700">{item.missing} needed</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filed document */}
          {row.document && (
            <div className="flex items-center gap-2.5 p-3 bg-green-50 border border-green-100 rounded-lg">
              <CheckCircle2 size={15} className="text-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-green-800">Return filed</p>
                <p
                  className="text-xs text-green-600 truncate"
                  title={row.document.originalName}
                >
                  {row.document.originalName}
                </p>
              </div>
            </div>
          )}

          {/* Contact info */}
          {(row.client.phone || row.client.email) && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700">Contact</p>
              {row.client.phone && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Phone size={12} className="text-gray-400" />
                  {row.client.phone}
                </div>
              )}
              {row.client.email && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Mail size={12} className="text-gray-400" />
                  {row.client.email}
                </div>
              )}
            </div>
          )}

          {/* Last reminder */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock size={12} />
            {row.lastReminderSentAt
              ? `Last WhatsApp: ${daysSince(row.lastReminderSentAt)}`
              : 'No WhatsApp sent yet'}
          </div>

          {/* Filed document type label */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FileText size={12} />
            {row.client.filerType.charAt(0) + row.client.filerType.slice(1).toLowerCase()} filer
          </div>
        </div>

        {/* Actions footer */}
        {isActionable && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-3 space-y-2">
            {/* Mark filed */}
            {row.checklistId &&
              (confirmFiling === row.checklistId ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 flex-1">
                    {row.readinessScore < 100
                      ? `Only ${row.readinessScore}% ready — confirm filing?`
                      : 'Confirm filing?'}
                  </span>
                  <button
                    onClick={() => onMarkFiled(row.checklistId!)}
                    disabled={filing === row.checklistId}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {filing === row.checklistId ? 'Saving…' : 'Yes, file'}
                  </button>
                  <button
                    onClick={() => setConfirmFiling(null)}
                    className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmFiling(row.checklistId!)}
                  className="w-full py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Mark as Filed
                </button>
              ))}

            {/* Request docs */}
            <button
              onClick={() => onRequestDocs(row.client.id)}
              className="w-full py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Request Missing Documents
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
