'use client'
import { useState, useRef, useEffect } from 'react'
import type { TenantDetail as TenantDetailType, ConfigRow, KnowledgeDoc, AuditEntry, TenantUser, PendingInvitation } from '@/lib/admin-api'

type Tab = 'overview' | 'clients' | 'config' | 'knowledge' | 'activity'

function apiFetch(path: string, init: RequestInit = {}) {
  const proxyPath = path.replace(/^\/admin\//, '/api/admin/')
  return fetch(proxyPath, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

interface Props {
  tenant: TenantDetailType
  config: ConfigRow[]
  knowledge: KnowledgeDoc[]
  audit: AuditEntry[]
}

export function TenantDetail({ tenant: initial, config: initialConfig, knowledge: initialKnowledge, audit }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [tenant, setTenant] = useState(initial)
  const [config, setConfig] = useState(initialConfig)
  const [knowledge, setKnowledge] = useState(initialKnowledge)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: Array<{row:number;reason:string}> } | null>(null)
  const [importing, setImporting] = useState(false)
  const [newKnowledge, setNewKnowledge] = useState({ title: '', category: 'GST_WORKFLOW', content: '' })
  const [addingKnowledge, setAddingKnowledge] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [reinviting, setReinviting] = useState(false)
  const [reinviteMsg, setReinviteMsg] = useState('')
  const [reactivating, setReactivating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // User management state
  const [users, setUsers] = useState<TenantUser[]>(
    initial.users.map((u) => ({ ...u, isActive: true, isPending: u.id.startsWith('pending_') }))
  )
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [addUserForm, setAddUserForm] = useState({ email: '', name: '', role: 'STAFF' })
  const [addingUser, setAddingUser] = useState(false)
  const [addUserMsg, setAddUserMsg] = useState('')
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)

  // Load fresh user list + pending invitations when overview tab is active
  useEffect(() => {
    if (tab !== 'overview') return
    void loadUsers()
    void loadInvitations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function loadUsers() {
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/users`)
      if (res.ok) {
        const data = await res.json() as TenantUser[]
        setUsers(data)
      }
    } catch { /* silent */ }
  }

  async function loadInvitations() {
    setLoadingInvites(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/invitations`)
      if (res.ok) {
        const data = await res.json() as PendingInvitation[]
        setInvitations(data)
      }
    } catch { /* silent */ }
    finally { setLoadingInvites(false) }
  }

  async function handleReactivate() {
    setReactivating(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/reactivate`, { method: 'POST' })
      if (res.ok) setTenant((prev) => ({ ...prev, isActive: true }))
    } catch { /* silent */ }
    finally { setReactivating(false) }
  }

  async function handleReinvite() {
    setReinviting(true)
    setReinviteMsg('')
    try {
      const adminUser = users.find((u) => u.role === 'ADMIN')
      if (!adminUser) { setReinviteMsg('No admin user found for this tenant'); return }
      const res = await fetch(`/api/admin/tenants/${tenant.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminUser.email, role: 'ADMIN' }),
      })
      const data = await res.json() as { message?: string }
      setReinviteMsg(res.ok ? `Invite sent to ${adminUser.email}` : (data.message ?? 'Failed'))
      if (res.ok) void loadInvitations()
    } catch { setReinviteMsg('Network error') }
    finally { setReinviting(false) }
  }

  async function handleAddUser() {
    if (!addUserForm.email || !addUserForm.name) return
    setAddingUser(true)
    setAddUserMsg('')
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addUserForm),
      })
      const data = await res.json() as { inviteSent?: boolean; reactivated?: boolean; message?: string }
      if (res.ok) {
        setAddUserMsg(
          data.reactivated
            ? `User reactivated and invite resent to ${addUserForm.email}.`
            : `User added${data.inviteSent ? ' · invite sent' : ' · invite failed (check Clerk config)'}.`
        )
        setAddUserForm({ email: '', name: '', role: 'STAFF' })
        setShowAddUser(false)
        void loadUsers()
        void loadInvitations()
      } else {
        setAddUserMsg(data.message ?? 'Failed to add user')
      }
    } catch { setAddUserMsg('Network error') }
    finally { setAddingUser(false) }
  }

  async function handleUpdateRole(userId: string, role: string) {
    setUpdatingRoleId(userId)
    try {
      await fetch(`/api/admin/tenants/${tenant.id}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u))
    } catch { /* silent */ }
    finally { setUpdatingRoleId(null) }
  }

  async function handleRemoveUser(userId: string) {
    setRemovingUserId(userId)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/users/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: false } : u))
      }
    } catch { /* silent */ }
    finally { setRemovingUserId(null); setConfirmRemove(null) }
  }

  async function handleResendInvitation(invId: string) {
    try {
      await fetch(`/api/admin/tenants/${tenant.id}/invitations/${invId}/resend`, { method: 'POST' })
      void loadInvitations()
    } catch { /* silent */ }
  }

  async function handleRevokeInvitation(invId: string) {
    try {
      await fetch(`/api/admin/tenants/${tenant.id}/invitations/${invId}`, { method: 'DELETE' })
      setInvitations((prev) => prev.filter((i) => i.id !== invId))
    } catch { /* silent */ }
  }

  async function handleImport(file: File) {
    setImporting(true)
    setImportResult(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/admin/tenants/${tenant.id}/clients/import`, { method: 'POST', body: fd })
    const data = await res.json() as typeof importResult
    setImportResult(data)
    setImporting(false)
  }

  async function handleConfigSet(key: string, value: unknown) {
    await apiFetch(`/admin/tenants/${tenant.id}/config/${key}`, { method: 'PATCH', body: JSON.stringify({ value }) })
    setConfig((prev) => prev.map((r) => r.key === key ? { ...r, value, isOverridden: true } : r))
  }

  async function handleConfigReset(key: string) {
    await apiFetch(`/admin/tenants/${tenant.id}/config/${key}`, { method: 'DELETE' })
    setConfig((prev) => prev.map((r) => r.key === key ? { ...r, value: r.systemDefault, isOverridden: false } : r))
  }

  async function handleAddKnowledge() {
    setIndexing(true)
    const res = await apiFetch(`/admin/tenants/${tenant.id}/knowledge`, { method: 'POST', body: JSON.stringify(newKnowledge) })
    const doc = await res.json() as KnowledgeDoc
    setKnowledge((prev) => [doc, ...prev])
    setNewKnowledge({ title: '', category: 'GST_WORKFLOW', content: '' })
    setAddingKnowledge(false)
    setIndexing(false)
  }

  async function handleDeleteKnowledge(docId: string) {
    await apiFetch(`/admin/tenants/${tenant.id}/knowledge/${docId}`, { method: 'DELETE' })
    setKnowledge((prev) => prev.filter((d) => d.id !== docId))
    setConfirmDelete(null)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'clients', label: `Clients (${tenant.clientCount})` },
    { id: 'config', label: `Config (${config.filter((c) => c.isOverridden).length} overrides)` },
    { id: 'knowledge', label: `Knowledge (${knowledge.length})` },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{tenant.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tenant.isActive ? 'bg-green-900/50 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
              {tenant.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300 font-medium">{tenant.subscriptionPlan}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{tenant.industry.replace('_',' ')}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Created {new Date(tenant.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Reactivate (only when inactive) */}
          {!tenant.isActive && (
            <button
              onClick={handleReactivate}
              disabled={reactivating}
              className="px-3 py-2 text-sm bg-green-700 hover:bg-green-600 text-white rounded-lg disabled:opacity-50"
            >
              {reactivating ? 'Reactivating…' : 'Reactivate'}
            </button>
          )}
          <div className="text-right">
            <button
              onClick={handleReinvite}
              disabled={reinviting}
              className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50"
            >
              {reinviting ? 'Sending…' : 'Resend invite'}
            </button>
            {reinviteMsg && <p className="text-xs mt-1 text-gray-400">{reinviteMsg}</p>}
          </div>
          <button
            onClick={async () => {
              const res = await apiFetch(`/admin/tenants/${tenant.id}/impersonate`, { method: 'POST' })
              const data = await res.json() as { url?: string }
              if (data.url) window.open(data.url, '_blank')
            }}
            className="px-3 py-2 text-sm bg-amber-700 hover:bg-amber-600 text-white rounded-lg"
          >
            Impersonate →
          </button>
        </div>
      </div>

      {/* Inactive warning banner */}
      {!tenant.isActive && (
        <div className="flex items-center justify-between bg-red-900/30 border border-red-800 rounded-lg px-4 py-3">
          <p className="text-sm text-red-300">This tenant is <strong>deactivated</strong>. Users cannot log in.</p>
          <button
            onClick={handleReactivate}
            disabled={reactivating}
            className="ml-4 px-3 py-1.5 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg disabled:opacity-50 shrink-0"
          >
            {reactivating ? 'Reactivating…' : 'Reactivate now'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${tab === id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Clients', value: tenant.clientCount },
              { label: 'Users', value: tenant.userCount },
              { label: 'Invoices', value: tenant.invoiceCount },
              { label: 'Overdue (₹)', value: Number(tenant.overdueAmount ?? 0).toLocaleString('en-IN') },
              { label: 'Documents', value: tenant.documentCount },
              { label: 'Reports', value: tenant.reportCount },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-xl font-semibold text-white mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* User management panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-medium text-white">Users</span>
              <button
                onClick={() => { setShowAddUser(true); setAddUserMsg('') }}
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
              >
                + Add user
              </button>
            </div>

            {/* Add user form */}
            {showAddUser && (
              <div className="px-5 py-4 border-b border-gray-800 bg-gray-800/50 space-y-3">
                <p className="text-xs font-medium text-gray-300">New user — a Clerk invite will be sent to their email</p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={addUserForm.email}
                    onChange={(e) => setAddUserForm((p) => ({ ...p, email: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                  />
                  <input
                    type="text"
                    placeholder="Full name"
                    value={addUserForm.name}
                    onChange={(e) => setAddUserForm((p) => ({ ...p, name: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                  />
                  <select
                    value={addUserForm.role}
                    onChange={(e) => setAddUserForm((p) => ({ ...p, role: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="OPERATIONS_MANAGER">Operations Manager</option>
                    <option value="STAFF">Staff</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddUser}
                    disabled={addingUser || !addUserForm.email || !addUserForm.name}
                    className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50"
                  >
                    {addingUser ? 'Adding…' : 'Add + send invite'}
                  </button>
                  <button
                    onClick={() => { setShowAddUser(false); setAddUserMsg('') }}
                    className="px-4 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
                {addUserMsg && (
                  <p className={`text-xs ${addUserMsg.includes('failed') || addUserMsg.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                    {addUserMsg}
                  </p>
                )}
              </div>
            )}

            {/* Users table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Name', 'Email', 'Role', 'Status', 'Last active', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                    <td className="px-5 py-2.5 text-white text-sm">
                      {u.name}
                      {u.isPending && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-900/50 text-amber-400 rounded">pending</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-gray-400 text-xs">{u.email}</td>
                    <td className="px-5 py-2.5">
                      <select
                        value={u.role}
                        disabled={updatingRoleId === u.id || !u.isActive}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="OPERATIONS_MANAGER">Ops Manager</option>
                        <option value="STAFF">Staff</option>
                      </select>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${u.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {u.isActive ? 'Active' : 'Removed'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-gray-400 text-xs">
                      {new Date(u.updatedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-5 py-2.5">
                      {u.isActive && (
                        confirmRemove === u.id ? (
                          <span className="flex items-center gap-2">
                            <button
                              onClick={() => handleRemoveUser(u.id)}
                              disabled={removingUserId === u.id}
                              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              {removingUserId === u.id ? '…' : 'Confirm remove'}
                            </button>
                            <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-500">Cancel</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(u.id)}
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Remove
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pending Clerk invitations */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-medium text-white">
                Pending invitations
                {!loadingInvites && invitations.length > 0 && (
                  <span className="ml-2 text-xs bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded">{invitations.length}</span>
                )}
              </span>
              <button onClick={loadInvitations} className="text-xs text-gray-500 hover:text-gray-300">Refresh</button>
            </div>
            {loadingInvites ? (
              <div className="px-5 py-4 text-xs text-gray-500">Loading…</div>
            ) : invitations.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-gray-500">No pending invitations</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Email', 'Role', 'Sent', 'Expires', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-5 py-2.5 text-white text-xs">{inv.email}</td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">{inv.role}</td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">
                        {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleResendInvitation(inv.id)}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Clients */}
      {tab === 'clients' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImport(e.target.files[0]) }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50">
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <a href="/client-import-template.csv" download className="text-xs text-indigo-400 hover:text-indigo-300">Download template</a>
          </div>

          {importResult && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm space-y-2">
              <p className="text-white font-medium">Import complete</p>
              <p className="text-gray-400">{importResult.created} created · {importResult.updated} updated · {importResult.skipped} skipped</p>
              {importResult.errors.length > 0 && (
                <ul className="text-red-400 space-y-0.5">
                  {importResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.reason}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {tenant.clients.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">No clients yet — import a CSV to add them</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-800">{['Name','GSTIN','Filer type','Status'].map((h) => <th key={h} className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {tenant.clients.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-2.5 text-white">{c.name}</td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs font-mono">{c.gstin ?? '—'}</td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">{c.filerType.toLowerCase()}</td>
                      <td className="px-5 py-2.5"><span className={`text-xs px-1.5 py-0.5 rounded ${c.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Config */}
      {tab === 'config' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 bg-amber-950/30">
            <p className="text-xs text-amber-400">Overrides affect only this tenant. Reset to system default to remove override.</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800">{['Label','Key','Default','Current value',''].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-800">
              {config.map((row) => (
                <ConfigRowEditor key={row.key} row={row} onSet={(v) => handleConfigSet(row.key, v)} onReset={() => handleConfigReset(row.key)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Knowledge */}
      {tab === 'knowledge' && (
        <div className="space-y-4">
          <button onClick={() => setAddingKnowledge(true)} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">+ Add document</button>

          {addingKnowledge && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-white">New knowledge document</h3>
              <input value={newKnowledge.title} onChange={(e) => setNewKnowledge((p) => ({...p,title:e.target.value}))} placeholder="Title" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={newKnowledge.category} onChange={(e) => setNewKnowledge((p) => ({...p,category:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {['GST_WORKFLOW','TDS_WORKFLOW','CLIENT_ONBOARDING','FILING_CHECKLIST','COMPANY_POLICY','GENERAL'].map((c) => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
              <textarea rows={8} value={newKnowledge.content} onChange={(e) => setNewKnowledge((p) => ({...p,content:e.target.value}))} placeholder="Document content…" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-2">
                <button onClick={handleAddKnowledge} disabled={indexing || !newKnowledge.title || !newKnowledge.content} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50">
                  {indexing ? 'Indexing…' : 'Save + index'}
                </button>
                <button onClick={() => setAddingKnowledge(false)} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {knowledge.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">No knowledge documents yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-800">{['Title','Category','Chunks','Uploaded',''].map((h) => <th key={h} className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {knowledge.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-2.5 text-white">{d.title}</td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">{d.category.replace(/_/g,' ')}</td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">{d.chunkCount}</td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="px-5 py-2.5">
                        {confirmDelete === d.id ? (
                          <span className="flex items-center gap-2">
                            <button onClick={() => handleDeleteKnowledge(d.id)} className="text-xs text-red-400 hover:text-red-300">Confirm delete</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500">Cancel</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmDelete(d.id)} className="text-xs text-red-500 hover:text-red-400">Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Activity */}
      {tab === 'activity' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {audit.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">No activity recorded</div>
          ) : (
            <>
              <div className="flex justify-end px-5 py-3 border-b border-gray-800">
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(['Timestamp,User,Action,Details', ...audit.map((a) => `${a.createdAt},${a.userName ?? ''},${a.action},${JSON.stringify(a.metadata ?? {})}`),].join('\n'))}`}
                  download={`audit-${tenant.name}.csv`}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Export CSV
                </a>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-800">{['Timestamp','User','Action','Details'].map((h) => <th key={h} className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="px-5 py-2.5 text-gray-400 text-xs whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      <td className="px-5 py-2.5 text-gray-300 text-xs">{a.userName ?? '—'}</td>
                      <td className="px-5 py-2.5 text-white text-xs font-medium">{a.action}</td>
                      <td className="px-5 py-2.5 text-gray-500 text-xs font-mono">{a.metadata ? JSON.stringify(a.metadata).slice(0, 80) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ConfigRowEditor({ row, onSet, onReset }: { row: ConfigRow; onSet: (v: unknown) => void; onReset: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(row.value))

  function save() {
    let v: unknown = draft
    if (row.dataType === 'NUMBER') v = parseFloat(draft)
    if (row.dataType === 'BOOLEAN') v = draft === 'true'
    if (row.dataType === 'JSON') { try { v = JSON.parse(draft) } catch { return } }
    onSet(v)
    setEditing(false)
  }

  return (
    <tr>
      <td className="px-4 py-2.5 text-white text-xs font-medium">{row.label}</td>
      <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">{row.key}</td>
      <td className="px-4 py-2.5 text-gray-500 text-xs">{String(row.systemDefault)}</td>
      <td className="px-4 py-2.5">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} className="bg-gray-800 border border-gray-600 text-white rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500" autoFocus />
            <button onClick={save} className="text-xs text-indigo-400 hover:text-indigo-300">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500">×</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white">{String(row.value)}</span>
            {row.isOverridden && <span className="text-xs bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded">Custom</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button onClick={() => { setDraft(String(row.value)); setEditing(true) }} className="text-xs text-indigo-400 hover:text-indigo-300">Edit</button>
          {row.isOverridden && <button onClick={onReset} className="text-xs text-gray-500 hover:text-gray-300">Reset</button>}
        </div>
      </td>
    </tr>
  )
}
