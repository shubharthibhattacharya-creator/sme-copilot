'use client'
import { useState, useRef, useEffect } from 'react'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

const DOC_TYPES = [
  { value: 'GST_RETURN',               label: 'GST Return' },
  { value: 'TDS_CERTIFICATE',          label: 'TDS Certificate' },
  { value: 'BANK_STATEMENT',           label: 'Bank Statement' },
  { value: 'CLIENT_SALES_INVOICE',     label: "Sales Invoice (your sales to customers)" },
  { value: 'CLIENT_PURCHASE_INVOICE',  label: "Purchase Invoice (bills from vendors)" },
  { value: 'INVOICE',                  label: 'Fee Invoice (CA firm invoice)' },
  { value: 'FORM_16',                  label: 'Form 16' },
  { value: 'OTHER',                    label: 'Other' },
]

type UploadState = 'idle' | 'loading_token' | 'ready' | 'uploading' | 'success' | 'error'

interface TokenInfo {
  label: string | null
  client: { name: string } | null
  expiresAt: string
}

interface Props {
  token: string
}

export function UploadPage({ token }: Props) {
  const [state, setState] = useState<UploadState>('loading_token')
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('GST_RETURN')
  const [filingPeriod, setFilingPeriod] = useState('')
  const [notes, setNotes] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadToken() {
      try {
        const res = await fetch(`${API_URL}/api/v1/public/upload/${token}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Invalid or expired link' }))
          setErrorMsg((err as { message?: string }).message ?? 'Invalid or expired link')
          setState('error')
          return
        }
        const data = await res.json() as TokenInfo
        setTokenInfo(data)
        setState('ready')
      } catch {
        setErrorMsg('Could not load upload page. Please check your link.')
        setState('error')
      }
    }
    void loadToken()
  }, [token])

  function onFileChange(f: File | null) {
    if (!f) return
    const allowed = ['application/pdf','image/jpeg','image/png','image/webp']
    if (!allowed.includes(f.type)) {
      setErrorMsg('Only PDF, JPEG, PNG, or WebP files are allowed.')
      return
    }
    if (f.size > 15 * 1024 * 1024) {
      setErrorMsg('File must be under 15 MB.')
      return
    }
    setErrorMsg('')
    setFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setState('uploading')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('documentType', docType)
      if (filingPeriod.trim()) fd.append('filingPeriod', filingPeriod.trim())
      if (notes.trim()) fd.append('notes', notes.trim())

      const res = await fetch(`${API_URL}/api/v1/public/upload/${token}`, {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }))
        setErrorMsg((err as { message?: string }).message ?? 'Upload failed')
        setState('ready')
        return
      }

      setState('success')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('ready')
    }
  }

  if (state === 'loading_token') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-sm text-gray-500">{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Document uploaded!</h1>
          <p className="text-sm text-gray-500">
            Your document has been received and will be processed. You can close this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-lg w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="text-blue-600 font-bold text-lg mb-1">OpsCopilot</div>
          <h1 className="text-xl font-semibold text-gray-900">
            {tokenInfo?.label ?? 'Upload document'}
          </h1>
          {tokenInfo?.client && (
            <p className="text-sm text-gray-500 mt-1">For: {tokenInfo.client.name}</p>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-5 ${
            dragOver ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            onFileChange(e.dataTransfer.files[0] ?? null)
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div>
              <div className="text-2xl mb-2">{file.type === 'application/pdf' ? '📄' : '🖼️'}</div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-3">📎</div>
              <p className="text-sm font-medium text-gray-700">Drop file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPEG, PNG, WebP · Max 15 MB</p>
            </div>
          )}
        </div>

        {/* Document type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Document type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Filing period */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filing period <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Nov 2024"
            value={filingPeriod}
            onChange={(e) => setFilingPeriod(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Any additional notes for your CA…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || state === 'uploading'}
          className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {state === 'uploading' ? 'Uploading…' : 'Upload document'}
        </button>
      </div>
    </div>
  )
}
