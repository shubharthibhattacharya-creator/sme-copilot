import { auth } from '@clerk/nextjs/server'
import { BusinessRules } from '@/components/settings/BusinessRules'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export default async function RulesPage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const res = await fetch(`${API_URL}/api/v1/settings/rules`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const config = res.ok ? await res.json() : {}

  return <BusinessRules initialConfig={config} />
}
