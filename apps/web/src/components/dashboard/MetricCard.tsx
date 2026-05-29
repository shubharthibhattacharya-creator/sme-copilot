import { cn, formatCurrency } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: number | string
  subtext?: string
  trend?: number
  trendDirection?: 'up' | 'down' | 'neutral'
  currency?: boolean
}

export function MetricCard({
  label,
  value,
  subtext,
  trend,
  trendDirection = 'neutral',
  currency = false,
}: MetricCardProps) {
  const displayValue =
    currency && typeof value === 'number' ? formatCurrency(value) : String(value)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-slate-900 tabular-nums">{displayValue}</p>

      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
              trendDirection === 'up' && 'bg-green-100 text-green-700',
              trendDirection === 'down' && 'bg-red-100 text-red-700',
              trendDirection === 'neutral' && 'bg-slate-100 text-slate-600',
            )}
          >
            {trendDirection === 'up' ? '▲' : trendDirection === 'down' ? '▼' : '●'}{' '}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
      </div>
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-2">
      <div className="h-4 w-28 bg-slate-200 animate-pulse rounded" />
      <div className="h-9 w-40 bg-slate-200 animate-pulse rounded" />
      <div className="h-3 w-20 bg-slate-100 animate-pulse rounded" />
    </div>
  )
}
