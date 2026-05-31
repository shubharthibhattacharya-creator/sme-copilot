import { cn, formatCurrency } from '@/lib/utils'
import { Card, Label } from '@/components/ui'

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
    <Card padding="24px" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Label>{label}</Label>
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
    </Card>
  )
}

export function MetricCardSkeleton() {
  return (
    <Card padding="24px" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="h-4 w-28 bg-slate-200 animate-pulse rounded" />
      <div className="h-9 w-40 bg-slate-200 animate-pulse rounded" />
      <div className="h-3 w-20 bg-slate-100 animate-pulse rounded" />
    </Card>
  )
}
