'use client'

type CellStatus = 'FILED' | 'PENDING' | 'OVERDUE'

interface HeatmapCell {
  status: CellStatus
  documentId: string | null
}

interface HeatmapClientRow {
  id: string
  name: string
  gstin: string | null
  filerType: string
  cells: HeatmapCell[]
}

export interface HeatmapData {
  monthlySlots: string[]
  quarterlySlots: string[]
  monthly: HeatmapClientRow[]
  quarterly: HeatmapClientRow[]
}

const CELL_BG: Record<CellStatus, string> = {
  FILED:   'bg-green-500',
  PENDING: 'bg-amber-400',
  OVERDUE: 'bg-red-500',
}

const CELL_HOVER: Record<CellStatus, string> = {
  FILED:   'hover:bg-green-600',
  PENDING: 'hover:bg-amber-500',
  OVERDUE: 'hover:bg-red-600',
}

const CELL_LABEL: Record<CellStatus, string> = {
  FILED:   'Filed',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
}

function shortSlotLabel(slot: string): string {
  const parts = slot.split(' ')
  if (parts.length === 2 && !parts[0]!.includes('–')) {
    // Monthly: "Apr 2026" → "Apr\n'26"
    return `${parts[0]}\n'${parts[1]!.slice(2)}`
  }
  // Quarterly: "Jan–Mar 2026" → "Q1\n'26"
  const qMap: Record<string, string> = {
    'Jan–Mar': 'Q1', 'Apr–Jun': 'Q2', 'Jul–Sep': 'Q3', 'Oct–Dec': 'Q4',
  }
  const spaceIdx = slot.lastIndexOf(' ')
  const label = slot.slice(0, spaceIdx)
  const year  = slot.slice(spaceIdx + 1)
  return `${qMap[label] ?? label}\n'${year.slice(2)}`
}

function HeatmapGrid({
  slots,
  clients,
  title,
  emptyMsg,
}: {
  slots: string[]
  clients: HeatmapClientRow[]
  title: string
  emptyMsg: string
}) {
  if (clients.length === 0) {
    return (
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
        <p className="text-sm text-gray-400">{emptyMsg}</p>
      </div>
    )
  }

  const allCells = clients.flatMap((c) => c.cells)
  const filedCount   = allCells.filter((c) => c.status === 'FILED').length
  const overdueCount = allCells.filter((c) => c.status === 'OVERDUE').length
  const total = clients.length * slots.length
  const complianceRate = total > 0 ? Math.round((filedCount / total) * 100) : 0

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>
            Compliance:{' '}
            <span className={`font-semibold ${
              complianceRate >= 80 ? 'text-green-600' :
              complianceRate >= 50 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {complianceRate}%
            </span>
          </span>
          {overdueCount > 0 && (
            <span className="text-red-600 font-semibold">{overdueCount} overdue</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4 min-w-[160px]">
                Client
              </th>
              {slots.map((slot) => (
                <th
                  key={slot}
                  title={slot}
                  className="text-center text-xs font-medium text-gray-400 pb-2 px-0.5 w-9 leading-tight whitespace-pre"
                >
                  {shortSlotLabel(slot)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.filter(Boolean).map((client) => (
              <tr key={client.id}>
                <td className="pr-4 py-0.5 align-middle">
                  <div
                    className="text-xs font-medium text-gray-800 truncate max-w-[180px]"
                    title={client.name}
                  >
                    {client.name}
                  </div>
                  {client.gstin && (
                    <div className="text-xs text-gray-400 font-mono leading-none mt-0.5">
                      {client.gstin.slice(0, 8)}…
                    </div>
                  )}
                </td>
                {client.cells.map((cell, idx) => (
                  <td key={idx} className="px-0.5 py-0.5 align-middle">
                    <span
                      className={`block w-8 h-8 rounded transition-colors cursor-default group relative ${CELL_BG[cell.status]} ${CELL_HOVER[cell.status]}`}
                      title={`${slots[idx]} — ${CELL_LABEL[cell.status]}`}
                      role="img"
                      aria-label={`${slots[idx]}: ${cell.status}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function FilingsHeatmap({ data }: { data: HeatmapData }) {
  const hasMonthly   = data.monthly.length > 0
  const hasQuarterly = data.quarterly.length > 0

  if (!hasMonthly && !hasQuarterly) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        No active clients found. Add clients in Settings → Clients.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 mb-4">
        <span className="font-medium text-gray-600">Legend:</span>
        {(['FILED', 'PENDING', 'OVERDUE'] as CellStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded-sm ${CELL_BG[s]}`} />
            {CELL_LABEL[s]}
          </span>
        ))}
      </div>

      {hasMonthly && (
        <HeatmapGrid
          slots={data.monthlySlots}
          clients={data.monthly}
          title="Monthly filers — last 12 periods"
          emptyMsg="No monthly filers."
        />
      )}

      {hasQuarterly && (
        <div className={hasMonthly ? 'border-t border-gray-200 pt-6' : ''}>
          <HeatmapGrid
            slots={data.quarterlySlots}
            clients={data.quarterly}
            title="Quarterly filers — last 5 quarters"
            emptyMsg="No quarterly filers."
          />
        </div>
      )}
    </div>
  )
}
