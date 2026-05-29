'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const IS_DEV = process.env['NODE_ENV'] !== 'production'

/** In development, fall back to the localStorage dev bypass token when there is no Clerk session. */
function getDevToken(): string | null {
  if (!IS_DEV) return null
  try {
    return localStorage.getItem('dev_token')
  } catch {
    return null
  }
}

export function useApiClient() {
  const { getToken } = useAuth()

  const request = useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      // In dev mode, prefer the localStorage bypass token so seeded users work
      // even when a real Clerk session exists from a different account.
      const devToken = getDevToken()
      let token = devToken ?? (await getToken())

      const response = await fetch(`${API_URL}/api/v1${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers as Record<string, string> | undefined),
        },
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Request failed' })) as { message?: string }
        throw new Error(err.message ?? `API error ${response.status}`)
      }
      return response.json() as Promise<T>
    },
    [getToken],
  )

  return { request }
}
