import { Suspense } from 'react'
import { apiClient } from '@/lib/api-client'
import { MetricCard, MetricCardSkeleton } from '@/components/dashboard/MetricCard'
import { InsightFeed } from '@/components/dashboard/InsightFeed'
import { CriticalCustomersTable } from '@/components/dashboard/CriticalCustomersTable'
import { LowStockWidget } from '@/components/dashboard/LowStockWidget'
import type { DashboardSummary, ModuleKey } from '@opsc/types'

interface Insight {
  id: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  category: string
  summary: string
  createdAt: string
}

interface FirmProfile {
  industry?: string | null
  modulesEnabled?: string[]
}

async function DashboardContent() {
  const [summary, insights, profile] = await Promise.all([
    apiClient<DashboardSummary>('/api/v1/dashboard/summary').catch(
      (): DashboardSummary => ({
        totalReceivables: 0,
        overdueAmount: 0,
        overdueCount: 0,
        avgAgingDays: 0,
        collectionsTrend: 0,
        criticalCustomers: [],
        inventoryAlerts: 0,
        lowStockItems: [],
        generatedAt: new Date().toISOString(),
        pendingDocuments: 0,
        documentsNeedingReview: 0,
      }),
    ),
    apiClient<Insight[]>('/api/v1/dashboard/insights').catch((): Insight[] => []),
    apiClient<FirmProfile>('/api/v1/settings/profile').catch((): FirmProfile => ({})),
  ])

  const modules = new Set<string>(profile.modulesEnabled ?? [])
  const has = (m: ModuleKey) => modules.size === 0 || modules.has(m)

  const collectionsEnabled = has('collections')
  const inventoryEnabled = has('inventory')
  const whatsappEnabled = has('whatsapp')
  const assistantEnabled = has('assistant')

  const trendDir =
    summary.collectionsTrend > 0
      ? 'up'
      : summary.collectionsTrend < 0
        ? 'down'
        : 'neutral'

  // Build metric cards based on enabled modules
  const metricCards = [
    collectionsEnabled && (
      <MetricCard
        key="receivables"
        label="Total Receivables"
        value={summary.totalReceivables}
        currency
        subtext="Pending + Overdue"
      />
    ),
    collectionsEnabled && (
      <MetricCard
        key="overdue-amt"
        label="Overdue Amount"
        value={summary.overdueAmount}
        currency
        subtext={`${summary.overdueCount} invoices`}
        trend={Math.abs(summary.collectionsTrend)}
        trendDirection={trendDir}
      />
    ),
    collectionsEnabled && (
      <MetricCard
        key="overdue-inv"
        label="Overdue Invoices"
        value={summary.overdueCount}
        subtext={`Avg ${summary.avgAgingDays} days aging`}
        trendDirection={summary.overdueCount > 5 ? 'down' : 'neutral'}
      />
    ),
    inventoryEnabled && (
      <MetricCard
        key="inventory"
        label="Inventory Alerts"
        value={summary.inventoryAlerts}
        subtext="Items at/below reorder level"
        trendDirection={summary.inventoryAlerts > 0 ? 'down' : 'neutral'}
      />
    ),
  ].filter(Boolean)

  const hasRightPanel = collectionsEnabled || assistantEnabled

  return (
    <div className="space-y-6">
      {/* Metrics row — only show if at least one metric is enabled */}
      {metricCards.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(metricCards.length, 4)} gap-4`}>
          {metricCards}
        </div>
      )}

      {/* AI Insights + Critical Customers — hide if neither module is active */}
      {hasRightPanel && (
        <div className={`grid grid-cols-1 ${assistantEnabled && collectionsEnabled ? 'lg:grid-cols-2' : ''} gap-4 min-h-[360px]`}>
          {assistantEnabled && <InsightFeed insights={insights} />}
          {collectionsEnabled && (
            <CriticalCustomersTable
              customers={summary.criticalCustomers}
              whatsappEnabled={whatsappEnabled}
            />
          )}
        </div>
      )}

      {/* Low Stock — only if inventory module is active */}
      {inventoryEnabled && <LowStockWidget items={summary.lowStockItems} />}

      {/* Empty state if no modules produce visible widgets */}
      {metricCards.length === 0 && !hasRightPanel && !inventoryEnabled && (
        <div className="text-center py-16 text-slate-400 text-sm">
          No dashboard widgets are configured for your plan.
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-xs text-slate-400">Live data · refreshes on page load</p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => <MetricCardSkeleton key={i} />)}
            </div>
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  )
}
