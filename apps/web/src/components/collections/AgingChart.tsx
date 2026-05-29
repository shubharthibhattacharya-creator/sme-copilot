'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { AgingBreakdown } from '@opsc/types'

interface AgingChartProps {
  data: AgingBreakdown
}

const BUCKET_COLORS = ['#f59e0b', '#f97316', '#f87171', '#dc2626']

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { label: string; count: number; totalAmount: number; percentOfOverdue: number } }>
}) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-800 mb-1">{d.label}</p>
      <p className="text-slate-600">
        {d.count} invoice{d.count !== 1 ? 's' : ''}
      </p>
      <p className="text-slate-600">{formatCurrency(d.totalAmount)}</p>
      <p className="text-slate-400 text-xs">{d.percentOfOverdue}% of total overdue</p>
    </div>
  )
}

export function AgingChart({ data }: AgingChartProps) {
  const chartData = data.buckets.map((b, i) => ({
    label: b.label,
    count: b.count,
    totalAmount: b.totalAmount,
    percentOfOverdue: b.percentOfOverdue,
    colorIndex: i,
  }))

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Aging Breakdown</h2>
        <div className="text-right">
          <p className="text-xs text-slate-500">Total overdue</p>
          <p className="text-sm font-bold text-red-600">
            {formatCurrency(data.totalOverdue)}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 8, right: 40, top: 0, bottom: 0 }}
          barSize={22}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v: number) =>
              v >= 100000
                ? `₹${(v / 100000).toFixed(1)}L`
                : v >= 1000
                  ? `₹${(v / 1000).toFixed(0)}K`
                  : `₹${v}`
            }
          />
          <YAxis
            dataKey="label"
            type="category"
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={78}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="totalAmount" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={BUCKET_COLORS[entry.colorIndex] ?? BUCKET_COLORS[3]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Bucket summary row */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100">
        {data.buckets.map((b, i) => (
          <div key={b.label} className="text-center">
            <p
              className="text-lg font-bold tabular-nums"
              style={{ color: BUCKET_COLORS[i] ?? '#dc2626' }}
            >
              {b.count}
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">{b.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
