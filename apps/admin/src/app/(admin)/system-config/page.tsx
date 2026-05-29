import { adminApi } from '@/lib/admin-api'
import { SystemConfigTable } from '@/components/SystemConfigTable'

export default async function SystemConfigPage() {
  const config = await adminApi.systemConfig.list().catch(() => [])
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">System config</h1>
        <p className="text-sm text-gray-400 mt-1">Platform-wide defaults applied to all tenants without overrides</p>
      </div>
      <div className="mb-4 bg-amber-950/40 border border-amber-800/50 rounded-lg px-4 py-3 text-xs text-amber-400">
        Warning — changes here affect all tenants that have not set a custom override for the key.
      </div>
      <SystemConfigTable initialConfig={config} />
    </div>
  )
}
