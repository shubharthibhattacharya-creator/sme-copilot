import { auth } from '@clerk/nextjs/server'
import { TeamManager } from '@/components/settings/TeamManager'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export default async function TeamPage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const res = await fetch(`${API_URL}/api/v1/settings/team`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const team = res.ok ? await res.json() : []

  return <TeamManager initialTeam={team} />
}
