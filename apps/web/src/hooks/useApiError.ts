'use client'

import { useRouter } from 'next/navigation'
import { ApiError } from '@/lib/api-error'
import { toast } from '@/components/ui/toast'
import { showUpgradeModal } from '@/stores/plan-limit.store'

/**
 * Central error handler for API calls.
 *
 * Usage in any component or page:
 *   const { handleError } = useApiError()
 *   try { ... } catch (err) { handleError(err) }
 *
 * Routing:
 *   - PLAN_LIMIT_EXCEEDED  → opens blocking upgrade modal
 *   - 401                  → redirects to /sign-in
 *   - 5xx                  → error toast with "Contact support" action
 *   - 4xx / other ApiError → error toast with userMessage + suggestion
 *   - non-ApiError         → console.error + generic toast
 */
export function useApiError() {
  const router = useRouter()

  function handleError(err: unknown) {
    if (!(err instanceof ApiError)) {
      console.error('Unexpected error:', err)
      toast.error('Something went wrong.', {
        description: 'Please try again or contact support.',
      })
      return
    }

    // Plan limit — show upgrade modal instead of toast
    if (err.isPlanLimitError) {
      showUpgradeModal({
        message: err.userMessage,
        suggestion: err.suggestion,
      })
      return
    }

    // Session expired — redirect to sign-in
    if (err.isAuthError) {
      toast.error('Session expired. Please sign in again.')
      router.push('/sign-in')
      return
    }

    // Server errors — show toast with contact support action
    if (err.isServerError) {
      toast.error(err.userMessage, {
        description: err.suggestion,
        duration: 8000,
        action: {
          label: 'Contact support',
          onClick: () => window.open('mailto:support@opscopilot.in'),
        },
      })
      return
    }

    // Standard 4xx — show userMessage + suggestion
    toast.error(err.userMessage, {
      description: err.suggestion,
      duration: 6000,
    })
  }

  return { handleError }
}
