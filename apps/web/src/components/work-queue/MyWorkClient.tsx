'use client'

import { useRouter } from 'next/navigation'
import { FileText, IndianRupee, CheckSquare, ChevronRight } from 'lucide-react'

interface WorkItem {
  id: string
  type: 'DOCUMENT' | 'INVOICE' | 'COMPLIANCE'
  module: string
  clientId: string
  clientName: string
  title: string
  dueDate: string | null
  urgency: 'TODAY' | 'THIS_WEEK' | 'NONE'
  meta: Record<string, unknown>
}

interface Props {
  items: WorkItem[]
}

const TYPE_ICON: Record<WorkItem['type'], React.ReactNode> = {
  DOCUMENT:   <FileText size={15} strokeWidth={2} />,
  INVOICE:    <IndianRupee size={15} strokeWidth={2} />,
  COMPLIANCE: <CheckSquare size={15} strokeWidth={2} />,
}

const TYPE_COLOR: Record<WorkItem['type'], string> = {
  DOCUMENT:   '#7C3AED',
  INVOICE:    '#DC2626',
  COMPLIANCE: '#0891B2',
}

const TYPE_BG: Record<WorkItem['type'], string> = {
  DOCUMENT:   '#F5F3FF',
  INVOICE:    '#FEF2F2',
  COMPLIANCE: '#ECFEFF',
}

const MODULE_ROUTE: Record<WorkItem['type'], string> = {
  DOCUMENT:   '/documents',
  INVOICE:    '/collections',
  COMPLIANCE: '/filings',
}

const URGENCY_BADGE: Record<WorkItem['urgency'], { label: string; classes: string }> = {
  TODAY:     { label: 'Due today', classes: 'bg-red-100 text-red-700' },
  THIS_WEEK: { label: 'This week', classes: 'bg-amber-100 text-amber-700' },
  NONE:      { label: '',          classes: '' },
}

function formatDue(dueDate: string | null): string {
  if (!dueDate) return ''
  const d = new Date(dueDate)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function groupItems(items: WorkItem[]): { today: WorkItem[]; week: WorkItem[]; none: WorkItem[] } {
  return {
    today: items.filter((i) => i.urgency === 'TODAY'),
    week:  items.filter((i) => i.urgency === 'THIS_WEEK'),
    none:  items.filter((i) => i.urgency === 'NONE'),
  }
}

function WorkItemRow({ item, onClick }: { item: WorkItem; onClick: () => void }) {
  const badge = URGENCY_BADGE[item.urgency]
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: '#fff',
        border: 'none',
        borderBottom: '1px solid #F1F5F9',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: TYPE_BG[item.type],
          color: TYPE_COLOR[item.type],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {TYPE_ICON[item.type]}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.title}
        </p>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{item.module}</span>
          {item.dueDate && (
            <>
              <span>·</span>
              <span>{formatDue(item.dueDate)}</span>
            </>
          )}
        </p>
      </div>

      {/* Badge */}
      {badge.label && (
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }} className={badge.classes}>
          {badge.label}
        </span>
      )}

      <ChevronRight size={14} color="#CBD5E1" style={{ flexShrink: 0 }} />
    </button>
  )
}

function Section({ title, items, router }: { title: string; items: WorkItem[]; router: ReturnType<typeof useRouter> }) {
  if (items.length === 0) return null
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 16px', marginBottom: 4 }}>
        {title} ({items.length})
      </p>
      <div style={{ borderRadius: 12, border: '1px solid #E8EAF0', overflow: 'hidden' }}>
        {items.map((item) => (
          <WorkItemRow
            key={item.id}
            item={item}
            onClick={() => router.push(MODULE_ROUTE[item.type])}
          />
        ))}
      </div>
    </div>
  )
}

export function MyWorkClient({ items }: Props) {
  const router = useRouter()
  const groups = groupItems(items)

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>My Work</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }} suppressHydrationWarning>
            {dateStr}
          </p>
        </div>
        <div style={{ fontSize: 13, color: '#64748B', background: '#F1F5F9', padding: '6px 14px', borderRadius: 20 }}>
          {items.length} open item{items.length !== 1 ? 's' : ''}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E8EAF0',
            borderRadius: 16,
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <CheckSquare size={32} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>All caught up</p>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>No pending work items right now.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="Due today" items={groups.today} router={router} />
          <Section title="Due this week" items={groups.week} router={router} />
          <Section title="No deadline" items={groups.none} router={router} />
        </div>
      )}
    </div>
  )
}
