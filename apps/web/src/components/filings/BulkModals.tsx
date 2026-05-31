'use client'
import { useEffect, useState } from 'react'
import { X, AlertTriangle, MessageSquare, CheckSquare, Send } from 'lucide-react'

interface MissingItem {
  documentType: string
  label: string
  missing: number
}

interface FilingRow {
  client: {
    id: string
    name: string
    phone: string | null
  }
  period: string
  deadline: string
  daysRemaining: number
  status: 'FILED' | 'PENDING' | 'OVERDUE'
  missingItems: MissingItem[]
  lastReminderSentAt: string | null
}

type ModalType = 'request' | 'nudge' | 'markFiled'

interface Props {
  type: ModalType | null
  rows: FilingRow[]       // non-filed rows to show in the modal
  onClose: () => void
  onConfirm: (clientIds: string[], sendWhatsApp?: boolean) => Promise<void>
  loading: boolean
}

function wasRemindedToday(lastReminderSentAt: string | null): boolean {
  if (!lastReminderSentAt) return false
  const last = new Date(lastReminderSentAt)
  const today = new Date()
  return (
    last.getFullYear() === today.getFullYear() &&
    last.getMonth() === today.getMonth() &&
    last.getDate() === today.getDate()
  )
}

export function BulkModals({ type, rows, onClose, onConfirm, loading }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [sendWhatsApp, setSendWhatsApp] = useState(true)

  // Initialise checked set when modal type changes
  useEffect(() => {
    if (!type) return
    const initial = new Set<string>()
    for (const row of rows) {
      // For request: pre-uncheck clients reminded today
      if (type === 'request' && wasRemindedToday(row.lastReminderSentAt)) continue
      // For markFiled: only pre-check PENDING (not OVERDUE) by default
      if (type === 'markFiled' && row.status !== 'PENDING') continue
      initial.add(row.client.id)
    }
    setChecked(initial)
    setSendWhatsApp(true)
  }, [type, rows])

  if (!type) return null

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () => {
    if (checked.size === rows.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(rows.map((r) => r.client.id)))
    }
  }

  const handleConfirm = async () => {
    await onConfirm(Array.from(checked), sendWhatsApp)
  }

  const config = {
    request: {
      title: 'Request missing documents',
      icon: <MessageSquare size={18} className="text-blue-600" />,
      confirmLabel: `Request for ${checked.size} client${checked.size === 1 ? '' : 's'}`,
      confirmClass: 'bg-blue-600 hover:bg-blue-700',
    },
    nudge: {
      title: 'Send deadline reminder',
      icon: <Send size={18} className="text-amber-600" />,
      confirmLabel: `Send to ${checked.size} client${checked.size === 1 ? '' : 's'}`,
      confirmClass: 'bg-amber-600 hover:bg-amber-700',
    },
    markFiled: {
      title: 'Mark clients as filed',
      icon: <CheckSquare size={18} className="text-green-600" />,
      confirmLabel: `Mark ${checked.size} as filed`,
      confirmClass: 'bg-green-600 hover:bg-green-700',
    },
  }[type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          {config.icon}
          <h2 className="text-sm font-semibold text-gray-900 flex-1">{config.title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mark filed warning */}
        {type === 'markFiled' && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Only mark clients as filed once you have completed the actual filing in
              ClearTax / Tally / GSTN portal. <strong>This cannot be undone.</strong>
            </p>
          </div>
        )}

        {/* Deadline nudge preview */}
        {type === 'nudge' && rows.length > 0 && (
          <div className="mx-5 mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500 mb-1 font-medium">Message preview</p>
            <p className="text-xs text-gray-700 italic">
              "Hi [Client Name], the GST filing deadline is in{' '}
              {rows[0]!.daysRemaining} days ({rows[0]!.deadline}). Please send
              your documents immediately to avoid late fees."
            </p>
          </div>
        )}

        {/* Client list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {/* Select all */}
          <label className="flex items-center gap-2.5 py-2 cursor-pointer border-b border-gray-100 mb-1">
            <input
              type="checkbox"
              checked={checked.size === rows.length && rows.length > 0}
              onChange={toggleAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-gray-500">
              {checked.size === rows.length ? 'Deselect all' : 'Select all'}
            </span>
          </label>

          {rows.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No clients to show.</p>
          ) : (
            rows.map((row) => {
              const remindedToday = wasRemindedToday(row.lastReminderSentAt)
              return (
                <label
                  key={row.client.id}
                  className="flex items-center gap-2.5 py-2.5 cursor-pointer hover:bg-gray-50 rounded-lg px-1 -mx-1 group"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(row.client.id)}
                    onChange={() => toggle(row.client.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-800 truncate">{row.client.name}</span>
                      {remindedToday && type === 'request' && (
                        <span className="text-xs text-gray-400 shrink-0">(reminded today)</span>
                      )}
                      {!row.client.phone && (
                        <span className="text-xs text-red-400 shrink-0">no phone</span>
                      )}
                    </div>
                    {type === 'request' && row.missingItems.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {row.missingItems.length} item{row.missingItems.length === 1 ? '' : 's'} missing
                      </p>
                    )}
                    {type === 'markFiled' && row.status === 'OVERDUE' && (
                      <p className="text-xs text-red-500 mt-0.5">Overdue — include anyway?</p>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>

        {/* Send WhatsApp toggle — request only */}
        {type === 'request' && (
          <div className="px-5 py-2 border-t border-gray-100">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(e) => setSendWhatsApp(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">Send WhatsApp messages</span>
            </label>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={checked.size === 0 || loading}
            className={`flex-1 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${config.confirmClass}`}
          >
            {loading ? 'Working…' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
