'use client'
import { useState, useCallback, useRef } from 'react'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'

interface ConfigEntry {
  value: unknown
  isOverridden: boolean
  systemDefault: unknown
  defaultValue: unknown
  label: string
  description: string | null
  unit: string | null
  dataType: string
  category: string
  isPublic: boolean
  minValue?: unknown
  maxValue?: unknown
}

type ConfigSnapshot = Record<string, ConfigEntry>

const CATEGORIES = [
  { key: 'COLLECTIONS', label: 'Collections' },
  { key: 'GST_COMPLIANCE', label: 'GST & Compliance' },
  { key: 'DOCUMENTS', label: 'Documents' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
  { key: 'AI_INSIGHTS', label: 'AI Insights' },
  { key: 'REPORTS', label: 'Reports' },
]

const RISK_WEIGHT_KEYS = ['risk_weight_aging', 'risk_weight_amount', 'risk_weight_history']

// Keys that get special UI treatment
const QUIET_HOURS_KEYS = new Set(['whatsapp_quiet_hours_start', 'whatsapp_quiet_hours_end'])

function fmt(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return (v as unknown[]).join(', ')
  return String(v)
}

function hourToTime(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function timeToHour(t: string): number {
  return parseInt(t.split(':')[0] ?? '0', 10)
}

// ── Risk weight live sum indicator ────────────────────────────────────────────

function RiskWeightBanner({ config, liveOverrides }: { config: ConfigSnapshot; liveOverrides: Record<string, number> }) {
  const get = (k: string) => liveOverrides[k] ?? Number(config[k]?.value ?? 0)
  const sum = Math.round((get('risk_weight_aging') + get('risk_weight_amount') + get('risk_weight_history')) * 1000) / 1000
  const ok = Math.abs(sum - 1) < 0.001
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mb-3 ${ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
      <span className={`text-lg leading-none ${ok ? 'text-green-500' : 'text-red-500'}`}>{ok ? '✓' : '✗'}</span>
      Risk weights sum: <span className="font-mono">{sum.toFixed(3)}</span>
      {ok ? ' — balanced' : ' — must equal 1.0'}
    </div>
  )
}

// ── Classification mode radio cards ──────────────────────────────────────────

function ClassificationModeRow({
  entry,
  onSave,
}: {
  configKey: string
  entry: ConfigEntry
  onSave: (value: unknown) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const current = String(entry.value ?? 'smart')

  async function pick(val: string) {
    if (val === current) return
    setSaving(true)
    setError('')
    try {
      await onSave(val)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const options = [
    { val: 'smart', label: 'Smart', desc: 'AI auto-classifies documents based on content' },
    { val: 'explicit', label: 'Explicit', desc: 'Staff must manually assign document type' },
  ]

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-900">{entry.label}</span>
        {saved && <span className="text-green-600 text-xs font-medium">✓ Saved</span>}
        {saving && <span className="text-gray-400 text-xs">Saving…</span>}
        {entry.isOverridden ? (
          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Custom</span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Default</span>
        )}
      </div>
      {entry.description && <p className="text-xs text-gray-500 mb-3">{entry.description}</p>}
      <div className="flex gap-3">
        {options.map(({ val, label, desc }) => (
          <button
            key={val}
            onClick={() => pick(val)}
            disabled={saving}
            className={`flex-1 rounded-lg border-2 p-3 text-left transition-colors ${
              current === val
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${current === val ? 'border-blue-600' : 'border-gray-300'}`}>
                {current === val && <span className="w-2 h-2 rounded-full bg-blue-600 block" />}
              </span>
              <span className={`text-sm font-semibold ${current === val ? 'text-blue-700' : 'text-gray-700'}`}>{label}</span>
            </div>
            <p className="text-xs text-gray-500 ml-6">{desc}</p>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

// ── Quiet hours range row ─────────────────────────────────────────────────────

function QuietHoursRow({
  startEntry,
  endEntry,
  onSaveStart,
  onSaveEnd,
}: {
  startEntry: ConfigEntry
  endEntry: ConfigEntry
  onSaveStart: (value: unknown) => Promise<void>
  onSaveEnd: (value: unknown) => Promise<void>
}) {
  const [startVal, setStartVal] = useState(hourToTime(Number(startEntry.value ?? 22)))
  const [endVal, setEndVal] = useState(hourToTime(Number(endEntry.value ?? 8)))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const startOverridden = startEntry.isOverridden || endEntry.isOverridden

  async function save() {
    setSaving(true)
    setError('')
    try {
      await Promise.all([
        onSaveStart(timeToHour(startVal)),
        onSaveEnd(timeToHour(endVal)),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-gray-900">Quiet Hours</span>
        {saved && <span className="text-green-600 text-xs font-medium">✓ Saved</span>}
        {startOverridden ? (
          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Custom</span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Default</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">No WhatsApp messages will be sent during this window</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-8">From</label>
          <input
            type="time"
            value={startVal}
            onChange={(e) => setStartVal(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-4">to</label>
          <input
            type="time"
            value={endVal}
            onChange={(e) => setEndVal(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-medium text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

// ── Large toggle row ──────────────────────────────────────────────────────────

function ToggleRow({
  configKey,
  entry,
  onSave,
}: {
  configKey: string
  entry: ConfigEntry
  onSave: (key: string, value: unknown) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const on = Boolean(entry.value)

  async function toggle() {
    setSaving(true)
    setError('')
    try {
      await onSave(configKey, !on)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{entry.label}</span>
          {saved && <span className="text-green-600 text-xs font-medium">✓ Saved</span>}
          {entry.isOverridden ? (
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Custom</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Default</span>
          )}
        </div>
        {entry.description && <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60 ${
          on ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

// ── Standard config row (save on blur) ───────────────────────────────────────

function ConfigRow({
  configKey,
  entry,
  onSave,
  onReset,
  allValues,
  onLiveChange,
}: {
  configKey: string
  entry: ConfigEntry
  onSave: (key: string, value: unknown) => Promise<void>
  onReset: (key: string) => Promise<void>
  allValues: ConfigSnapshot
  onLiveChange?: (key: string, val: number) => void
}) {
  const [inputVal, setInputVal] = useState(fmt(entry.value))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const originalVal = useRef(fmt(entry.value))

  // Sync when entry.value changes from outside (e.g. after reset)
  if (fmt(entry.value) !== originalVal.current && !saving) {
    originalVal.current = fmt(entry.value)
    // Don't setInputVal here to avoid re-render loop; only sync on next focus
  }

  function validate(raw: string): { ok: boolean; val: unknown; msg?: string } {
    if (entry.dataType === 'NUMBER') {
      const n = parseFloat(raw)
      if (isNaN(n)) return { ok: false, val: null, msg: 'Must be a number' }
      if (entry.minValue !== undefined && n < Number(entry.minValue))
        return { ok: false, val: null, msg: `Min is ${entry.minValue as string}` }
      if (entry.maxValue !== undefined && n > Number(entry.maxValue))
        return { ok: false, val: null, msg: `Max is ${entry.maxValue as string}` }
      if (RISK_WEIGHT_KEYS.includes(configKey)) {
        const others = RISK_WEIGHT_KEYS.filter((k) => k !== configKey)
        const sumOthers = others.reduce((s, k) => s + Number(allValues[k]?.value ?? 0), 0)
        const newSum = sumOthers + n
        if (Math.abs(newSum - 1) > 0.001)
          return { ok: false, val: null, msg: `Weights must sum to 1.0 (would be ${newSum.toFixed(3)})` }
      }
      return { ok: true, val: n }
    }
    if (entry.dataType === 'BOOLEAN') return { ok: true, val: raw === 'true' || raw === '1' }
    if (entry.dataType === 'JSON') {
      try {
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

  async function handleBlur() {
    if (inputVal === fmt(entry.value)) return // unchanged
    const result = validate(inputVal)
    if (!result.ok) { setError(result.msg ?? 'Invalid'); return }
    setError('')
    setSaving(true)
    try {
      await onSave(configKey, result.val)
      originalVal.current = inputVal
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Save failed')
      setInputVal(fmt(entry.value)) // revert
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    setSaving(true)
    try {
      await onReset(configKey)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const isBoolean = entry.dataType === 'BOOLEAN'

  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{entry.label}</span>
          {saved && <span className="text-green-600 text-xs font-medium">✓ Saved</span>}
          {saving && <span className="text-gray-400 text-xs">Saving…</span>}
          {entry.isOverridden ? (
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Custom</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Default</span>
          )}
          {entry.unit && (
            <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">{entry.unit}</span>
          )}
        </div>
        {entry.description && <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isBoolean ? (
          <select
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={handleBlur}
            disabled={saving}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 w-20 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
        ) : (
          <input
            type={entry.dataType === 'NUMBER' ? 'number' : 'text'}
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value)
              if (entry.dataType === 'NUMBER' && RISK_WEIGHT_KEYS.includes(configKey)) {
                const n = parseFloat(e.target.value)
                if (!isNaN(n)) onLiveChange?.(configKey, n)
              }
            }}
            onBlur={handleBlur}
            disabled={saving}
            step={entry.dataType === 'NUMBER' ? (String(entry.minValue ?? '1').includes('.') ? '0.01' : '1') : undefined}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
        )}
        {entry.isOverridden && (
          <button
            onClick={reset}
            disabled={saving}
            className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
            title={`Reset to default: ${fmt(entry.defaultValue ?? entry.systemDefault)}`}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

// ── Reset-all confirmation modal ──────────────────────────────────────────────

function ResetAllModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Reset all rules to defaults?</h3>
        <p className="text-sm text-gray-600 mb-5">
          This will remove all custom overrides and restore every rule to its system default. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
            {loading ? 'Resetting…' : 'Reset all'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BusinessRules({ initialConfig }: { initialConfig: ConfigSnapshot }) {
  const { request, download } = useApiClient()
  const [config, setConfig] = useState(initialConfig)
  const [activeTab, setActiveTab] = useState('COLLECTIONS')
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live risk weight overrides for sum indicator (not yet saved)
  const [liveWeights, setLiveWeights] = useState<Record<string, number>>({})

  const saveConfig = useCallback(async (key: string, value: unknown) => {
    await request(`/settings/rules/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    })
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, value, isOverridden: true },
    }))
    // Clear live override now that it's persisted
    if (RISK_WEIGHT_KEYS.includes(key)) {
      setLiveWeights((prev) => { const n = { ...prev }; delete n[key]; return n })
    }
  }, [request])

  const resetConfig = useCallback(async (key: string) => {
    await request(`/settings/rules/${key}`, { method: 'DELETE' })
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, value: prev[key]!.defaultValue ?? prev[key]!.systemDefault, isOverridden: false },
    }))
  }, [request])

  const handleLiveWeightChange = useCallback((key: string, val: number) => {
    setLiveWeights((prev) => ({ ...prev, [key]: val }))
  }, [])

  async function resetAll() {
    setResetLoading(true)
    try {
      await request('/settings/rules/reset-all', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'reset' }),
      })
      // Reload config
      const fresh = await request<ConfigSnapshot>('/settings/rules')
      setConfig(fresh)
      setLiveWeights({})
      setShowResetModal(false)
    } catch {
      // stay open on error
    } finally {
      setResetLoading(false)
    }
  }

  async function exportExcel() {
    await download('/settings/rules/export', 'business-rules.xlsx')
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setImportSuccess('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await request<{ applied: number; message: string }>('/settings/rules/import', {
        method: 'POST',
        body: form,
      })
      setImportSuccess(res.message)
      // Reload config
      const fresh = await request<ConfigSnapshot>('/settings/rules')
      setConfig(fresh)
    } catch (err) {
      setImportError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Import failed')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const tabEntries = Object.entries(config)
    .filter(([, e]) => e.category === activeTab)
    .sort(([, a], [, b]) => (a.label ?? '').localeCompare(b.label ?? ''))

  const customCount = (cat: string) =>
    Object.values(config).filter((e) => e.category === cat && e.isOverridden).length

  // Check if quiet hours keys are in current tab
  const hasQuietHours = activeTab === 'WHATSAPP' && tabEntries.some(([k]) => QUIET_HOURS_KEYS.has(k))
  const quietStartEntry = config['whatsapp_quiet_hours_start']
  const quietEndEntry = config['whatsapp_quiet_hours_end']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Business Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure thresholds and defaults. Changes take effect immediately.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Excel
          </button>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Import Excel
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={handleImport} />
          </label>
          <button
            onClick={() => setShowResetModal(true)}
            className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-100"
          >
            Reset all
          </button>
        </div>
      </div>

      {/* Import feedback */}
      {importSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ {importSuccess}
        </div>
      )}
      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* Layout: sidebar + content */}
      <div className="flex gap-5 min-h-[24rem]">
        {/* Left sidebar */}
        <div className="w-44 shrink-0">
          <nav className="flex flex-col gap-0.5">
            {CATEGORIES.map(({ key, label }) => {
              const count = customCount(key)
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                    activeTab === key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === key ? 'bg-blue-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'COLLECTIONS' && (
            <RiskWeightBanner config={config} liveOverrides={liveWeights} />
          )}

          <div className="bg-white rounded-xl border border-gray-200 px-5">
            {tabEntries.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No configuration for this category.</p>
            ) : (() => {
              const renderedKeys = new Set<string>()
              const rows: React.ReactNode[] = []

              // Render quiet hours together as one row
              if (hasQuietHours && quietStartEntry && quietEndEntry) {
                renderedKeys.add('whatsapp_quiet_hours_start')
                renderedKeys.add('whatsapp_quiet_hours_end')
                rows.push(
                  <QuietHoursRow
                    key="quiet_hours"
                    startEntry={quietStartEntry}
                    endEntry={quietEndEntry}
                    onSaveStart={(v) => saveConfig('whatsapp_quiet_hours_start', v)}
                    onSaveEnd={(v) => saveConfig('whatsapp_quiet_hours_end', v)}
                  />
                )
              }

              for (const [key, entry] of tabEntries) {
                if (renderedKeys.has(key)) continue

                if (key === 'document_classification_mode') {
                  rows.push(
                    <ClassificationModeRow
                      key={key}
                      configKey={key}
                      entry={entry}
                      onSave={(v) => saveConfig(key, v)}
                    />
                  )
                } else if (key === 'whatsapp_auto_reply_enabled') {
                  rows.push(
                    <ToggleRow
                      key={key}
                      configKey={key}
                      entry={entry}
                      onSave={saveConfig}
                    />
                  )
                } else {
                  rows.push(
                    <ConfigRow
                      key={key}
                      configKey={key}
                      entry={entry}
                      onSave={saveConfig}
                      onReset={resetConfig}
                      allValues={config}
                      onLiveChange={handleLiveWeightChange}
                    />
                  )
                }
              }

              return rows
            })()}
          </div>
        </div>
      </div>

      {showResetModal && (
        <ResetAllModal
          onConfirm={resetAll}
          onCancel={() => setShowResetModal(false)}
          loading={resetLoading}
        />
      )}
    </div>
  )
}
