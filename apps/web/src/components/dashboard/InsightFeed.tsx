'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'
import { Card, CardHeader, Button } from '@/components/ui'

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

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 }

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

const PREVIEW_COUNT = 5

export function InsightFeed({ insights: initial }: InsightFeedProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const { request } = useApiClient()
  const router = useRouter()

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    try {
      await request('/dashboard/insights/refresh', { method: 'POST' })
      setTimeout(() => {
        router.refresh()
        setLoading(false)
      }, 3000)
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Refresh failed')
      setLoading(false)
    }
  }

  // Sort: CRITICAL first, then WARNING, then INFO
  const sorted = [...initial].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2),
  )

  const displayed = showAll ? sorted : sorted.slice(0, PREVIEW_COUNT)
  const hasMore = sorted.length > PREVIEW_COUNT

  // Summary counts
  const criticalCount = sorted.filter((i) => i.severity === 'CRITICAL').length
  const warningCount = sorted.filter((i) => i.severity === 'WARNING').length
  const infoCount = sorted.filter((i) => i.severity === 'INFO').length

  return (
    <Card padding="24px" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardHeader
        title="AI Insights"
        action={
          <Button variant="primary" size="sm" onClick={handleRefresh} disabled={loading} loading={loading}>
            {loading ? 'Generating…' : 'Refresh'}
          </Button>
        }
      />

      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}

      {loading && (
        <p className="text-xs text-slate-400 mb-3">
          Claude is analysing your data — this takes ~15s…
        </p>
      )}

      {sorted.length === 0 && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <p className="text-sm text-slate-500">No insights yet</p>
          <p className="text-xs text-slate-400 mt-1">Click Refresh to generate AI insights</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3 overflow-y-auto flex-1">
            {displayed.map((insight) => (
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
                  <span className="text-[10px] text-slate-400" suppressHydrationWarning>
                    {relativeTime(insight.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-snug">{insight.summary}</p>
              </li>
            ))}
          </ul>

          {/* View all / collapse toggle */}
          {hasMore && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium self-start"
            >
              {showAll ? 'Show less' : `View all ${sorted.length} insights`}
            </button>
          )}

          {/* Summary counts */}
          {sorted.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap text-xs text-slate-500">
              <span className="font-medium text-slate-700">{sorted.length} total</span>
              {criticalCount > 0 && (
                <span className="text-red-600 font-medium">{criticalCount} critical</span>
              )}
              {warningCount > 0 && (
                <span className="text-amber-600 font-medium">{warningCount} warnings</span>
              )}
              {infoCount > 0 && (
                <span className="text-blue-600">{infoCount} info</span>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
