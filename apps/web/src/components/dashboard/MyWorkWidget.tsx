'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader } from '@/components/ui'
import { CheckSquare, FileText, IndianRupee, ChevronRight, ArrowRight } from 'lucide-react'

interface WorkItem {
  id: string
  type: 'DOCUMENT' | 'INVOICE' | 'COMPLIANCE'
  module: string
  clientName: string
  title: string
  urgency: 'TODAY' | 'THIS_WEEK' | 'NONE'
}

interface Props {
  items: WorkItem[]
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  DOCUMENT:   <FileText size={13} strokeWidth={2} />,
  INVOICE:    <IndianRupee size={13} strokeWidth={2} />,
  COMPLIANCE: <CheckSquare size={13} strokeWidth={2} />,
}

const TYPE_COLOR: Record<string, string> = {
  DOCUMENT:   '#7C3AED',
  INVOICE:    '#DC2626',
  COMPLIANCE: '#0891B2',
}

const URGENCY_DOT: Record<string, string> = {
  TODAY:     '#DC2626',
  THIS_WEEK: '#D97706',
  NONE:      '#CBD5E1',
}

export function MyWorkWidget({ items }: Props) {
  const router = useRouter()
  const preview = items.slice(0, 6)
  const todayCount = items.filter((i) => i.urgency === 'TODAY').length

  return (
    <Card padding="20px" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardHeader
        title="My Work"
        action={
          <button
            onClick={() => router.push('/my-work')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563EB', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View all <ArrowRight size={12} />
          </button>
        }
      />

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <CheckSquare size={24} color="#CBD5E1" style={{ marginBottom: 8 }} />
          <p className="text-sm text-slate-500">All caught up</p>
        </div>
      ) : (
        <>
          {/* Summary counts */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {todayCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#FEF2F2', color: '#DC2626' }}>
                {todayCount} due today
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F1F5F9', color: '#64748B' }}>
              {items.length} total
            </span>
          </div>

          {/* Item list */}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="space-y-1 flex-1 overflow-hidden">
            {preview.map((item) => (
              <li
                key={item.id}
                onClick={() => router.push('/my-work')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLLIElement).style.background = '#F8FAFC')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLLIElement).style.background = 'transparent')}
              >
                {/* Urgency dot */}
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: URGENCY_DOT[item.urgency], flexShrink: 0 }} />

                {/* Type icon */}
                <div style={{ color: TYPE_COLOR[item.type] ?? '#64748B', flexShrink: 0 }}>
                  {TYPE_ICON[item.type]}
                </div>

                {/* Title */}
                <p style={{ fontSize: 12, color: '#334155', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </p>

                <ChevronRight size={12} color="#CBD5E1" style={{ flexShrink: 0 }} />
              </li>
            ))}
          </ul>

          {items.length > 6 && (
            <button
              onClick={() => router.push('/my-work')}
              style={{ marginTop: 10, fontSize: 12, color: '#2563EB', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              +{items.length - 6} more items
            </button>
          )}
        </>
      )}
    </Card>
  )
}
