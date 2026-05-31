'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'

type UserRole = 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'
type AppModule =
  | 'dashboard' | 'collections' | 'documents' | 'reports'
  | 'whatsapp' | 'assistant' | 'tax_integration' | 'compliance' | 'settings'

interface TeamMember {
  id: string
  name: string
  email: string
  role: UserRole
  moduleAccess: AppModule[]
  isActive: boolean
  createdAt: string
}

interface PendingInvitation {
  id: string
  emailAddress: string
  role?: UserRole
  moduleAccess?: AppModule[]
  createdAt: string
}

const ROLES: UserRole[] = ['ADMIN', 'OPERATIONS_MANAGER', 'STAFF']

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  STAFF: 'Staff',
}

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Full access to all modules and settings',
  OPERATIONS_MANAGER: 'Manage operations, view settings',
  STAFF: 'Basic day-to-day tasks',
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  collections: 'Collections',
  documents: 'Documents',
  reports: 'Reports',
  whatsapp: 'WhatsApp',
  assistant: 'AI Assistant',
  tax_integration: 'Tax Integration',
  compliance: 'GST Compliance',
  settings: 'Settings',
}

const ROLE_DEFAULT_MODULES: Record<UserRole, AppModule[]> = {
  ADMIN: ['dashboard', 'collections', 'documents', 'reports', 'whatsapp', 'assistant', 'tax_integration', 'compliance', 'settings'],
  OPERATIONS_MANAGER: ['dashboard', 'collections', 'documents', 'reports', 'whatsapp', 'assistant', 'compliance', 'settings'],
  STAFF: ['dashboard', 'collections', 'documents', 'assistant'],
}

const ALWAYS_ON: AppModule[] = ['dashboard', 'documents']

// ─── Sub-components ────────────────────────────────────────────────────────

function RoleRadioGroup({ value, onChange }: { value: UserRole; onChange: (r: UserRole) => void }) {
  return (
    <div className="space-y-2">
      {ROLES.map((role) => (
        <label
          key={role}
          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            value === role ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <input
            type="radio"
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
            className="mt-0.5 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">{ROLE_LABELS[role]}</p>
            <p className="text-xs text-gray-500">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        </label>
      ))}
    </div>
  )
}

