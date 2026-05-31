import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { FilingsClient } from '@/components/filings/FilingsClient'
import type { FilingRow, FilingSummary } from '@/components/filings/FilingsClient'
import type { HeatmapData } from '@/components/filings/FilingsHeatmap'

const EMPTY_HEATMAP: HeatmapData = {
  monthlySlots: [],
  quarterlySlots: [],
  monthly: [],
  quarterly: [],
}

const EMPTY_SUMMARY: FilingSummary = {
  total: 0,
  filed: 0,
  pending: 0,
  overdue: 0,
  dueSoon: 0,
  atRisk: 0,
  lateFeeExposure: 0,
  lateFeePerDay: 50,
}

export default async function FilingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [rows, summary, heatmap] = await Promise.all([
    apiClient<FilingRow[]>('/api/v1/filings/calendar', { cache: 'no-store' }).catch(
      (): FilingRow[] => [],
    ),
    apiClient<FilingSummary>('/api/v1/filings/summary', { cache: 'no-store' }).catch(
      () => EMPTY_SUMMARY,
    ),
    apiClient<HeatmapData>('/api/v1/filings/heatmap', { cache: 'no-store' }).catch(
      () => EMPTY_HEATMAP,
    ),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">GST Filing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track filing status, request documents, and manage deadlines across all clients.
        </p>
      </div>
      <FilingsClient initialRows={rows} initialSummary={summary} initialHeatmap={heatmap} />
    </div>
  )
}
