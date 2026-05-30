'use client'
import { useState, useCallback } from 'react'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'

interface Client {
  id: string
  name: string
  gstin: string | null
  pan: string | null
  contactPerson: string | null
  phone: string | null
  email: string | null
  filerType: string
  filingCategory: string
  serviceScope: string[]
  isActive: boolean
  _count: { invoices: number; documents: number }
}

interface Props {
  initialClients: { data: Client[]; meta: { total: number; totalPages: number } }
}

const SERVICES = ['GST_FILING', 'TDS', 'AUDIT', 'BOOKKEEPING']
const FILER_TYPES = ['MONTHLY', 'QUARTERLY', 'ANNUAL']

const EMPTY_FORM = {
  name: '', gstin: '', pan: '', contactPerson: '', phone: '', email: '',
  filerType: 'MONTHLY', filingCategory: 'REGULAR', serviceScope: [] as string[],
}

export function ClientsManager({ initialClients }: Props) {
  const { request } = useApiClient()
  const [clients, setClients] = useState(initialClients.data)
  const [total, setTotal] = useState(initialClients.meta.total)
  const [showModal, setShowModal] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [statsClient, setStatsClient] = useState<{ id: string; name: string; stats: Record<string, unknown> } | null>(null)

  const refresh = useCallback(async () => {
    const res = await request<{ data: Client[]; meta: { total: number; totalPages: number } }>('/clients?limit=50')
    setClients(res.data)
    setTotal(res.meta.total)
  }, [request])

  function openCreate() {
    setEditClient(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(c: Client) {
    setEditClient(c)
    setForm({
      name: c.name,
      gstin: c.gstin ?? '',
      pan: c.pan ?? '',
      contactPerson: c.contactPerson ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      filerType: c.filerType,
      filingCategory: c.filingCategory,
      serviceScope: c.serviceScope,
    })
    setFormError('')
    setShowModal(true)
  }

  function toggleService(svc: string) {
    setForm((f) => ({
      ...f,
      serviceScope: f.serviceScope.includes(svc)
        ? f.serviceScope.filter((s) => s !== svc)
        : [...f.serviceScope, svc],
    }))
  }

  async function save() {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    setSaving(true)
    setFormError('')
    try {
      const body = {
        ...form,
        gstin: form.gstin || undefined,
        pan: form.pan || undefined,
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
      }
      if (editClient) {
        await request(`/clients/${editClient.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await request('/clients', { method: 'POST', body: JSON.stringify(body) })
      }
      setShowModal(false)
      await refresh()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function archive(id: string) {
    await request(`/clients/${id}`, { method: 'DELETE' })
    await refresh()
  }

  async function importCsv() {
    try {
      const res = await request<{ created: number; skipped: number; errors: string[] }>('/clients/import', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText }),
      })
      setImportResult(res)
      await refresh()
    } catch (err) {
      setImportResult({ created: 0, skipped: 0, errors: [err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Import failed'] })
    }
  }

  async function loadStats(client: Client) {
    const stats = await request<Record<string, unknown>>(`/clients/${client.id}/stats`)
    setStatsClient({ id: client.id, name: client.name, stats })
  }

  const CSV_TEMPLATE = 'name,gstin,pan,contactPerson,phone,email,filerType\nSample Client,29AABCS1429B1Z4,AABCS1429B,Rajesh Kumar,+919876543210,rajesh@example.com,MONTHLY'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} client{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(true); setImportResult(null); setCsvText('') }}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Import CSV
          </button>
          <button onClick={openCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            + Add client
          </button>
        </div>
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No clients yet.</p>
          <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Add your first client
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'GSTIN', 'Filer type', 'Services', 'Invoices', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button onClick={() => loadStats(c)} className="font-medium text-blue-600 hover:underline text-left">
                      {c.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs">{c.gstin ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{c.filerType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.serviceScope.map((s) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s.replace('_', ' ')}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c._count.invoices}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => archive(c.id)} className="text-xs text-red-400 hover:text-red-600">Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900">{editClient ? 'Edit client' : 'Add client'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-600 mb-1 block">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">GSTIN</label>
                <input type="text" value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                  maxLength={15} placeholder="29AABCS1429B1Z4"
                  className="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">PAN</label>
                <input type="text" value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))}
                  maxLength={10} placeholder="AABCS1429B"
                  className="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Contact person</label>
                <input type="text" value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600 mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Filer type</label>
                <select value={form.filerType} onChange={(e) => setForm((f) => ({ ...f, filerType: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {FILER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Filing category</label>
                <select value={form.filingCategory} onChange={(e) => setForm((f) => ({ ...f, filingCategory: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['REGULAR', 'COMPOSITION', 'EXEMPT'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600 mb-2 block">Services</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map((svc) => (
                    <button key={svc} type="button"
                      onClick={() => toggleService(svc)}
                      className={`text-xs px-3 py-1.5 rounded-full border ${form.serviceScope.includes(svc) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                      {svc.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving…' : editClient ? 'Update' : 'Create'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Import clients from CSV</h2>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Required columns: name, gstin, pan, contactPerson, phone, email, filerType</p>
              <button onClick={() => {
                const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'clients_template.csv'
                a.click()
              }} className="text-xs text-blue-600 hover:underline shrink-0 ml-2">
                Download template
              </button>
            </div>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={8}
              placeholder={CSV_TEMPLATE}
              className="w-full text-xs font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {importResult && (
              <div className={`text-sm rounded-lg p-3 ${importResult.errors.length > 0 ? 'bg-yellow-50 text-yellow-800' : 'bg-green-50 text-green-800'}`}>
                <p>{importResult.created} created · {importResult.skipped} skipped (duplicate GSTIN)</p>
                {importResult.errors.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={importCsv} disabled={!csvText.trim()}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                Import
              </button>
              <button onClick={() => setShowImport(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats drawer */}
      {statsClient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{statsClient.name}</h2>
              <button onClick={() => setStatsClient(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total invoiced', value: `₹${Number(statsClient.stats.totalInvoiced ?? 0).toLocaleString('en-IN')}` },
                { label: 'Total paid', value: `₹${Number(statsClient.stats.totalPaid ?? 0).toLocaleString('en-IN')}` },
                { label: 'Total overdue', value: `₹${Number(statsClient.stats.totalOverdue ?? 0).toLocaleString('en-IN')}` },
                { label: 'Overdue invoices', value: String(statsClient.stats.overdueCount ?? 0) },
                { label: 'Avg aging (days)', value: String(statsClient.stats.avgAgingDays ?? 0) },
                { label: 'Documents', value: String(statsClient.stats.documentsSubmitted ?? 0) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {Boolean(statsClient.stats['lastPaymentDate']) && (
              <p className="text-xs text-gray-500">Last payment: {new Date(statsClient.stats['lastPaymentDate'] as string).toLocaleDateString('en-IN')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
