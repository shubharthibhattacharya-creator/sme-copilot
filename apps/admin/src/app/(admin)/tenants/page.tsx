import { adminApi } from '@/lib/admin-api'
import { TenantsList } from '@/components/TenantsList'

export default async function TenantsPage() {
  const tenants = await adminApi.tenants.list().catch(() => [])
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Tenants</h1>
          <p className="text-sm text-gray-400 mt-1">{tenants.length} total</p>
        </div>
        <a href="/tenants/new" className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
          + New tenant
        </a>
      </div>
      <TenantsList initialTenants={tenants} />
    </div>
  )
}
