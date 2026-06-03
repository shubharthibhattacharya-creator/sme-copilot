'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import type { DocumentItem, DocumentType } from '@opsc/types'
import { ApiError } from '@/lib/api-error'
import { useApiError } from '@/hooks/useApiError'
import { validators } from '@/lib/validators'

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'INVOICE', label: 'Invoice (Firm fee invoice)' },
  { value: 'CLIENT_SALES_INVOICE', label: "Client's Sales Invoice" },
  { value: 'CLIENT_PURCHASE_INVOICE', label: "Client's Purchase Invoice" },
  { value: 'GST_RETURN', label: 'GST Return' },
  { value: 'TDS_CERTIFICATE', label: 'TDS Certificate' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'FORM_16', label: 'Form 16' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'DELIVERY_NOTE', label: 'Delivery Note' },
  { value: 'OTHER', label: 'Other' },
]

const MAX_FILE_MB = 10
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

interface Props {
  onUploaded: (doc: DocumentItem) => void
  sourceModule?: string
  classificationMode?: 'smart' | 'explicit'
}

export function DocumentUploadButton({ onUploaded, sourceModule, classificationMode = 'smart' }: Props) {
  const { getToken } = useAuth()
  const { handleError } = useApiError()
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [docType, setDocType] = useState<DocumentType>('INVOICE')
  const [error, setError] = useState<string | null>(null)
  const [documentOwner, setDocumentOwner] = useState<'FIRM' | 'CLIENT' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Please select a file')
      return
    }

    // ── Client-side validation (prevents unnecessary API calls) ──────────────
    const sizeError = validators.fileSize(file, MAX_FILE_MB)
    if (sizeError) {
      setError(sizeError)
      return
    }
    const typeError = validators.fileType(file, ALLOWED_MIME_TYPES)
    if (typeError) {
      setError(typeError)
      return
    }

    setUploading(true)
    setError(null)

    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', docType)
      if (sourceModule) formData.append('sourceModule', sourceModule)
      formData.append('sourceChannel', 'MANUAL_UPLOAD')
      if (documentOwner) formData.append('documentOwner', documentOwner)

      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/v1/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        let errorBody: { errorCode?: string; userMessage?: string; suggestion?: string; message?: string } = {}
        try {
          errorBody = await res.json()
        } catch {
          // ignore parse error
        }
        throw new ApiError(
          errorBody.errorCode ?? 'UPLOAD_FAILED',
          errorBody.userMessage ?? errorBody.message ?? 'Upload failed',
          errorBody.suggestion ?? 'Please try again.',
          res.status,
        )
      }

      const doc = await res.json() as DocumentItem
      onUploaded(doc)
      setShowForm(false)
      setDocumentOwner(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      if (err instanceof ApiError) {
        // Show structured error message in the component (not a toast, it's inline)
        setError(err.userMessage + (err.suggestion ? ` ${err.suggestion}` : ''))
      } else {
        handleError(err)
      }
    } finally {
      setUploading(false)
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        Upload Document
      </button>
    )
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      {showForm && classificationMode === 'explicit' && !documentOwner && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-3">
          <p className="text-sm font-medium text-gray-900">What are you uploading?</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setDocumentOwner('FIRM')}
              className="p-3 text-left border-2 border-gray-200 rounded-lg hover:border-teal-400 transition-colors">
              <p className="text-sm font-medium text-gray-900">Our firm&apos;s fee invoice</p>
              <p className="text-xs text-gray-500 mt-1">Invoice we raised to a client</p>
              <p className="text-xs text-teal-600 mt-2">→ Added to Collections as receivable</p>
            </button>
            <button onClick={() => setDocumentOwner('CLIENT')}
              className="p-3 text-left border-2 border-gray-200 rounded-lg hover:border-purple-400 transition-colors">
              <p className="text-sm font-medium text-gray-900">Client&apos;s document</p>
              <p className="text-xs text-gray-500 mt-1">Purchase bills, GST returns, bank statements</p>
              <p className="text-xs text-purple-600 mt-2">→ Stored in client&apos;s document vault</p>
            </button>
          </div>
        </div>
      )}
      {(classificationMode !== 'explicit' || documentOwner) && (
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={docType}
            onChange={e => setDocType(e.target.value as DocumentType)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5"
          >
            {DOCUMENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="text-sm text-gray-600"
            onChange={() => setError(null)}
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            onClick={() => { setShowForm(false); setDocumentOwner(null); setError(null) }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          {error && (
            <span className="text-sm text-red-500" role="alert">{error}</span>
          )}
        </div>
      )}
    </div>
  )
}
