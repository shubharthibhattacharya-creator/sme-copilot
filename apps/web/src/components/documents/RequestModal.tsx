'use client'
import { useState, useEffect } from 'react'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'
import type { DocumentType } from '@opsc/types'

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'GST_RETURN', label: 'GST Return' },
  { value: 'TDS_CERTIFICATE', label: 'TDS Certificate' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'FORM_16', label: 'Form 16' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'DELIVERY_NOTE', label: 'Delivery Note' },
  { value: 'OTHER', label: 'Other' },
]

interface Client { id: string; name: string; phone: string | null }

interface Props {
  open: boolean
  onClose: () => void
}

export function RequestModal({ open, onClose }: Props) {
  const { request } = useApiClient()
  const [docType, setDocType] = useState<DocumentType>('GST_RETURN')
  const [clientId, setClientId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    if (!open) return
    request<{ data: Client[] }>('/clients?limit=100')
      .then((res) => setClients(res.data))
      .catch(() => null)
  }, [open, request])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await request('/documents/requests', {
        method: 'POST',
        body: JSON.stringify({
          clientId: clientId || undefined,
          documentType: docType,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
        }),
      })
      const selectedClient = clients.find((c) => c.id === clientId)
      const whatsappNote = selectedClient?.phone ? ' WhatsApp sent.' : ' (No phone on file — WhatsApp not sent.)'
      setSuccess(`Request created.${clientId ? whatsappNote : ''}`)
      setTimeout(() => { onClose() }, 1800)
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
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client <span className="text-gray-400 font-normal">(WhatsApp will be sent if phone is on file)</span>
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Select client (optional) —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.phone ? '' : ' (no phone)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. For April 2026 GST filing"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
