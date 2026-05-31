const API_URL = process.env.ADMIN_API_URL ?? 'http://localhost:3001'

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET ?? ''
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const secret = getAdminSecret()
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': secret,
      ...init.headers,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as { message?: string }
    throw new Error(err.message ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function reqForm<T>(path: string, body: FormData): Promise<T> {
  const secret = getAdminSecret()
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    headers: { 'x-admin-secret': secret },
    body,
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as { message?: string }
    throw new Error(err.message ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TenantSummary {
  id: string
  name: string
  industry: string
  subscriptionPlan: string
  isActive: boolean
  createdAt: string
  userCount: number
  clientCount: number
  invoiceCount: number
  documentCount: number
  lastActivityAt: string | null
  tenantConfig: Record<string, unknown>
}

export interface TenantDetail extends TenantSummary {
  gstNumber: string | null
  panNumber: string | null
  phone: string | null
  address: string | null
  users: Array<{ id: string; name: string; email: string; role: string; updatedAt: string }>
  clients: Array<{ id: string; name: string; gstin: string | null; filerType: string; isActive: boolean }>
  overdueAmount: number
  reportCount: number
  whatsappStats: { sentThisMonth: number; deliveryRate: number }
}

export interface ConfigRow {
  key: string
  label: string
  category: string
  value: unknown
  systemDefault: unknown
  isOverridden: boolean
  dataType: string
  unit: string | null
  description: string | null
  minValue: unknown
  maxValue: unknown
}

export interface PlatformStats {
  totalTenants: number
  activeTenants: number
  totalClients: number
  totalDocuments: number
  totalWhatsappMessages: number
  aiCallsToday: number
  storageUsedMB: number
  revenueThisMonth: string
}

export interface AuditEntry {
  id: string
  companyId: string
  companyName: string
  userId: string | null
  userName: string | null
  action: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; reason: string }>
}

export interface CreateTenantDto {
  name: string
  industry: string
  subscriptionPlan: string
  adminEmail: string
  adminName: string
  gstNumber?: string
  panNumber?: string
  phone?: string
  address?: string
  modulesEnabled?: string[]
}

export interface KnowledgeDoc {
  id: string
  title: string
  category: string
  chunkCount: number
  createdAt: string
}

export interface ImpersonationResult {
  token: string
  url: string
}

export interface TenantUser {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  isPending: boolean
  updatedAt: string
}

export interface PendingInvitation {
  id: string
  email: string
  role: string
  moduleAccess: string[]
  createdAt: string
  expiresAt: string | null
}

// ── API methods ───────────────────────────────────────────────────────────────

export const adminApi = {
  stats: () => req<PlatformStats>('/admin/stats'),

  tenants: {
    list: () => req<TenantSummary[]>('/admin/tenants'),
    get: (id: string) => req<TenantDetail>(`/admin/tenants/${id}`),
    create: (body: CreateTenantDto) =>
      req<TenantSummary>('/admin/tenants', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{ name: string; subscriptionPlan: string; gstNumber: string; panNumber: string; phone: string; address: string; modulesEnabled: string[] }>) =>
      req<TenantSummary>(`/admin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deactivate: (id: string) =>
      req<{ ok: boolean }>(`/admin/tenants/${id}/deactivate`, { method: 'DELETE' }),
    reactivate: (id: string) =>
      req<{ ok: boolean }>(`/admin/tenants/${id}/reactivate`, { method: 'POST' }),
    listUsers: (id: string) => req<TenantUser[]>(`/admin/tenants/${id}/users`),
    addUser: (id: string, body: { email: string; name: string; role?: string }) =>
      req<{ id: string; inviteSent?: boolean; reactivated?: boolean }>(`/admin/tenants/${id}/users`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    updateUserRole: (id: string, userId: string, role: string) =>
      req<{ ok: boolean }>(`/admin/tenants/${id}/users/${userId}`, {
        method: 'PATCH', body: JSON.stringify({ role }),
      }),
    removeUser: (id: string, userId: string) =>
      req<{ ok: boolean }>(`/admin/tenants/${id}/users/${userId}`, { method: 'DELETE' }),
    listInvitations: (id: string) => req<PendingInvitation[]>(`/admin/tenants/${id}/invitations`),
    resendInvitation: (id: string, invId: string) =>
      req<{ ok: boolean }>(`/admin/tenants/${id}/invitations/${invId}/resend`, { method: 'POST' }),
    revokeInvitation: (id: string, invId: string) =>
      req<{ ok: boolean }>(`/admin/tenants/${id}/invitations/${invId}`, { method: 'DELETE' }),
    importClients: (id: string, file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return reqForm<ImportResult>(`/admin/tenants/${id}/clients/import`, fd)
    },
    impersonate: (id: string) =>
      req<ImpersonationResult>(`/admin/tenants/${id}/impersonate`, { method: 'POST' }),
  },

  config: {
    list: (tenantId: string) => req<ConfigRow[]>(`/admin/tenants/${tenantId}/config`),
    set: (tenantId: string, key: string, value: unknown) =>
      req<{ ok: boolean }>(`/admin/tenants/${tenantId}/config/${key}`, {
        method: 'PATCH', body: JSON.stringify({ value }),
      }),
    reset: (tenantId: string, key: string) =>
      req<{ ok: boolean }>(`/admin/tenants/${tenantId}/config/${key}`, { method: 'DELETE' }),
  },

  knowledge: {
    list: (tenantId: string) => req<KnowledgeDoc[]>(`/admin/tenants/${tenantId}/knowledge`),
    create: (tenantId: string, body: { title: string; category: string; content: string }) =>
      req<KnowledgeDoc>(`/admin/tenants/${tenantId}/knowledge`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    delete: (tenantId: string, docId: string) =>
      req<{ ok: boolean }>(`/admin/tenants/${tenantId}/knowledge/${docId}`, { method: 'DELETE' }),
  },

  systemConfig: {
    list: () => req<ConfigRow[]>('/admin/system-config'),
    update: (key: string, value: unknown) =>
      req<{ ok: boolean }>(`/admin/system-config/${key}`, {
        method: 'PATCH', body: JSON.stringify({ value }),
      }),
  },

  audit: (params?: { limit?: number; companyId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.companyId) qs.set('companyId', params.companyId)
    return req<AuditEntry[]>(`/admin/audit?${qs.toString()}`)
  },
}
