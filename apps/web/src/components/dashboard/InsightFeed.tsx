'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useApiClient } from '@/lib/client-api'

interface Insight {
  id: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  category: string
  summary: string
  createdAt: string
}

interface InsightFeedProps {
  insights: Insight[]
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-l-red-500 bg-red-50',
  WARNING: 'border-l-amber-400 bg-amber-50',
  INFO: 'border-l-blue-400 bg-blue-50',
}

const BADGE_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  WARNING: 'bg-amber-100 text-amber-700',
  INFO: 'bg-blue-100 text-blue-700',
}

export function InsightFeed({ insights: initial }: InsightFeedProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { request } = useApiClient()
  const router = useRouter()

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    try {
      await request('/dashboard/insights/refresh', { method: 'POST' })
      // Wait briefly then revalidate the server component
      setTimeout(() => {
        router.refresh()
        setLoading(false)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">AI Insights</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}

      {loading && (
        <p className="text-xs text-slate-400 mb-3">
          Claude is analysing your data — this takes ~15s…
        </p>
      )}

      {initial.length === 0 && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <p className="text-sm text-slate-500">No insights yet</p>
          <p className="text-xs text-slate-400 mt-1">Click Refresh to generate AI insights</p>
        </div>
      ) : (
        <ul className="space-y-3 overflow-y-auto flex-1">
          {initial.map((insight) => (
            <li
              key={insight.id}
              className={cn(
                'border-l-4 rounded-r-lg px-4 py-3',
                SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES['INFO'],
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                    BADGE_STYLES[insight.severity] ?? BADGE_STYLES['INFO'],
                  )}
                >
                  {insight.severity}
                </span>
                {/* suppressHydrationWarning: Date.now() differs between server and client render */}
                <span className="text-[10px] text-slate-400" suppressHydrationWarning>
                  {relativeTime(insight.createdAt)}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-snug">{insight.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
