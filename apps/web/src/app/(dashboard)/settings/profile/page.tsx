import { auth } from '@clerk/nextjs/server'
import { ProfileForm } from '@/components/settings/ProfileForm'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export default async function ProfilePage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const res = await fetch(`${API_URL}/api/v1/settings/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const profile = res.ok
    ? await res.json()
    : { id: '', name: '', industry: '', subscriptionPlan: '', logoUrl: null, gstNumber: null, panNumber: null, address: null, website: null, phone: null, createdAt: new Date().toISOString() }

  return <ProfileForm profile={profile} />
}
