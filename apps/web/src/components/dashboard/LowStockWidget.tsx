import { cn } from '@/lib/utils'
import type { LowStockItem } from '@opsc/types'

interface LowStockWidgetProps {
  items: LowStockItem[]
}

function StockBar({
  quantity,
  reorderLevel,
}: {
  quantity: number
  reorderLevel: number
}) {
  const max = reorderLevel * 3 || 10
  const pct = Math.min((quantity / max) * 100, 100)
  const color =
    quantity < reorderLevel
      ? 'bg-red-500'
      : quantity < reorderLevel * 2
        ? 'bg-amber-400'
        : 'bg-green-400'

  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div
        className={cn('h-2 rounded-full transition-all', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function LowStockWidget({ items }: LowStockWidgetProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Low Stock Items</h2>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">All items above reorder level</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.sku} className="py-3 flex items-center gap-4">
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded shrink-0">
                {item.sku}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StockBar quantity={item.quantity} reorderLevel={item.reorderLevel} />
                  <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                    {item.quantity}/{item.reorderLevel}
                  </span>
                </div>
              </div>

              <span
                className={cn(
                  'text-xs font-semibold shrink-0',
                  item.daysUntilStockout < 7 && item.daysUntilStockout < 9999
                    ? 'text-red-600'
                    : item.daysUntilStockout < 14 && item.daysUntilStockout < 9999
                      ? 'text-amber-600'
                      : 'text-slate-400',
                )}
              >
                {item.daysUntilStockout >= 9999 ? '—' : `${item.daysUntilStockout}d`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
