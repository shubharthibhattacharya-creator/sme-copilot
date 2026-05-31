'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { TenantSummary } from '@/lib/admin-api'

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-blue-900/40 text-blue-400',
  GROWTH: 'bg-purple-900/40 text-purple-400',
  ENTERPRISE: 'bg-amber-900/40 text-amber-400',
}

const INDUSTRY_LABEL: Record<string, string> = {
  CA_FIRM: 'CA Firm',
  DISTRIBUTOR: 'Distributor',
  MANUFACTURER: 'Manufacturer',
}

interface Props { initialTenants: TenantSummary[] }

export function TenantsList({ initialTenants }: Props) {
  const [tenants, setTenants] = useState(initialTenants)
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [plan, setPlan] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [reactivating, setReactivating] = useState<string | null>(null)

  const filtered = tenants.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    if (industry && t.industry !== industry) return false
    if (plan && t.subscriptionPlan !== plan) return false
    return true
  })

  async function handleImpersonate(id: string, name: string) {
    try {
      const res = await fetch(`/api/admin/tenants/${id}/impersonate`, { method: 'POST' })
      const data = await res.json() as { url?: string }
      if (data.url) window.open(data.url, '_blank')
    } catch { alert('Impersonation failed') }
  }

  async function handleDeactivate(id: string) {
    try {
      await fetch(`/api/admin/tenants/${id}/deactivate`, { method: 'DELETE' })
      setTenants((prev) => prev.map((t) => t.id === id ? { ...t, isActive: false } : t))
      setConfirming(null)
    } catch { alert('Deactivation failed') }
  }

  async function handleReactivate(id: string) {
    try {
      await fetch(`/api/admin/tenants/${id}/reactivate`, { method: 'POST' })
      setTenants((prev) => prev.map((t) => t.id === id ? { ...t, isActive: true } : t))
      setReactivating(null)
    } catch { alert('Reactivation failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search firm name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All industries</option>
          <option value="CA_FIRM">CA Firm</option>
          <option value="DISTRIBUTOR">Distributor</option>
          <option value="MANUFACTURER">Manufacturer</option>
        </select>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All plans</option>
          <option value="STARTER">Starter</option>
          <option value="GROWTH">Growth</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            {tenants.length === 0
              ? 'No tenants yet — create your first one'
              : 'No tenants match your filters'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Firm', 'Industry', 'Plan', 'Clients', 'Users', 'Docs', 'Last active', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${t.id}`} className="text-white hover:text-indigo-300 font-medium">{t.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{INDUSTRY_LABEL[t.industry] ?? t.industry}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[t.subscriptionPlan] ?? 'bg-gray-800 text-gray-400'}`}>
                      {t.subscriptionPlan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{t.clientCount}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{t.userCount}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{t.documentCount}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {t.lastActivityAt ? new Date(t.lastActivityAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${t.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/tenants/${t.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">View</Link>
                      <button onClick={() => handleImpersonate(t.id, t.name)} className="text-xs text-amber-400 hover:text-amber-300">Impersonate</button>
                      {t.isActive ? (
                        confirming === t.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => handleDeactivate(t.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                            <button onClick={() => setConfirming(null)} className="text-xs text-gray-400">Cancel</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirming(t.id)} className="text-xs text-red-500 hover:text-red-400">Deactivate</button>
                        )
                      ) : (
                        reactivating === t.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => handleReactivate(t.id)} className="text-xs text-green-400 hover:text-green-300">Confirm</button>
                            <button onClick={() => setReactivating(null)} className="text-xs text-gray-400">Cancel</button>
                          </span>
                        ) : (
                          <button onClick={() => setReactivating(t.id)} className="text-xs text-green-500 hover:text-green-400">Reactivate</button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
