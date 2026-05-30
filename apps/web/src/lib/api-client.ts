import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let authHeaders: Record<string, string> = {}

  // Check for impersonation session first (admin viewing a tenant)
  const cookieStore = await cookies()
  const impersonationCookie = cookieStore.get('impersonation_session')
  if (impersonationCookie?.value) {
    const companyId = impersonationCookie.value.split(':')[0]
    const adminSecret = process.env['ADMIN_SECRET']
    if (companyId && adminSecret) {
      authHeaders = {
        'x-impersonation-company-id': companyId,
        'x-admin-secret': adminSecret,
      }
    }
  } else {
    const { getToken } = await auth()
    const token = await getToken()
    if (token) authHeaders = { Authorization: `Bearer ${token}` }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ userMessage: 'Unknown error' })) as {
      userMessage?: string
      message?: string
    }
    throw new Error(error.userMessage ?? error.message ?? `API error: ${response.status}`)
  }

  return response.json() as Promise<T>
}
