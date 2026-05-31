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

  const fetchPerms = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      setPerms(cache.data)
      setLoaded(true)
      return
    }
    try {
      const data = await request<PermissionsData>('/settings/me/permissions')
      cache = { data, fetchedAt: Date.now() }
      setPerms(data)
    } catch {
      // Use defaults on error — user is still authenticated, just can't resolve permissions
    } finally {
      setLoaded(true)
    }
  }, [request])

  useEffect(() => {
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
