import { auth } from '@clerk/nextjs/server'
import { ClientsManager } from '@/components/settings/ClientsManager'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export default async function ClientsPage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const [clientsRes, teamRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/clients?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${API_URL}/api/v1/settings/team`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ])

  const initialClients = clientsRes.ok
    ? await clientsRes.json()
    : { data: [], meta: { total: 0, totalPages: 0 } }

  const team = teamRes.ok ? await teamRes.json() : []

  return <ClientsManager initialClients={initialClients} team={team} />
}
