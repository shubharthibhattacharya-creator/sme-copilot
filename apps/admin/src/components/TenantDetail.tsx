'use client'
import { useState, useRef } from 'react'
import type { TenantDetail as TenantDetailType, ConfigRow, KnowledgeDoc, AuditEntry } from '@/lib/admin-api'

type Tab = 'overview' | 'clients' | 'config' | 'knowledge' | 'activity'

const API = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:3001'
const SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''

function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': SECRET, ...init.headers },
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
  const [tenant] = useState(initial)
  const [config, setConfig] = useState(initialConfig)
  const [knowledge, setKnowledge] = useState(initialKnowledge)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: Array<{row:number;reason:string}> } | null>(null)
  const [importing, setImporting] = useState(false)
  const [newKnowledge, setNewKnowledge] = useState({ title: '', category: 'GST_WORKFLOW', content: '' })
  const [addingKnowledge, setAddingKnowledge] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImport(file: File) {
    setImporting(true)
    setImportResult(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API}/api/v1/admin/tenants/${tenant.id}/clients/import`, {
      method: 'POST',
      headers: { 'x-admin-secret': SECRET },
      body: fd,
    })
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
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">{tenant.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tenant.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              {tenant.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300 font-medium">{tenant.subscriptionPlan}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{tenant.industry.replace('_',' ')}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Created {new Date(tenant.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</p>
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

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 text-sm font-medium text-white">Users</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800">{['Name','Email','Role','Last active'].map((h) => <th key={h} className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-800">
                {tenant.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-2.5 text-white">{u.name}</td>
                    <td className="px-5 py-2.5 text-gray-400 text-xs">{u.email}</td>
                    <td className="px-5 py-2.5 text-gray-400 text-xs">{u.role}</td>
                    <td className="px-5 py-2.5 text-gray-400 text-xs">{new Date(u.updatedAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
