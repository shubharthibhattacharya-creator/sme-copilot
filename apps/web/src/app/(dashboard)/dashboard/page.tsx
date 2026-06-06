import { Suspense } from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { IndianRupee, AlertCircle, FileText, Clock } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/kpi-card'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { InsightFeed } from '@/components/dashboard/InsightFeed'
import { CriticalCustomersTable } from '@/components/dashboard/CriticalCustomersTable'
import { LowStockWidget } from '@/components/dashboard/LowStockWidget'
import { ComplianceAtRiskWidget } from '@/components/dashboard/ComplianceAtRiskWidget'
import { MyWorkWidget } from '@/components/dashboard/MyWorkWidget'
import type { DashboardSummary, KpiMetric, ModuleKey } from '@opsc/types'

// Compact INR formatter: ₹37.6L, ₹45K, ₹8,500
function formatINR(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 10_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

const EMPTY_KPI: KpiMetric = {
  current: 0,
  previous: 0,
  trendPct: 0,
  trendDir: 'flat',
  sparkline: [0, 0, 0, 0, 0, 0],
}

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

interface WorkItem {
  id: string
  type: 'DOCUMENT' | 'INVOICE' | 'COMPLIANCE'
  module: string
  clientName: string
  title: string
  urgency: 'TODAY' | 'THIS_WEEK' | 'NONE'
}

async function DashboardContent() {
  interface ComplianceSummary {
    atRisk: Array<{
      id: string
      label: string
      dueDate: string
      readinessScore: number
      missingItems: Array<{
        documentType: string
        label: string
        required: number
        received: number
      }>
      client: { id: string; name: string }
    }>
  }

  const [summary, insights, profile, complianceSummary, myWorkItems] = await Promise.all([
    apiClient<DashboardSummary>('/api/v1/dashboard/summary').catch(
      (): DashboardSummary => ({
        totalReceivables: { ...EMPTY_KPI },
        overdueAmount: { ...EMPTY_KPI },
        overdueCount: { ...EMPTY_KPI },
        avgDaysOverdue: { ...EMPTY_KPI },
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
    apiClient<ComplianceSummary>('/api/v1/compliance/dashboard-summary').catch(
      (): ComplianceSummary => ({ atRisk: [] }),
    ),
    apiClient<WorkItem[]>('/api/v1/my-work').catch((): WorkItem[] => []),
  ])

  const modules = new Set<string>(profile.modulesEnabled ?? [])
  const has = (m: ModuleKey) => modules.size === 0 || modules.has(m)

  const collectionsEnabled = has('collections')
  const inventoryEnabled = has('inventory')
  const assistantEnabled = has('assistant')
  const hasRightPanel = collectionsEnabled || assistantEnabled

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      {collectionsEnabled && (
        <div
          className="kpi-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}
        >
          <KpiCard
            label="Total Receivables"
            value={formatINR(summary.totalReceivables.current)}
            icon={<IndianRupee size={20} strokeWidth={2} />}
            iconColor="#2563EB"
            iconBg="#EFF6FF"
            trendPct={summary.totalReceivables.trendPct}
            trendDir={summary.totalReceivables.trendDir}
            trendLabel="vs last month"
            trendInverse={true}
            sparkline={summary.totalReceivables.sparkline}
          />
          <KpiCard
            label="Overdue Amount"
            value={formatINR(summary.overdueAmount.current)}
            icon={<AlertCircle size={20} strokeWidth={2} />}
            iconColor="#DC2626"
            iconBg="#FEF2F2"
            trendPct={summary.overdueAmount.trendPct}
            trendDir={summary.overdueAmount.trendDir}
            trendLabel="vs last month"
            trendInverse={true}
            sparkline={summary.overdueAmount.sparkline}
          />
          <KpiCard
            label="Overdue Invoices"
            value={String(summary.overdueCount.current)}
            icon={<FileText size={20} strokeWidth={2} />}
            iconColor="#D97706"
            iconBg="#FFFBEB"
            trendPct={summary.overdueCount.trendPct}
            trendDir={summary.overdueCount.trendDir}
            trendLabel="vs last month"
            trendInverse={true}
            sparkline={summary.overdueCount.sparkline}
          />
          <KpiCard
            label="Avg Days Overdue"
            value={`${summary.avgDaysOverdue.current} days`}
            icon={<Clock size={20} strokeWidth={2} />}
            iconColor="#7C3AED"
            iconBg="#F5F3FF"
            trendPct={summary.avgDaysOverdue.trendPct}
            trendDir={summary.avgDaysOverdue.trendDir}
            trendLabel="vs last month"
            trendInverse={true}
            sparkline={summary.avgDaysOverdue.sparkline}
          />
        </div>
      )}

      {/* Inventory metric card */}
      {inventoryEnabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Inventory Alerts"
            value={summary.inventoryAlerts}
            subtext="Items at/below reorder level"
            trendDirection={summary.inventoryAlerts > 0 ? 'down' : 'neutral'}
          />
        </div>
      )}

      {/* Compliance at risk */}
      <ComplianceAtRiskWidget atRisk={complianceSummary.atRisk} />

      {/* My Work + AI Insights + Critical Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[360px]">
        <MyWorkWidget items={myWorkItems} />
        {assistantEnabled && <InsightFeed insights={insights} />}
        {collectionsEnabled && <CriticalCustomersTable customers={summary.criticalCustomers} />}
      </div>

      {/* Low Stock */}
      {inventoryEnabled && <LowStockWidget items={summary.lowStockItems} />}

      {!collectionsEnabled && !inventoryEnabled && !assistantEnabled && (
        <div className="text-center py-16 text-slate-400 text-sm">
          No dashboard widgets are configured for your plan.
        </div>
      )}
    </div>
  )
}

export default async function DashboardPage() {
  const user = await currentUser()
  const firstName = user?.firstName ?? null

  return (
    <div>
      <DashboardHeader firstName={firstName} />

      <Suspense
        fallback={
          <div className="space-y-6">
            <div
              className="kpi-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}
            >
              {[0, 1, 2, 3].map((i) => (
                <KpiCardSkeleton key={i} />
              ))}
            </div>
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  )
}
