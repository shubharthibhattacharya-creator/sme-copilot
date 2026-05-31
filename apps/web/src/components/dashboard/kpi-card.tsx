import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MiniSparklineProps {
  data: number[]
  color: string
  label: string
  width?: number
  height?: number
}

function MiniSparkline({ data, color, label, width = 64, height = 32 }: MiniSparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pad = 3
  const h = height - pad * 2
  const step = width / (data.length - 1)

  const points = data.map((v, i) => ({
    x: i * step,
    y: pad + h - ((v - min) / range) * h,
  }))

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const fillD =
    d + ` L ${((data.length - 1) * step).toFixed(1)} ${height} L 0 ${height} Z`

  // Unique gradient ID using label to avoid SVG ID collisions across cards
  const gradientId = `sparkfill-${label.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradientId})`} />
      <path
        d={d}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx={(data.length - 1) * step}
        cy={points[points.length - 1]!.y}
        r="2.5"
        fill={color}
      />
    </svg>
  )
}

interface KpiCardProps {
  label: string
  value: string
  icon: React.ReactNode
  iconColor?: string
  iconBg?: string
  trendPct: number
  trendDir: 'up' | 'down' | 'flat'
  trendLabel: string
  trendInverse?: boolean
  sparkline: number[]
  sparklineColor?: string
}

export function KpiCard({
  label,
  value,
  icon,
  iconColor = 'var(--color-primary)',
  iconBg = 'var(--color-primary-light)',
  trendPct,
  trendDir,
  trendLabel,
  trendInverse = false,
  sparkline,
  sparklineColor,
}: KpiCardProps) {
  const isPositive = trendInverse ? trendDir === 'down' : trendDir === 'up'

  const trendColor =
    trendDir === 'flat'
      ? 'var(--color-text-tertiary)'
      : isPositive
        ? 'var(--color-success)'
        : 'var(--color-error)'

  const lineColor =
    sparklineColor ||
    (trendDir === 'flat'
      ? '#94A3B8'
      : isPositive
        ? '#10B981'
        : '#EF4444')

  const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : Minus

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        minWidth: '0',
      }}
    >
      {/* Row 1: icon + label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: iconColor,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </span>
      </div>

      {/* Row 2: value + sparkline */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: '10px',
          gap: '12px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            lineHeight: '1',
            letterSpacing: '-0.5px',
          }}
        >
          {value}
        </span>
        <MiniSparkline data={sparkline} color={lineColor} label={label} />
      </div>

      {/* Row 3: trend indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {trendDir !== 'flat' && (
          <TrendIcon size={13} color={trendColor} strokeWidth={2.5} />
        )}
        <span
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: '12px',
            fontWeight: 500,
            color: trendColor,
          }}
        >
          {trendDir === 'flat' ? 'No change' : `${trendPct}%`}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {trendLabel}
        </span>
      </div>
    </div>
  )
}

export function KpiCardSkeleton() {
  return (
    <div
      className="skeleton"
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            background: '#F1F5F9',
          }}
        />
        <div style={{ width: 80, height: 12, borderRadius: 4, background: '#F1F5F9' }} />
      </div>
      <div style={{ width: 120, height: 26, borderRadius: 4, background: '#F1F5F9' }} />
      <div style={{ width: 100, height: 12, borderRadius: 4, background: '#F1F5F9' }} />
    </div>
  )
}
