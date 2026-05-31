import type { UserRole } from '@opsc/database'

export const MODULE_LIST = [
  'dashboard',
  'collections',
  'documents',
  'reports',
  'whatsapp',
  'assistant',
  'tax_integration',
  'compliance',
  'settings',
] as const

export type AppModule = (typeof MODULE_LIST)[number]

export const ROLE_DEFAULT_MODULES: Record<UserRole, AppModule[]> = {
  ADMIN: [
    'dashboard', 'collections', 'documents', 'reports',
    'whatsapp', 'assistant', 'tax_integration', 'compliance', 'settings',
  ],
  OPERATIONS_MANAGER: [
    'dashboard', 'collections', 'documents', 'reports',
    'whatsapp', 'assistant', 'compliance', 'settings',
    // settings included for read-only rules view; write actions gated by @Roles(ADMIN)
  ],
  STAFF: [
    'dashboard', 'collections', 'documents', 'assistant',
    // collections view-only enforced by action permissions
  ],
}

export const ROLE_ACTION_PERMISSIONS: Record<UserRole, Record<string, string[]>> = {
  ADMIN: {
    collections:     ['view', 'create', 'edit', 'delete', 'send_reminder', 'mark_paid'],
    documents:       ['view', 'upload', 'verify', 'reject', 'delete', 'request'],
    reports:         ['view', 'generate', 'download', 'schedule'],
    whatsapp:        ['view', 'send', 'edit_templates', 'bulk_send'],
    assistant:       ['view', 'ask', 'upload_knowledge'],
    tax_integration: ['view', 'configure', 'push', 'disconnect'],
    compliance:      ['view', 'create', 'edit', 'delete', 'assign', 'mark_filed'],
    settings:        ['view', 'edit', 'invite_users', 'manage_team', 'manage_rules'],
  },
  OPERATIONS_MANAGER: {
    collections:     ['view', 'create', 'edit', 'send_reminder', 'mark_paid'],
    documents:       ['view', 'upload', 'verify', 'reject', 'request'],
    reports:         ['view', 'generate', 'download'],
    whatsapp:        ['view', 'send', 'bulk_send'],
    assistant:       ['view', 'ask'],
    compliance:      ['view', 'create', 'edit', 'assign', 'mark_filed'],
    settings:        ['view'],
  },
  STAFF: {
    collections:     ['view'],
    documents:       ['view', 'upload', 'verify'],
    assistant:       ['view', 'ask'],
    compliance:      ['view'],
    reports:         [],
    whatsapp:        [],
    settings:        [],
  },
}

/**
 * Sanitise the requested module list against what this role is allowed to have.
 * Always ensures 'dashboard' and 'documents' are included.
 * Strips any module not in ROLE_DEFAULT_MODULES[role].
 */
export function sanitiseModuleAccess(role: UserRole, requested: string[]): AppModule[] {
  const allowed = ROLE_DEFAULT_MODULES[role]
  const filtered = requested.filter((m) => allowed.includes(m as AppModule)) as AppModule[]
  // Dashboard and documents are always on
  return Array.from(new Set([...filtered, 'dashboard', 'documents']))
}
