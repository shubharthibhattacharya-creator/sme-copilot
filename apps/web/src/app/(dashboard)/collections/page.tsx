import { Suspense } from 'react'
import { apiClient } from '@/lib/api-client'
import { AgingChart } from '@/components/collections/AgingChart'
import { CollectionsClient } from '@/components/collections/CollectionsClient'
import type { AgingBreakdown, InvoiceWithRisk } from '@opsc/types'

interface SearchParams {
  status?: string
  riskLevel?: string
  sortBy?: string
  sortOrder?: string
  page?: string
}

interface CollectionsResponse {
  data: InvoiceWithRisk[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

async function CollectionsContent({ params }: { params: SearchParams }) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.riskLevel) query.set('riskLevel', params.riskLevel)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  if (params.page) query.set('page', params.page)

  const [aging, collections] = await Promise.all([
    apiClient<AgingBreakdown>(`/api/v1/collections/aging`).catch(
      (): AgingBreakdown => ({
        buckets: [],
        totalOverdue: 0,
        totalCount: 0,
      }),
    ),
    apiClient<CollectionsResponse>(
      `/api/v1/collections?${query.toString()}`,
    ).catch(
      (): CollectionsResponse => ({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      }),
    ),
  ])

  return (
    <div className="space-y-5">
      <AgingChart data={aging} />
      <CollectionsClient
        initialInvoices={collections.data}
        initialMeta={collections.meta}
        initialPage={Number(params.page ?? 1)}
      />
    </div>
  )
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Collections</h1>
        <p className="text-xs text-slate-400">{new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-5">
            <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
            <div className="h-8 bg-white rounded-xl border border-slate-200 animate-pulse" />
            <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
          </div>
        }
      >
        <CollectionsContent params={params} />
      </Suspense>
    </div>
  )
}
