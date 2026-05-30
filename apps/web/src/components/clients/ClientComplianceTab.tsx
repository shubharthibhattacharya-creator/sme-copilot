'use client'
import { useState, useCallback } from 'react'
import { useApiClient } from '@/lib/client-api'
import { useApiError } from '@/hooks/useApiError'

type ChecklistStatus = 'IN_PROGRESS' | 'READY' | 'FILED' | 'OVERDUE'

interface MissingItem {
  documentType: string
  label: string
  required: number
  received: number
  missing: number
}

interface Checklist {
  id: string
  filingType: string
  filingPeriod: string
  label: string
  dueDate: string
  readinessScore: number
  missingItems: MissingItem[]
  status: ChecklistStatus
  assignedUser?: { id: string; name: string } | null
  notes?: string | null
  completedAt?: string | null
}

interface TeamMember { id: string; name: string; email: string }
interface Client { id: string; name: string }

const STATUS_CONFIG: Record<ChecklistStatus, { label: string; cls: string }> = {
  IN_PROGRESS: { label: 'In progress',   cls: 'bg-amber-100 text-amber-800' },
  READY:       { label: 'Ready to file', cls: 'bg-green-100 text-green-800' },
  FILED:       { label: 'Filed',         cls: 'bg-blue-100 text-blue-800' },
  OVERDUE:     { label: 'Overdue',       cls: 'bg-red-100 text-red-800' },
}

