'use client'

import { useEffect, useState, useCallback } from 'react'

export type ToastVariant = 'error' | 'success' | 'warning' | 'info'

export interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

// ── Module-level singleton ────────────────────────────────────────────────────

type ToastListener = (toasts: ToastItem[]) => void
let _toasts: ToastItem[] = []
const _listeners: Set<ToastListener> = new Set()

function notify() {
  _listeners.forEach((fn) => fn([..._toasts]))
}

function addToast(item: Omit<ToastItem, 'id'>): string {
  const id = Math.random().toString(36).slice(2)
  _toasts = [..._toasts, { ...item, id }]
  notify()
  const duration = item.duration ?? 5000
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }
  return id
}

function removeToast(id: string) {
  _toasts = _toasts.filter((t) => t.id !== id)
  notify()
}

// ── Public API ────────────────────────────────────────────────────────────────

export const toast = {
  error(title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) {
    return addToast({ variant: 'error', title, ...opts })
  },
  success(title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) {
    return addToast({ variant: 'success', title, ...opts })
  },
  warning(title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) {
    return addToast({ variant: 'warning', title, ...opts })
  },
  info(title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) {
    return addToast({ variant: 'info', title, ...opts })
  },
  dismiss(id: string) {
    removeToast(id)
  },
}

// ── Toaster component — mount once in root layout ─────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, string> = {
  error:   'bg-red-50 border-red-200 text-red-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
}

const ICON: Record<ToastVariant, string> = {
  error:   '✕',
  success: '✓',
  warning: '⚠',
  info:    'ℹ',
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener: ToastListener = (next) => setToasts(next)
    _listeners.add(listener)
    return () => { _listeners.delete(listener) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex gap-3 items-start rounded-lg border p-3 shadow-md text-sm animate-in slide-in-from-right-4 ${VARIANT_STYLES[t.variant]}`}
        >
          <span className="font-bold text-base leading-none mt-0.5 select-none">{ICON[t.variant]}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium leading-snug">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 opacity-80 text-xs leading-snug">{t.description}</p>
            )}
            {t.action && (
              <button
                onClick={t.action.onClick}
                className="mt-1.5 text-xs font-medium underline underline-offset-2 hover:no-underline"
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss"
            className="flex-shrink-0 opacity-60 hover:opacity-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
