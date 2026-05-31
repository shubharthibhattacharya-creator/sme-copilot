'use client'

import { useState } from 'react'
import { Mail, Phone } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/action-icon-button'
import { formatCurrency } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui'
import { ActionIconButton } from '@/components/ui/action-icon-button'
import { useApiClient } from '@/lib/client-api'
import { useApiError } from '@/hooks/useApiError'
import { toast } from '@/components/ui/toast'
import type { CriticalCustomer } from '@opsc/types'

interface CriticalCustomersTableProps {
  customers: CriticalCustomer[]
}

function RowActions({ customer }: { customer: CriticalCustomer }) {
  const [sending, setSending] = useState(false)
  const { request } = useApiClient()
  const { handleError } = useApiError()

  async function handleWhatsApp(e: React.MouseEvent) {
    e.stopPropagation()
    if (!customer.invoiceId) return
    setSending(true)
    try {
      await request('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ type: 'FEE_REMINDER', invoiceId: customer.invoiceId }),
      })
      toast.success(`WhatsApp sent to ${customer.name}`)
    } catch (err) {
      handleError(err)
    } finally {
      setSending(false)
    }
  }

  function handleEmail(e: React.MouseEvent) {
    e.stopPropagation()
    if (!customer.email) return
    window.location.href = `mailto:${customer.email}?subject=Payment reminder`
  }

  function handleCall(e: React.MouseEvent) {
    e.stopPropagation()
    if (!customer.phone) return
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      window.location.href = `tel:${customer.phone}`
    } else {
      toast.info(`Call ${customer.name}: ${customer.phone}`)
    }
  }

  const hasPhone = Boolean(customer.phone)
  const hasEmail = Boolean(customer.email)
  const hasInvoice = Boolean(customer.invoiceId)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <ActionIconButton
        icon={<WhatsAppIcon size={15} />}
        label={hasPhone && hasInvoice ? `WhatsApp ${customer.name}` : 'No phone number'}
        onClick={handleWhatsApp}
        color="whatsapp"
        disabled={!hasPhone || !hasInvoice}
        loading={sending}
      />
      <ActionIconButton
        icon={<Mail size={14} strokeWidth={2} />}
        label={hasEmail ? `Email ${customer.name}` : 'No email address'}
        onClick={handleEmail}
        color="email"
        disabled={!hasEmail}
      />
      <ActionIconButton
        icon={<Phone size={14} strokeWidth={2} />}
        label={hasPhone ? `Call ${customer.name}` : 'No phone number'}
        onClick={handleCall}
        color="call"
        disabled={!hasPhone}
      />
    </div>
  )
}

export function CriticalCustomersTable({ customers }: CriticalCustomersTableProps) {
  const sorted = [...customers].filter(Boolean).sort((a, b) => b.overdueAmount - a.overdueAmount)

  return (
    <Card padding="24px" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardHeader title="Top Overdue Customers" />

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
                <th className="text-left text-xs font-medium text-slate-500 pb-2 pr-4">
                  Oldest Invoice
                </th>
                <th className="text-right text-xs font-medium text-slate-500 pb-2" style={{ width: '96px' }}>
                  Actions
                </th>
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
                  <td className="py-3 pr-4 text-left text-slate-600">
                    {c.oldestInvoiceDays}d
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end">
                      <RowActions customer={c} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
