'use client'
import { useState } from 'react'
import { useApiClient } from '@/lib/client-api'
import { useApiError } from '@/hooks/useApiError'

const FILING_TYPES = [
  { key: 'GST_MONTHLY',   label: 'GST Return — Monthly',     desc: 'GSTR-3B due 20th every month' },
  { key: 'GST_QUARTERLY', label: 'GST Return — Quarterly',   desc: 'GSTR-1 quarterly filers' },
  { key: 'TDS_QUARTERLY', label: 'TDS Return — Quarterly',   desc: 'TDS return due quarterly' },
  { key: 'ITR_ANNUAL',    label: 'Income Tax Return — Annual', desc: 'Income tax return annual' },
]

const DOC_TYPE_OPTIONS = [
  { value: 'INVOICE',         label: 'Invoice (Sales)' },
  { value: 'PURCHASE_ORDER',  label: 'Purchase invoice' },
  { value: 'DELIVERY_NOTE',   label: 'Delivery note' },
  { value: 'GST_RETURN',      label: 'GST return (draft)' },
  { value: 'TDS_CERTIFICATE', label: 'TDS certificate' },
  { value: 'BANK_STATEMENT',  label: 'Bank statement' },
  { value: 'FORM_16',         label: 'Form 16' },
  { value: 'OTHER',           label: 'Other document' },
]

interface Template {
  id?: string
  filingType: string
  label: string
  requiredDocTypes: string[]
  minDocCounts?: Record<string, number> | null
  isActive?: boolean
}

interface Props {
  initialTemplates: Template[]
}

function TemplateCard({ filingType, cardLabel, desc, existing, onSave }: {
  filingType: string
  cardLabel: string
  desc: string
  existing: Template | undefined
  onSave: (t: Template) => Promise<void>
}) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>(existing?.requiredDocTypes ?? [])
  const [minCounts, setMinCounts] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(existing?.minDocCounts ?? {}).map(([k, v]) => [k, String(v)])
    )
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { handleError } = useApiError()

  function toggleDoc(value: string) {
    setSelectedDocs((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    )
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const minDocCounts: Record<string, number> = {}
      for (const [k, v] of Object.entries(minCounts)) {
        const n = parseInt(v, 10)
        if (selectedDocs.includes(k) && n > 1) minDocCounts[k] = n
      }
      await onSave({
        filingType,
        label: cardLabel,
        requiredDocTypes: selectedDocs,
        minDocCounts: Object.keys(minDocCounts).length > 0 ? minDocCounts : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      handleError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{cardLabel}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Required documents</p>
        <div className="flex flex-wrap gap-2">
          {DOC_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleDoc(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedDocs.includes(opt.value)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {selectedDocs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Minimum counts (optional)</p>
          <div className="space-y-1">
            {selectedDocs.map((docType) => {
              const opt = DOC_TYPE_OPTIONS.find((o) => o.value === docType)
              return (
                <div key={docType} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600 w-40 shrink-0 text-xs">{opt?.label}</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={minCounts[docType] ?? '1'}
                    onChange={(e) => setMinCounts((prev) => ({ ...prev, [docType]: e.target.value }))}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">minimum</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'
        }`}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save template'}
      </button>
    </div>
  )
}

export function FilingTemplatesClient({ initialTemplates }: Props) {
  const { request } = useApiClient()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)

  async function saveTemplate(t: Template) {
    const existing = templates.find((e) => e.filingType === t.filingType)
    let updated: Template
    if (existing?.id) {
      updated = await request<Template>(`/compliance/templates/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: t.label,
          requiredDocTypes: t.requiredDocTypes,
          minDocCounts: t.minDocCounts,
        }),
      })
    } else {
      updated = await request<Template>('/compliance/templates', {
        method: 'POST',
        body: JSON.stringify(t),
      })
    }
    setTemplates((prev) => {
      const others = prev.filter((e) => e.filingType !== t.filingType)
      return [...others, updated]
    })
  }

  return (
    <div className="space-y-4">
      {FILING_TYPES.map(({ key, label, desc }) => (
        <TemplateCard
          key={key}
          filingType={key}
          cardLabel={label}
          desc={desc}
          existing={templates.find((t) => t.filingType === key)}
          onSave={saveTemplate}
        />
      ))}
    </div>
  )
}
