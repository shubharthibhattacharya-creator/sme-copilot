import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function ImpersonatePage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-sm">
          <div className="text-3xl mb-3">🔒</div>
          <p className="text-sm text-gray-600">No token provided.</p>
        </div>
      </div>
    )
  }

  // Verify token with admin secret
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">ADMIN_SECRET not configured on web server.</p>
      </div>
    )
  }

  let companyId: string
  let companyName: string

  try {
    const res = await fetch(`${API_URL}/api/v1/admin/impersonate/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Invalid token' })) as { message?: string }
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-sm">
            <div className="text-3xl mb-3">⏱</div>
            <h1 className="text-base font-semibold text-gray-900 mb-2">Session expired or invalid</h1>
            <p className="text-sm text-gray-500">{err.message ?? 'Please generate a new impersonation link from the admin panel.'}</p>
          </div>
        </div>
      )
    }

    const data = await res.json() as { companyId: string; companyName: string }
    companyId = data.companyId
    companyName = data.companyName
  } catch {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">Could not verify token. Check API connectivity.</p>
      </div>
    )
  }

  // Set impersonation cookie (30 minute TTL)
  const cookieStore = await cookies()
  cookieStore.set('impersonation_session', `${companyId}:${encodeURIComponent(companyName)}`, {
    httpOnly: false, // needs to be readable by client for banner
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 60,
    path: '/',
  })

  redirect('/dashboard')
}
