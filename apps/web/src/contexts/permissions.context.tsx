'use client'
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useApiClient } from '@/lib/client-api'

export const MODULE_LIST = [
  'dashboard', 'collections', 'documents', 'reports', 'whatsapp',
  'assistant', 'tax_integration', 'compliance', 'settings',
] as const

export type AppModule = (typeof MODULE_LIST)[number]
export type UserRole = 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'

interface PermissionsData {
  role: UserRole
  moduleAccess: AppModule[]
  actionPermissions: Record<string, string[]>
  isAdmin: boolean
  canManageTeam: boolean
  canManageRules: boolean
}

interface PermissionsContextValue extends PermissionsData {
  hasModule: (module: AppModule) => boolean
  canDo: (module: string, action: string) => boolean
  loaded: boolean
  refresh: () => void
}

const PermissionsCtx = createContext<PermissionsContextValue | null>(null)

const DEFAULT_PERMISSIONS: PermissionsData = {
  role: 'STAFF',
  moduleAccess: ['dashboard', 'collections', 'documents', 'assistant'],
  actionPermissions: {},
  isAdmin: false,
  canManageTeam: false,
  canManageRules: false,
}

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000
let cache: { data: PermissionsData; fetchedAt: number } | null = null

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { request } = useApiClient()
  const [perms, setPerms] = useState<PermissionsData>(DEFAULT_PERMISSIONS)
  const [loaded, setLoaded] = useState(false)

  const fetchPerms = useCallback(async (force = false, attempt = 0) => {
    if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      setPerms(cache.data)
      setLoaded(true)
      return
    }
    try {
      const data = await request<PermissionsData>('/settings/me/permissions')
      cache = { data, fetchedAt: Date.now() }
      setPerms(data)
      setLoaded(true)
    } catch {
      // Retry up to 3 times with backoff — auth token may not be ready immediately after login
      if (attempt < 3) {
        setTimeout(() => fetchPerms(force, attempt + 1), 800 * (attempt + 1))
      } else {
        // After exhausting retries, fall back to defaults and mark loaded
        setLoaded(true)
      }
    }
  }, [request])

  useEffect(() => {
    // Clear cache on mount so a fresh login always fetches real permissions
    cache = null
    fetchPerms()
  }, [fetchPerms])

  const hasModule = useCallback(
    (module: AppModule) => perms.moduleAccess.includes(module),
    [perms.moduleAccess],
  )

  const canDo = useCallback(
    (module: string, action: string) => {
      const actions = perms.actionPermissions[module]
      return Array.isArray(actions) && actions.includes(action)
    },
    [perms.actionPermissions],
  )

  const refresh = useCallback(() => {
    cache = null
    fetchPerms(true)
  }, [fetchPerms])

  return (
    <PermissionsCtx.Provider value={{ ...perms, hasModule, canDo, loaded, refresh }}>
      {children}
    </PermissionsCtx.Provider>
  )
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsCtx)
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider')
  return ctx
}
