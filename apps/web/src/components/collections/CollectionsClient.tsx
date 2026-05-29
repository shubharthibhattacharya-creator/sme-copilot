'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { CollectionsFilters } from './CollectionsFilters'
import { InvoiceTable } from './InvoiceTable'
import { InvoiceDrawer } from './InvoiceDrawer'
import type { InvoiceWithRisk } from '@opsc/types'

interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface CollectionsClientProps {
  initialInvoices: InvoiceWithRisk[]
  initialMeta: Meta
  initialPage: number
}

export function CollectionsClient({
  initialInvoices,
  initialMeta,
  initialPage,
}: CollectionsClientProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithRisk | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const handlePageChange = useCallback(
    (page: number) => {
      const next = new URLSearchParams(params.toString())
      next.set('page', String(page))
      router.push(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router],
  )

  return (
    <div className="space-y-4">
      <CollectionsFilters />
      <InvoiceTable
        invoices={initialInvoices}
        meta={initialMeta}
        onRowClick={setSelectedInvoice}
        currentPage={initialPage}
        onPageChange={handlePageChange}
      />
      <InvoiceDrawer
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  )
}
