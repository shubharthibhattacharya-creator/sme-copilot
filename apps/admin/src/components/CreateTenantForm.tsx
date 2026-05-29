'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const INDUSTRY_MODULES: Record<string, string[]> = {
  CA_FIRM: ['dashboard','filings','collections','reporting','documents','assistant','whatsapp'],
  DISTRIBUTOR: ['dashboard','collections','inventory','whatsapp','reporting'],
  MANUFACTURER: ['dashboard','inventory','reporting','documents','assistant'],
}

const ALL_MODULES = ['dashboard','filings','collections','inventory','documents','reporting','whatsapp','assistant']

export function CreateTenantForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ id: string; email: string; clerkInviteSent: boolean } | null>(null)

  const [form, setForm] = useState({
    name: '', industry: 'CA_FIRM', subscriptionPlan: 'STARTER',
    adminEmail: '', adminName: '',
    gstNumber: '', panNumber: '', phone: '', address: '',
  })
  const [modules, setModules] = useState<string[]>(INDUSTRY_MODULES['CA_FIRM']!)

  function set(k: string, v: string) {
    setForm((p) => ({ ...p, [k]: v }))
    if (k === 'industry') setModules(INDUSTRY_MODULES[v] ?? INDUSTRY_MODULES['CA_FIRM']!)
  }

  function toggleModule(m: string) {
    setModules((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const secret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:3001'}/api/v1/admin/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ ...form, modulesEnabled: modules }),
      })
      if (!res.ok) {
        const err = await res.json() as { message?: string }
        throw new Error(err.message ?? 'Failed to create tenant')
      }
      const data = await res.json() as { id: string; clerkInviteSent: boolean }
      setSuccess({ id: data.id, email: form.adminEmail, clerkInviteSent: data.clerkInviteSent })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-xl bg-gray-900 border border-gray-800 rounded-xl p-8 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-lg font-semibold text-white">Tenant created</h2>
        {success.clerkInviteSent ? (
          <p className="text-sm text-gray-400">Invitation sent to <strong className="text-white">{success.email}</strong></p>
        ) : (
          <p className="text-sm text-amber-400">Clerk invite failed — send manually to {success.email}</p>
        )}
        <p className="text-xs text-gray-500 font-mono">ID: {success.id}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push(`/tenants/${success.id}`)} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
            View tenant →
          </button>
          <button onClick={() => { setSuccess(null); setForm({ name:'',industry:'CA_FIRM',subscriptionPlan:'STARTER',adminEmail:'',adminName:'',gstNumber:'',panNumber:'',phone:'',address:'' }) }} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg">
            Create another
          </button>
        </div>
      </div>
    )
  }

  const field = (label: string, key: string, type = 'text', required = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        required={required}
        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {/* Section 1 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Firm details</h2>
        <div className="grid grid-cols-2 gap-4">
          {field('Firm name', 'name', 'text', true)}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Industry<span className="text-red-400 ml-0.5">*</span></label>
            <select value={form.industry} onChange={(e) => set('industry', e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="CA_FIRM">CA / Tax Firm</option>
              <option value="DISTRIBUTOR">Distributor</option>
              <option value="MANUFACTURER">Manufacturer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Subscription plan<span className="text-red-400 ml-0.5">*</span></label>
            <select value={form.subscriptionPlan} onChange={(e) => set('subscriptionPlan', e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="STARTER">Starter — ₹2,999/mo</option>
              <option value="GROWTH">Growth — ₹7,999/mo</option>
              <option value="ENTERPRISE">Enterprise — ₹19,999/mo</option>
            </select>
          </div>
          {field('GST number', 'gstNumber')}
          {field('PAN', 'panNumber')}
          {field('Phone', 'phone')}
        </div>
        {field('Address', 'address')}
      </div>

      {/* Section 2 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Admin user</h2>
          <p className="text-xs text-gray-500 mt-0.5">An invitation email will be sent to this address via Clerk</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('Admin name', 'adminName', 'text', true)}
          {field('Admin email', 'adminEmail', 'email', true)}
        </div>
      </div>

      {/* Section 3 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Modules</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pre-selected from industry defaults — override as needed</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ALL_MODULES.map((m) => (
            <label key={m} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={modules.includes(m)}
                onChange={() => toggleModule(m)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-300 group-hover:text-white capitalize">{m.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors"
      >
        {loading ? 'Creating…' : 'Create tenant + send invite'}
      </button>
    </form>
  )
}
