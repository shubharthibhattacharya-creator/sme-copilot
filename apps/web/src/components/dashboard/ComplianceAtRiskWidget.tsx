import Link from 'next/link'
import { Card, CardHeader } from '@/components/ui'

interface ChecklistRow {
  id: string
  label: string
  dueDate: string
  readinessScore: number
  missingItems: Array<{ documentType: string; label: string; required: number; received: number }>
  client: { id: string; name: string }
}

interface Props {
  atRisk: ChecklistRow[]
}

function ReadinessBadge({ score }: { score: number }) {
  const cls =
    score >= 80 ? 'text-green-700 bg-green-50' :
    score >= 50 ? 'text-amber-700 bg-amber-50' :
                  'text-red-700 bg-red-50'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {score}%
    </span>
  )
}

export function ComplianceAtRiskWidget({ atRisk }: Props) {
  if (atRisk.length === 0) {
    return (
      <Card padding="20px">
        <CardHeader title="Compliance at risk" subtitle="Clients with upcoming filings and low readiness" />
        <div className="flex items-center gap-2 text-green-600 text-sm py-2">
          <span className="text-lg">✓</span>
          All filings are on track.
        </div>
      </Card>
    )
  }

  return (
    <Card padding="20px">
      <CardHeader title="Compliance at risk" subtitle="Clients with upcoming filings and low readiness" />

      <div className="divide-y divide-slate-100">
        {atRisk.map((item) => {
          const days = Math.ceil((new Date(item.dueDate).getTime() - Date.now()) / 86400000)
          const dueCls = days <= 3 ? 'text-red-600 font-semibold' : days <= 7 ? 'text-amber-600' : 'text-gray-500'

          return (
            <div key={item.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.client.name}</p>
                <p className="text-xs text-gray-500 truncate">{item.label}</p>
              </div>
              <ReadinessBadge score={item.readinessScore} />
              <span className={`text-xs w-20 text-right ${dueCls}`}>
                {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
              </span>
              <span className="text-xs text-gray-400 w-16 text-right">
                {item.missingItems.length} missing
              </span>
              <Link
                href={`/clients/${item.client.id}`}
                className="text-xs text-blue-600 hover:underline shrink-0"
              >
                View
              </Link>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
