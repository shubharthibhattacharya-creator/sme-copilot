'use client'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { DocumentList } from './DocumentList'
import { DocumentUploadButton } from './DocumentUploadButton'
import { DocumentDrawer } from './DocumentDrawer'
import { RequestModal } from './RequestModal'
import { usePermissions } from '@/contexts/permissions.context'
import { Button } from '@/components/ui'
import type { DocumentItem, DocumentRequest } from '@opsc/types'

interface Props {
  initialDocuments: { items: DocumentItem[]; meta: { total: number; page: number; limit: number; totalPages: number } }
  initialRequests: DocumentRequest[]
}

const DOC_TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Invoice', GST_RETURN: 'GST Return', TDS_CERTIFICATE: 'TDS Certificate',
  BANK_STATEMENT: 'Bank Statement', FORM_16: 'Form 16', PURCHASE_ORDER: 'Purchase Order',
  DELIVERY_NOTE: 'Delivery Note', OTHER: 'Other',
}

const REQUEST_STATUS_STYLE: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  FULFILLED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

export function DocumentsClient({ initialDocuments, initialRequests }: Props) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [requests] = useState(initialRequests)
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [filters, setFilters] = useState<{ documentType?: string; status?: string; documentPurpose?: string; clientId?: string }>({})
  const [isFiltering, setIsFiltering] = useState(false)
  const { canDo } = usePermissions()
  const { getToken } = useAuth()

  function handleUploaded(doc: DocumentItem) {
    setDocuments(prev => ({ ...prev, items: [doc, ...prev.items] }))
  }

  function handleDeleted(id: string) {
    setDocuments(prev => ({
      ...prev,
      items: prev.items.filter(d => d.id !== id),
      meta: { ...prev.meta, total: prev.meta.total - 1 },
    }))
  }

  async function handleFilterChange(newFilters: { documentType?: string; status?: string; documentPurpose?: string; clientId?: string }) {
    setFilters(newFilters)
    setIsFiltering(true)

    try {
      const token = await getToken()
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? ''
      const params = new URLSearchParams()
      if (newFilters.documentType) params.append('documentType', newFilters.documentType)
      if (newFilters.status) params.append('status', newFilters.status)
      if (newFilters.documentPurpose) params.append('documentPurpose', newFilters.documentPurpose)
      if (newFilters.clientId) params.append('clientId', newFilters.clientId)
      params.append('limit', '100')

      const res = await fetch(`${apiUrl}/api/v1/documents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } finally {
      setIsFiltering(false)
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING')

  return (
    <div>
      <div className="flex gap-3 mb-6">
        {canDo('documents', 'upload') && <DocumentUploadButton onUploaded={handleUploaded} />}
        {canDo('documents', 'request') && (
          <Button variant="secondary" size="sm" onClick={() => setShowRequestModal(true)}>
            Request Document
          </Button>
        )}
      </div>

      <div className="mb-4 text-sm text-gray-500 flex items-center gap-3">
        <span>{documents.meta.total} document{documents.meta.total !== 1 ? 's' : ''}</span>
        {requests.length > 0 && (
          <button
            onClick={() => setShowRequests(v => !v)}
            className="text-amber-600 hover:underline"
          >
            {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Pending document requests panel */}
      {showRequests && requests.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 flex items-center justify-between">
            <span className="text-sm font-medium text-amber-800">Document Requests</span>
            <button onClick={() => setShowRequests(false)} className="text-amber-500 hover:text-amber-700 text-xs">Hide</button>
          </div>
          <div className="divide-y divide-amber-100">
            {requests.map((req) => (
              <div key={req.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${REQUEST_STATUS_STYLE[req.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {req.status}
                </span>
                <span className="font-medium text-gray-800">{DOC_TYPE_LABEL[req.documentType] ?? req.documentType}</span>
                {req.dueDate && (
                  <span className="text-xs text-gray-500">
                    Due {new Date(req.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {req.notes && <span className="text-xs text-gray-400 truncate">{req.notes}</span>}
                {req.status === 'FULFILLED' && req.fulfilledDocument && (
                  <span className="text-xs text-green-600 ml-auto shrink-0">
                    ✓ {req.fulfilledDocument.originalName}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DocumentList
        documents={documents.items}
        onSelect={setSelectedDocument}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <DocumentDrawer
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
        onDeleted={handleDeleted}
      />

      <RequestModal
        open={showRequestModal}
        onClose={() => setShowRequestModal(false)}
      />
    </div>
  )
}
