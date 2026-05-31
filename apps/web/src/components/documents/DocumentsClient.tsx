'use client'
import { useState } from 'react'
import { DocumentList } from './DocumentList'
import { DocumentUploadButton } from './DocumentUploadButton'
import { DocumentDrawer } from './DocumentDrawer'
import { RequestModal } from './RequestModal'
import { usePermissions } from '@/contexts/permissions.context'
import type { DocumentItem, DocumentRequest } from '@opsc/types'

interface Props {
  initialDocuments: { items: DocumentItem[]; meta: { total: number; page: number; limit: number; totalPages: number } }
  initialRequests: DocumentRequest[]
}

export function DocumentsClient({ initialDocuments, initialRequests }: Props) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [requests] = useState(initialRequests)
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const { canDo } = usePermissions()

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

  return (
    <div>
      <div className="flex gap-3 mb-6">
        {canDo('documents', 'upload') && <DocumentUploadButton onUploaded={handleUploaded} />}
        {canDo('documents', 'request') && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Request Document
          </button>
        )}
      </div>

      <div className="mb-4 text-sm text-gray-500">
        {documents.meta.total} document{documents.meta.total !== 1 ? 's' : ''}
        {requests.length > 0 && ` · ${requests.filter(r => r.status === 'PENDING').length} pending requests`}
      </div>

      <DocumentList documents={documents.items} onSelect={setSelectedDocument} />

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