const FILING_TYPES = ['GST_MONTHLY','GST_QUARTERLY','TDS_QUARTERLY','ITR_ANNUAL','CUSTOM']

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = score >= 80 ? 'text-green-700' : score >= 50 ? 'text-amber-700' : 'text-red-700'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-sm font-semibold ${textColor} w-10 text-right`}>{score}%</span>
    </div>
  )
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  if (days < 0) return <span className="text-xs font-bold text-red-600">{Math.abs(days)}d overdue</span>
  const cls = days <= 3 ? 'text-red-600 font-bold' : days <= 7 ? 'text-amber-600 font-medium' : 'text-gray-400'
  return <span className={`text-xs ${cls}`}>Due in {days} day{days !== 1 ? 's' : ''}</span>
}

function NewChecklistModal({ clientId, team, onCreated, onClose }: {
  clientId: string
  team: TeamMember[]
  onCreated: (c: Checklist) => void
  onClose: () => void
}) {
  const { request } = useApiClient()
  const { handleError } = useApiError()
  const [filingType, setFilingType] = useState('GST_MONTHLY')
  const [period, setPeriod] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [assignedUserId, setAssignedUserId] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const created = await request<Checklist>('/compliance/checklists', {
        method: 'POST',
        body: JSON.stringify({ clientId, filingType, filingPeriod: period, assignedUserId: assignedUserId || undefined }),
      })
      onCreated(created)
      onClose()
    } catch (e) {
      handleError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">New compliance checklist</h3>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Filing type</label>
          <select value={filingType} onChange={(e) => setFilingType(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {FILING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Filing period (YYYY-MM)</label>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Assign to</label>
          <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Unassigned</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Creating…' : 'Create checklist'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChecklistCard({ checklist, team, onUpdate, onDelete }: {
  checklist: Checklist
  team: TeamMember[]
  onUpdate: (c: Checklist) => void
  onDelete: (id: string) => void
}) {
  const { request } = useApiClient()
  const { handleError } = useApiError()
  const [requesting, setRequesting] = useState(false)
  const [requestMsg, setRequestMsg] = useState<string | null>(null)
  const [confirmFile, setConfirmFile] = useState(false)
  const [filing, setFiling] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editAssigned, setEditAssigned] = useState(false)
  const [newAssignee, setNewAssignee] = useState(checklist.assignedUser?.id ?? '')

  const status = STATUS_CONFIG[checklist.status] ?? STATUS_CONFIG.IN_PROGRESS
  const isFiled = checklist.status === 'FILED'
  const missingItems = checklist.missingItems ?? []

  async function requestMissing() {
    setRequesting(true)
    setRequestMsg(null)
    try {
      const res = await request<{ requestsCreated: number; whatsappSent: boolean }>(
        `/compliance/checklists/${checklist.id}/request-missing`,
        { method: 'POST' }
      )
      setRequestMsg(
        `${res.requestsCreated} document request${res.requestsCreated !== 1 ? 's' : ''} created.${res.whatsappSent ? ' WhatsApp sent.' : ''}`,
      )
    } catch (e) {
      handleError(e)
    } finally {
      setRequesting(false)
    }
  }

  async function markFiled() {
    setFiling(true)
    try {
      const updated = await request<Checklist>(`/compliance/checklists/${checklist.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'FILED' }),
      })
      onUpdate(updated)
      setConfirmFile(false)
    } catch (e) {
      handleError(e)
    } finally {
      setFiling(false)
    }
  }

  async function reassign() {
    try {
      const updated = await request<Checklist>(`/compliance/checklists/${checklist.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedUserId: newAssignee || null }),
      })
      onUpdate(updated)
      setEditAssigned(false)
      setMenuOpen(false)
    } catch (e) {
      handleError(e)
    }
  }

  async function deleteChecklist() {
    try {
      await request(`/compliance/checklists/${checklist.id}`, { method: 'DELETE' })
      onDelete(checklist.id)
      setMenuOpen(false)
    } catch (e) {
      handleError(e)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">{checklist.label}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <DueBadge dueDate={checklist.dueDate} />
            {checklist.assignedUser && (
              <span className="text-xs text-gray-400">Assigned to {checklist.assignedUser.name}</span>
            )}
          </div>
        </div>

        {/* Three-dot menu */}
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen((v) => !v)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg w-48 py-1 text-sm">
              <button onClick={() => { setEditAssigned(true); setMenuOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50">Change assigned staff</button>
              {!isFiled && (
                <button onClick={() => { deleteChecklist() }}
                  className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50">Delete checklist</button>
              )}
              <button onClick={() => setMenuOpen(false)}
                className="w-full text-left px-3 py-2 text-gray-400 hover:bg-gray-50">Close</button>
            </div>
          )}
        </div>
      </div>

      {/* Reassign modal */}
      {editAssigned && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-blue-700">Reassign to</p>
          <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5">
            <option value="">Unassigned</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={reassign} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Save</button>
            <button onClick={() => setEditAssigned(false)} className="text-xs text-gray-500 px-3 py-1.5 hover:bg-gray-100 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Readiness bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Readiness</span>
          <span>{new Date(checklist.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <ReadinessBar score={checklist.readinessScore} />
      </div>

      {/* Missing items */}
      {missingItems.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Missing</p>
          <ul className="space-y-0.5">
            {missingItems.map((item) => (
              <li key={item.documentType} className="text-xs text-gray-600 flex items-center gap-1">
                <span className="text-red-400">•</span>
                {item.label} ({item.required} needed, {item.received} received)
              </li>
            ))}
          </ul>
        </div>
      )}

      {requestMsg && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{requestMsg}</p>
      )}

      {/* Actions */}
      {!isFiled && (
        <div className="flex gap-2 flex-wrap">
          {missingItems.length > 0 && (
            <button
              onClick={requestMissing}
              disabled={requesting}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-60"
            >
              {requesting ? 'Sending requests…' : 'Request missing docs'}
            </button>
          )}

          {!confirmFile ? (
            <button
              onClick={() => setConfirmFile(true)}
              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100"
            >
              Mark as filed
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Mark as complete?</span>
              <button onClick={markFiled} disabled={filing}
                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50">
                {filing ? '…' : 'Yes'}
              </button>
              <button onClick={() => setConfirmFile(false)} className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">
                No
              </button>
            </div>
          )}
        </div>
      )}

      {isFiled && checklist.completedAt && (
        <p className="text-xs text-blue-600">
          Filed {new Date(checklist.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}

export function ClientComplianceTab({ client, initialChecklists, team }: {
  client: Client
  initialChecklists: Checklist[]
  team: TeamMember[]
}) {
  const [checklists, setChecklists] = useState<Checklist[]>(initialChecklists)
  const [showNew, setShowNew] = useState(false)

  const handleCreated = useCallback((c: Checklist) => {
    setChecklists((prev) => [c, ...prev])
  }, [])

  const handleUpdate = useCallback((updated: Checklist) => {
    setChecklists((prev) => prev.map((c) => c.id === updated.id ? updated : c))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setChecklists((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const sorted = [...checklists].sort(
    (a, b) => new Date(b.filingPeriod).getTime() - new Date(a.filingPeriod).getTime()
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Compliance checklists</h2>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + New checklist
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
          No compliance checklists yet.
          <br />
          <span className="text-xs">Create one to start tracking document readiness for this client.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((c) => (
            <ChecklistCard
              key={c.id}
              checklist={c}
              team={team}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showNew && (
        <NewChecklistModal
          clientId={client.id}
          team={team}
          onCreated={handleCreated}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  )
}
