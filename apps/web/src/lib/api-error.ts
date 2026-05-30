/**
 * Shape of every error response from the backend GlobalExceptionFilter.
 */
export interface ApiErrorResponse {
  errorCode: string
  userMessage: string
  suggestion: string
  timestamp: string
  path: string
  statusCode?: number
}

/**
 * Typed API error — thrown by apiFetch() on non-2xx responses.
 * Carries the structured fields from the backend error response so
 * UI code can show the correct message without inspecting raw HTTP status codes.
 */
export class ApiError extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly userMessage: string,
    public readonly suggestion: string,
    public readonly status: number,
  ) {
    super(userMessage)
    this.name = 'ApiError'
  }

  /** Session expired — redirect to sign-in */
  get isAuthError() {
    return this.status === 401
  }

  /** Plan limit reached — show upgrade modal, not a toast */
  get isPlanLimitError() {
    return this.errorCode === 'PLAN_LIMIT_EXCEEDED'
  }

  /** Backend validation error */
  get isValidationError() {
    return this.errorCode === 'VALIDATION_ERROR'
  }

  /** Resource not found */
  get isNotFoundError() {
    return this.status === 404
  }

  /** Unexpected server-side failure — show 'contact support' action */
  get isServerError() {
    return this.status >= 500
  }
}

/**
 * Central fetch wrapper — use everywhere instead of raw fetch().
 *
 * On a non-2xx response it parses the backend error body and throws an
 * ApiError so callers can use handleError() to show the right toast/modal.
 *
 * Usage:
 *   const data = await apiFetch<MyType>('/api/v1/documents', { method: 'GET' })
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> | undefined),
    },
  })

  // No-content responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }

  if (!response.ok) {
    let errorBody: Partial<ApiErrorResponse>
    try {
      errorBody = (await response.json()) as Partial<ApiErrorResponse>
    } catch {
      // Response was not JSON — network error or proxy issue
      throw new ApiError(
        'NETWORK_ERROR',
        'Could not reach the server.',
        'Check your internet connection and try again.',
        response.status,
      )
    }

    throw new ApiError(
      errorBody.errorCode ?? 'UNKNOWN_ERROR',
      errorBody.userMessage ?? 'Something went wrong.',
      errorBody.suggestion ?? 'Please try again.',
      response.status,
    )
  }

  return response.json() as Promise<T>
}
