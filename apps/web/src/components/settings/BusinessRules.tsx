'use client'
import { useState, useCallback } from 'react'
import { useApiClient } from '@/lib/client-api'

interface ConfigEntry {
  value: unknown
  isOverridden: boolean
  systemDefault: unknown
  label: string
  description: string | null
  unit: string | null
  dataType: string
  category: string
  minValue?: unknown
  maxValue?: unknown
}

type ConfigSnapshot = Record<string, ConfigEntry>

const CATEGORIES = [
  { key: 'COLLECTIONS', label: 'Collections' },
  { key: 'AI_INSIGHTS', label: 'AI Insights' },
  { key: 'GST_COMPLIANCE', label: 'GST & Compliance' },
  { key: 'DOCUMENTS', label: 'Documents' },
  { key: 'REPORTS', label: 'Reports' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
]

// Keys that must sum to 1.0 together
const RISK_WEIGHT_KEYS = ['risk_weight_aging', 'risk_weight_amount', 'risk_weight_history']

function fmt(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function ConfigRow({
  configKey,
  entry,
  onSave,
  onReset,
  allValues,
}: {
  configKey: string
  entry: ConfigEntry
  onSave: (key: string, value: unknown) => Promise<void>
  onReset: (key: string) => Promise<void>
  allValues: ConfigSnapshot
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(fmt(entry.value))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit() {
    setInputVal(fmt(entry.value))
    setError('')
    setEditing(true)
  }

  function validate(raw: string): { ok: boolean; val: unknown; msg?: string } {
    if (entry.dataType === 'NUMBER') {
      const n = parseFloat(raw)
      if (isNaN(n)) return { ok: false, val: null, msg: 'Must be a number' }
      if (entry.minValue !== undefined && n < Number(entry.minValue))
        return { ok: false, val: null, msg: `Minimum is ${entry.minValue as string}` }
      if (entry.maxValue !== undefined && n > Number(entry.maxValue))
        return { ok: false, val: null, msg: `Maximum is ${entry.maxValue as string}` }
      // Risk weight sum validation
      if (RISK_WEIGHT_KEYS.includes(configKey)) {
        const others = RISK_WEIGHT_KEYS.filter((k) => k !== configKey)
        const sumOthers = others.reduce((s, k) => s + Number(allValues[k]?.value ?? 0), 0)
        const newSum = sumOthers + n
        if (Math.abs(newSum - 1) > 0.001)
          return { ok: false, val: null, msg: `Risk weights must sum to 1.0 (current others sum: ${sumOthers.toFixed(2)}, your value would make total ${newSum.toFixed(2)})` }
      }
      return { ok: true, val: n }
    }
    if (entry.dataType === 'BOOLEAN') {
      return { ok: true, val: raw === 'true' || raw === '1' }
    }
    if (entry.dataType === 'JSON') {
      try {
        // Accept comma-separated numbers like "4, 7, 10, 1"
        const arr = raw.split(',').map((s) => {
          const n = Number(s.trim())
          if (isNaN(n)) throw new Error(`"${s.trim()}" is not a number`)
          return n
        })
        return { ok: true, val: arr }
      } catch (e) {
        return { ok: false, val: null, msg: e instanceof Error ? e.message : 'Invalid format' }
      }
    }
    return { ok: true, val: raw }
  }

  async function save() {
    const result = validate(inputVal)
    if (!result.ok) { setError(result.msg ?? 'Invalid'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(configKey, result.val)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    setSaving(true)
    try {
      await onReset(configKey)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const displayVal = fmt(entry.value)

  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{entry.label}</span>
          {entry.isOverridden ? (
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Custom</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Default</span>
          )}
          {entry.unit && (
            <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">{entry.unit}</span>
          )}
        </div>
        {entry.description && (
          <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            {entry.dataType === 'BOOLEAN' ? (
              <select value={inputVal} onChange={(e) => setInputVal(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            ) : (
              <input type={entry.dataType === 'NUMBER' ? 'number' : 'text'}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                step={entry.dataType === 'NUMBER' && String(entry.minValue ?? 1).includes('.') ? '0.01' : '1'}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <button onClick={save} disabled={saving}
              className="text-xs font-medium text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg min-w-[3rem] text-right">
              {entry.dataType === 'BOOLEAN' ? (entry.value ? 'On' : 'Off') : displayVal}
            </span>
            <button onClick={startEdit}
              className="text-xs text-blue-600 hover:underline">
              Edit
            </button>
            {entry.isOverridden && (
              <button onClick={reset} disabled={saving}
                className="text-xs text-gray-400 hover:text-gray-600">
                Reset ({fmt(entry.systemDefault)})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function BusinessRules({ initialConfig }: { initialConfig: ConfigSnapshot }) {
  const { request } = useApiClient()
  const [config, setConfig] = useState(initialConfig)
  const [activeTab, setActiveTab] = useState('COLLECTIONS')

  const saveConfig = useCallback(async (key: string, value: unknown) => {
    await request(`/settings/config/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    })
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, value, isOverridden: true },
    }))
  }, [request])

  const resetConfig = useCallback(async (key: string) => {
    await request(`/settings/config/${key}`, { method: 'DELETE' })
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, value: prev[key]!.systemDefault, isOverridden: false },
    }))
  }, [request])

  const tabEntries = Object.entries(config).filter(([, e]) => e.category === activeTab)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Business Rules</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure thresholds and defaults for all modules. Changes take effect immediately.</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {CATEGORIES.map(({ key, label }) => {
          const count = Object.values(config).filter((e) => e.category === key && e.isOverridden).length
          return (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}>
              {label}
              {count > 0 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Config rows */}
      <div className="bg-white rounded-xl border border-gray-200 px-5">
        {tabEntries.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No configuration for this category.</p>
        ) : (
          tabEntries.map(([key, entry]) => (
            <ConfigRow key={key} configKey={key} entry={entry}
              onSave={saveConfig} onReset={resetConfig} allValues={config} />
          ))
        )}
      </div>

      {activeTab === 'COLLECTIONS' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          Risk weights (aging + amount + history) must sum to exactly 1.0. The editor validates this before saving.
        </div>
      )}
    </div>
  )
}
