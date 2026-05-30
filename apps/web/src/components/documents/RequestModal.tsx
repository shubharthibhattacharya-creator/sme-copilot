'use client'
import { useState } from 'react'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'
import type { DocumentType } from '@opsc/types'

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'GST_RETURN', label: 'GST Return' },
  { value: 'TDS_CERTIFICATE', label: 'TDS Certificate' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'FORM_16', label: 'Form 16' },
  { value: 'OTHER', label: 'Other' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function RequestModal({ open, onClose }: Props) {
  const { request } = useApiClient()
  const [docType, setDocType] = useState<DocumentType>('GST_RETURN')
  const [userId, setUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId.trim()) return setError('User ID is required')

    setSubmitting(true)
    setError(null)

    try {
      await request('/documents/requests', {
        method: 'POST',
        body: JSON.stringify({ requestedFromUserId: userId, documentType: docType, dueDate: dueDate || undefined, notes: notes || undefined }),
      })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Document</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document type</label>
            <select value={docType} onChange={e => setDocType(e.target.value as DocumentType)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request from (User ID)</label>
            <input value={userId} onChange={e => setUserId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="user_..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due date (optional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-gray-500">Request will be sent via WhatsApp (coming soon)</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Sending...' : 'Send Request'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