function ModuleCheckboxes({
  role,
  selected,
  onChange,
}: {
  role: UserRole
  selected: AppModule[]
  onChange: (modules: AppModule[]) => void
}) {
  const available = ROLE_DEFAULT_MODULES[role]
  return (
    <div className="grid grid-cols-2 gap-2">
      {available.map((mod) => {
        const alwaysOn = ALWAYS_ON.includes(mod)
        const checked = alwaysOn || selected.includes(mod)
        return (
          <label
            key={mod}
            className={`flex items-center gap-2 text-sm ${alwaysOn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={alwaysOn}
              onChange={(e) => {
                if (alwaysOn) return
                onChange(e.target.checked ? [...selected, mod] : selected.filter((m) => m !== mod))
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">{MODULE_LABELS[mod]}</span>
          </label>
        )
      })}
    </div>
  )
}

function ModuleChips({ modules }: { modules: AppModule[] }) {
  const shown = modules.slice(0, 3)
  const rest = modules.length - 3
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((mod) => (
        <span key={mod} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
          {MODULE_LABELS[mod] ?? mod}
        </span>
      ))}
      {rest > 0 && (
        <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">+{rest}</span>
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  const cls =
    role === 'ADMIN'
      ? 'bg-purple-50 text-purple-700'
      : role === 'OPERATIONS_MANAGER'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
        isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function TeamManager({ initialTeam }: { initialTeam: TeamMember[] }) {
  const { request } = useApiClient()
  const [team, setTeam] = useState<TeamMember[]>(initialTeam)
  const [pending, setPending] = useState<PendingInvitation[]>([])
  const [loadingPending, setLoadingPending] = useState(true)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('STAFF')
  const [inviteModules, setInviteModules] = useState<AppModule[]>(ROLE_DEFAULT_MODULES['STAFF'])
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Edit drawer
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('STAFF')
  const [editModules, setEditModules] = useState<AppModule[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Deactivate confirmation
  const [confirmDeactivate, setConfirmDeactivate] = useState<TeamMember | null>(null)
  const [deactivating, setDeactivating] = useState<string | null>(null)

  // Pending invitation actions
  const [resending, setResending] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    setLoadingPending(true)
    try {
      const data = await request<PendingInvitation[]>('/settings/team/pending-invitations')
      setPending(data)
    } catch {
      // silent — pending section simply won't show
    } finally {
      setLoadingPending(false)
    }
  }, [request])

  useEffect(() => { fetchPending() }, [fetchPending])

  // ── Invite ──────────────────────────────────────────────────────────────

  function handleInviteRoleChange(role: UserRole) {
    setInviteRole(role)
    setInviteModules(ROLE_DEFAULT_MODULES[role])
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg(null)
    try {
      await request('/settings/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, moduleAccess: inviteModules }),
      })
      setInviteMsg({ ok: true, text: `Invitation sent to ${inviteEmail.trim()}` })
      setInviteEmail('')
      setInviteRole('STAFF')
      setInviteModules(ROLE_DEFAULT_MODULES['STAFF'])
      fetchPending()
    } catch (err) {
      setInviteMsg({
        ok: false,
        text: err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Failed to send invitation',
      })
    } finally {
      setInviting(false)
    }
  }

  // ── Edit drawer ─────────────────────────────────────────────────────────

  function openEdit(member: TeamMember) {
    setEditMember(member)
    setEditRole(member.role)
    setEditModules(member.moduleAccess.length > 0 ? member.moduleAccess : ROLE_DEFAULT_MODULES[member.role])
    setSaveError('')
  }

  function handleEditRoleChange(role: UserRole) {
    setEditRole(role)
    setEditModules(ROLE_DEFAULT_MODULES[role])
  }

  async function saveMember() {
    if (!editMember) return
    setSaving(true)
    setSaveError('')
    try {
      await request(`/settings/team/${editMember.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: editRole, moduleAccess: editModules }),
      })
      setTeam((prev) =>
        prev.map((m) =>
          m.id === editMember.id ? { ...m, role: editRole, moduleAccess: editModules } : m,
        ),
      )
      setEditMember(null)
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Deactivate ──────────────────────────────────────────────────────────

  async function deactivateMember(member: TeamMember) {
    setDeactivating(member.id)
    setConfirmDeactivate(null)
    try {
      await request(`/settings/team/${member.id}`, { method: 'DELETE' })
      setTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, isActive: false } : m)))
    } catch (err) {
      alert(err instanceof ApiError ? err.userMessage : 'Failed to deactivate member')
    } finally {
      setDeactivating(null)
    }
  }

  // ── Pending invitation actions ──────────────────────────────────────────

  async function resendInvite(inv: PendingInvitation) {
    setResending(inv.id)
    try {
      await request(`/settings/team/pending-invitations/${inv.id}/resend`, { method: 'POST' })
    } catch { /* silent */ } finally {
      setResending(null)
    }
  }

  async function revokeInvite(inv: PendingInvitation) {
    setRevoking(inv.id)
    try {
      await request(`/settings/team/pending-invitations/${inv.id}`, { method: 'DELETE' })
      setPending((prev) => prev.filter((p) => p.id !== inv.id))
    } catch { /* silent */ } finally {
      setRevoking(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const activeCount = team.filter((m) => m.isActive).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {activeCount} active member{activeCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Team table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Email', 'Role', 'Modules', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {team.map((member) => {
              const effectiveModules =
                member.moduleAccess.length > 0 ? member.moduleAccess : ROLE_DEFAULT_MODULES[member.role]
              return (
                <tr key={member.id} className={`hover:bg-gray-50 ${!member.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{member.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3">
                    <ModuleChips modules={effectiveModules} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isActive={member.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(member)}
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-700"
                      >
                        Edit
                      </button>
                      {member.isActive && (
                        <button
                          onClick={() => setConfirmDeactivate(member)}
                          disabled={deactivating === member.id}
                          className="text-xs px-2.5 py-1 border border-red-100 rounded-md hover:bg-red-50 text-red-600 disabled:opacity-60"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pending invitations ── */}
      {(!loadingPending && pending.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
            <h2 className="text-sm font-semibold text-amber-800">Pending Invitations ({pending.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Email', 'Role', 'Modules', 'Invited', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{inv.emailAddress}</td>
                  <td className="px-4 py-3">
                    {inv.role ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700">
                        {ROLE_LABELS[inv.role]}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {inv.moduleAccess && inv.moduleAccess.length > 0
                      ? <ModuleChips modules={inv.moduleAccess} />
                      : <span className="text-xs text-gray-400">Role defaults</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => resendInvite(inv)}
                        disabled={resending === inv.id}
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-700 disabled:opacity-60"
                      >
                        {resending === inv.id ? 'Sending…' : 'Resend'}
                      </button>
                      <button
                        onClick={() => revokeInvite(inv)}
                        disabled={revoking === inv.id}
                        className="text-xs px-2.5 py-1 border border-red-100 rounded-md hover:bg-red-50 text-red-600 disabled:opacity-60"
                      >
                        {revoking === inv.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invite form ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Invite a team member</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            They'll receive an email to join your firm with the access you configure.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Email address</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
            placeholder="colleague@yourfirm.com"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Role</label>
          <RoleRadioGroup value={inviteRole} onChange={handleInviteRoleChange} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600">Module access</label>
          <p className="text-xs text-gray-400">Dashboard and Documents are always enabled.</p>
          <ModuleCheckboxes role={inviteRole} selected={inviteModules} onChange={setInviteModules} />
        </div>

        {inviteMsg && (
          <p className={`text-sm ${inviteMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{inviteMsg.text}</p>
        )}

        <button
          onClick={sendInvite}
          disabled={inviting || !inviteEmail.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {inviting ? 'Sending…' : 'Send invitation'}
        </button>
      </div>

      {/* ── Edit drawer ── */}
      {editMember && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => !saving && setEditMember(null)} />
          <div className="relative z-50 w-[22rem] bg-white h-full shadow-xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{editMember.name}</p>
                <p className="text-xs text-gray-500">{editMember.email}</p>
              </div>
              <button
                onClick={() => setEditMember(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Role</label>
                <RoleRadioGroup value={editRole} onChange={handleEditRoleChange} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Module access</label>
                <p className="text-xs text-gray-400">Dashboard and Documents are always enabled.</p>
                <ModuleCheckboxes role={editRole} selected={editModules} onChange={setEditModules} />
              </div>

              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex gap-2 justify-end">
              <button
                onClick={() => setEditMember(null)}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={saveMember}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate confirmation ── */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeactivate(null)} />
          <div className="relative z-50 bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Deactivate {confirmDeactivate.name}?
            </h3>
            <p className="text-sm text-gray-600">
              This will revoke their access immediately. They won't be able to log in until reactivated by an Admin.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deactivateMember(confirmDeactivate)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
