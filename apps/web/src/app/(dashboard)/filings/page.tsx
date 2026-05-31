import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { FilingsClient } from '@/components/filings/FilingsClient'
import type { HeatmapData } from '@/components/filings/FilingsHeatmap'

interface FilingRow {
  client: {
    id: string
    name: string
    gstin: string | null
    filerType: string
    gstDeadlineDay: number | null
    email: string | null
    phone: string | null
  }
  period: string
  deadline: string
  daysRemaining: number
  status: 'FILED' | 'PENDING' | 'OVERDUE'
  document: { id: string; originalName: string; filingPeriod: string | null } | null
  checklistId: string | null
}

interface FilingSummary {
  total: number
  filed: number
  pending: number
  overdue: number
  dueSoon: number
}

const EMPTY_HEATMAP: HeatmapData = {
  monthlySlots: [],
  quarterlySlots: [],
  monthly: [],
  quarterly: [],
}

export default async function FilingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [rows, summary, heatmap] = await Promise.all([
    apiClient<FilingRow[]>('/api/v1/filings/calendar', { cache: 'no-store' }).catch((): FilingRow[] => []),
    apiClient<FilingSummary>('/api/v1/filings/summary', { cache: 'no-store' }).catch(
      (): FilingSummary => ({ total: 0, filed: 0, pending: 0, overdue: 0, dueSoon: 0 }),
    ),
    apiClient<HeatmapData>('/api/v1/filings/heatmap', { cache: 'no-store' }).catch(
      (): HeatmapData => EMPTY_HEATMAP,
    ),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">GST Filing Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">Track filing deadlines across all clients</p>
      </div>
      <FilingsClient initialRows={rows} initialSummary={summary} initialHeatmap={heatmap} />
    </div>
  )
}
