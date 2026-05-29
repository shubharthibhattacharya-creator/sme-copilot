import { auth } from '@clerk/nextjs/server'
import { ClientsManager } from '@/components/settings/ClientsManager'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export default async function ClientsPage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const res = await fetch(`${API_URL}/api/v1/clients?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const initialClients = res.ok
    ? await res.json()
    : { data: [], meta: { total: 0, totalPages: 0 } }

  return <ClientsManager initialClients={initialClients} />
}
