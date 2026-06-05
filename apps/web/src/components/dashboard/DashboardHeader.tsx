'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, ChevronDown } from 'lucide-react'

interface DashboardHeaderProps {
  firstName?: string | null
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getCurrentMonthRange(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(now)}`
}

export function DashboardHeader({ firstName }: DashboardHeaderProps) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1500)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}
    >
      {/* Left: greeting */}
      <div>
        <h1
          suppressHydrationWarning
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#0F172A',
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: '-0.5px',
          }}
        >
          {getGreeting()}{firstName ? `, ${firstName}` : ''}! 👋
        </h1>
        <p style={{ fontSize: 14, color: '#64748B', marginTop: 6, margin: '6px 0 0' }}>
          Here&apos;s what&apos;s happening in your operations today.
        </p>
      </div>

      {/* Right: date range + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Date range pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '7px 14px',
            fontSize: 13,
            color: '#475569',
            background: '#FFFFFF',
            fontWeight: 500,
            userSelect: 'none',
          }}
          suppressHydrationWarning
        >
          {getCurrentMonthRange()}
          <ChevronDown size={13} color="#94A3B8" />
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '7px 14px',
            fontSize: 13,
            color: '#475569',
            background: '#FFFFFF',
            fontWeight: 500,
            cursor: refreshing ? 'default' : 'pointer',
            opacity: refreshing ? 0.7 : 1,
            transition: 'background 150ms',
          }}
        >
          <RefreshCw
            size={13}
            className={refreshing ? 'spin' : ''}
            color="#4F46E5"
          />
          Refresh
        </button>
      </div>
    </div>
  )
}
