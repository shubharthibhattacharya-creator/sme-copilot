import { adminApi } from '@/lib/admin-api'
import Link from 'next/link'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default async function AdminDashboard() {
  const [stats, tenants, audit] = await Promise.all([
    adminApi.stats().catch(() => null),
    adminApi.tenants.list().catch(() => []),
    adminApi.audit({ limit: 20 }).catch(() => []),
  ])

  const recentTenants = tenants.slice(0, 10)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Platform overview</p>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total tenants" value={stats.totalTenants} />
          <StatCard label="Active (30d)" value={stats.activeTenants} />
          <StatCard label="Total clients" value={stats.totalClients} />
          <StatCard label="AI calls today" value={stats.aiCallsToday} />
          <StatCard label="Documents" value={stats.totalDocuments} />
          <StatCard label="WhatsApp messages" value={stats.totalWhatsappMessages} />
          <StatCard label="Storage" value={`${stats.storageUsedMB} MB`} />
          <StatCard label="Revenue (est.)" value={stats.revenueThisMonth} />
        </div>
      ) : (
        <div className="text-sm text-gray-500">API unavailable</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tenants */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-medium text-white">Recent tenants</h2>
            <Link href="/tenants" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
          </div>
          {recentTenants.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              No tenants yet —{' '}
              <Link href="/tenants/new" className="text-indigo-400 hover:underline">create your first one</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">Firm</th>
                  <th className="text-left px-3 py-2.5 text-xs text-gray-400 font-medium">Plan</th>
                  <th className="text-left px-3 py-2.5 text-xs text-gray-400 font-medium">Clients</th>
                  <th className="text-left px-3 py-2.5 text-xs text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-800/40">
                    <td className="px-5 py-2.5">
                      <Link href={`/tenants/${t.id}`} className="text-white hover:text-indigo-300">{t.name}</Link>
                      <div className="text-xs text-gray-500">{t.industry.replace('_', ' ')}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-300 text-xs">{t.subscriptionPlan}</td>
                    <td className="px-3 py-2.5 text-gray-300 text-xs">{t.clientCount}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${t.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Audit log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-medium text-white">Recent activity</h2>
          </div>
          {audit.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No activity yet</div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {audit.map((a) => (
                <div key={a.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-white">{a.action}</span>
                      <span className="text-xs text-gray-400 ml-2">{a.companyName}</span>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {a.userName && <div className="text-xs text-gray-500 mt-0.5">{a.userName}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
