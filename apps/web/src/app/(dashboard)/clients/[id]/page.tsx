export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import { ClientComplianceTab } from '@/components/clients/ClientComplianceTab'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Client {
  id: string
  name: string
  gstin?: string | null
  filerType: string
  email?: string | null
  phone?: string | null
}

async function fetchClient(id: string, token: string): Promise<Client | null> {
  const res = await fetch(`${API_URL}/api/v1/clients/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return res.ok ? res.json() : null
}

async function fetchChecklists(clientId: string, token: string) {
  const res = await fetch(`${API_URL}/api/v1/compliance/checklists?clientId=${clientId}&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return res.ok ? res.json() : { items: [], meta: { total: 0 } }
}

async function fetchTeam(token: string) {
  const res = await fetch(`${API_URL}/api/v1/settings/team`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return res.ok ? res.json() : []
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const [client, checklists, team] = await Promise.all([
    fetchClient(id, token),
    fetchChecklists(id, token),
    fetchTeam(token),
  ])

  if (!client) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{client.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {client.gstin ? `GSTIN: ${client.gstin}` : 'No GSTIN'}
          {client.email ? ` · ${client.email}` : ''}
          {client.phone ? ` · ${client.phone}` : ''}
        </p>
      </div>

      <ClientComplianceTab
        client={client}
        initialChecklists={checklists.items ?? []}
        team={team}
      />
    </div>
  )
}
