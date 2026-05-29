// ─── Shared API response wrapper ─────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  meta?: PaginationMeta
}

export interface ApiError {
  statusCode: number
  message: string
  error?: string
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PaginationQuery {
  page?: number
  limit?: number
}

// ─── Auth context carried on every request ───────────────────────────────────

export interface AuthenticatedUser {
  clerkId: string
  userId: string
  companyId: string
  role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'
  email: string
  name: string
}
