import { formatCurrency } from '@/lib/utils'
import type { CriticalCustomer } from '@opsc/types'

interface CriticalCustomersTableProps {
  customers: CriticalCustomer[]
  whatsappEnabled?: boolean
}

export function CriticalCustomersTable({
  customers,
  whatsappEnabled = false,
}: CriticalCustomersTableProps) {
  const sorted = [...customers].sort((a, b) => b.overdueAmount - a.overdueAmount)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col h-full">
      <h2 className="font-semibold text-slate-800 mb-4">Critical Customers</h2>

      {sorted.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">No overdue customers</p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-500 pb-2 pr-4">Customer</th>
                <th className="text-right text-xs font-medium text-slate-500 pb-2 pr-4">
                  Overdue Amt
                </th>
                <th className="text-right text-xs font-medium text-slate-500 pb-2 pr-4">
                  Oldest Invoice
                </th>
                <th className="text-right text-xs font-medium text-slate-500 pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-800 truncate max-w-[140px]">
                    {c.name}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-red-600 font-semibold">
                    {formatCurrency(c.overdueAmount)}
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">
                    {c.oldestInvoiceDays}d
                  </td>
                  <td className="py-3 text-right">
                    {whatsappEnabled ? (
                      <button className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                        WhatsApp
                      </button>
                    ) : (
                      <span
                        className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-400 cursor-not-allowed"
                        title="WhatsApp not enabled for your plan"
                      >
                        Remind
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
