'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export function ReconUploadForm() {
  const { getToken } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filingPeriod, setFilingPeriod] = useState('')
  const [fileFormat, setFileFormat] = useState<'EXCEL' | 'PDF'>('EXCEL')

  async function handleSubmit() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Please select a file'); return }
    if (!filingPeriod.trim()) { setError('Filing period is required (e.g. Nov 2024)'); return }

    setUploading(true)
    setError(null)
    try {
      const token = await getToken()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('filingPeriod', filingPeriod.trim())
      fd.append('fileFormat', fileFormat)

      const res = await fetch(`${API_URL}/api/v1/reconciliation/gstr2b`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' })) as { message?: string }
        setError(err.message ?? 'Upload failed')
        return
      }
      setOpen(false)
      setFilingPeriod('')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        Upload GSTR-2B
      </button>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 max-w-lg">
      <p className="text-sm font-medium text-gray-900">Upload GSTR-2B Statement</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Filing period</label>
          <input
            type="text"
            placeholder="e.g. Nov 2024"
            value={filingPeriod}
            onChange={(e) => setFilingPeriod(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">File format</label>
          <select
            value={fileFormat}
            onChange={(e) => setFileFormat(e.target.value as 'EXCEL' | 'PDF')}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
          >
            <option value="EXCEL">Excel (.xlsx)</option>
            <option value="PDF">PDF</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">GSTR-2B file</label>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.pdf"
          className="text-sm text-gray-600"
          onChange={() => setError(null)}
        />
        <p className="text-xs text-gray-400 mt-1">
          Download from GST portal → Returns → GSTR-2B → Download
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload & Reconcile'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null) }}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
