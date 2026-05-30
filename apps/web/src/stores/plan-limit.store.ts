'use client'

import { useState, useCallback } from 'react'

export interface PlanLimitModalState {
  isOpen: boolean
  message: string
  suggestion: string
}

/**
 * Simple in-module singleton state for the plan-limit upgrade modal.
 * No external dependency required — uses React state lifted to a hook.
 */
let _listeners: Array<(state: PlanLimitModalState) => void> = []
let _state: PlanLimitModalState = { isOpen: false, message: '', suggestion: '' }

function setState(next: PlanLimitModalState) {
  _state = next
  _listeners.forEach((fn) => fn(next))
}

export function showUpgradeModal(opts: { message: string; suggestion: string }) {
  setState({ isOpen: true, message: opts.message, suggestion: opts.suggestion })
}

export function closeUpgradeModal() {
  setState({ isOpen: false, message: '', suggestion: '' })
}

/** Hook to subscribe to the plan-limit modal state. */
export function usePlanLimitStore() {
  const [state, setLocalState] = useState<PlanLimitModalState>(_state)

  const subscribe = useCallback(() => {
    const listener = (next: PlanLimitModalState) => setLocalState(next)
    _listeners.push(listener)
    return () => {
      _listeners = _listeners.filter((l) => l !== listener)
    }
  }, [])

  // Subscribe on first render — return cleanup for StrictMode double-invoke safety
  // We can't use useEffect here without making this a hook, so we keep it simple:
  // callers must call subscribe() if they want live updates (UpgradeModal does this).

  return {
    state,
    subscribe,
    showUpgradeModal,
    closeUpgradeModal,
  }
}
