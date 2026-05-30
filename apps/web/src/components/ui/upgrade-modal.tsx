'use client'

import { useEffect, useState } from 'react'
import { closeUpgradeModal, type PlanLimitModalState } from '@/stores/plan-limit.store'

let _listeners: Array<(state: PlanLimitModalState) => void> = []
let _state: PlanLimitModalState = { isOpen: false, message: '', suggestion: '' }

/** Called by showUpgradeModal() to push state into the modal component. */
export function _notifyUpgradeModal(next: PlanLimitModalState) {
  _state = next
  _listeners.forEach((fn) => fn(next))
}

/**
 * Blocking modal shown when PLAN_LIMIT_EXCEEDED is returned.
 * Must be mounted once in the root layout so it can intercept any API error.
 *
 * The modal is triggered by calling showUpgradeModal() from useApiError().
 */
export function UpgradeModal() {
  const [state, setState] = useState<PlanLimitModalState>(_state)

  useEffect(() => {
    const listener = (next: PlanLimitModalState) => setState(next)
    _listeners.push(listener)
    return () => {
      _listeners = _listeners.filter((l) => l !== listener)
    }
  }, [])

  if (!state.isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-limit-heading"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-6 space-y-4">
        {/* Icon */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2
            id="plan-limit-heading"
            className="text-base font-semibold text-slate-900"
          >
            Plan limit reached
          </h2>
        </div>

        {/* Body */}
        <p className="text-sm text-slate-700">{state.message}</p>
        {state.suggestion && (
          <p className="text-sm text-slate-500">{state.suggestion}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <a
            href="/billing"
            className="flex-1 text-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upgrade plan
          </a>
          <button
            onClick={closeUpgradeModal}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
