'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApiClient } from '@/lib/client-api'

const TOTAL_STEPS = 5
const STORAGE_KEY = 'opsc_onboarding'

interface OnboardingState {
  step: number
  firmName: string
  gstNumber: string
  panNumber: string
  address: string
  phone: string
  modulesEnabled: string[]
  clientsAdded: number
  whatsappPhone: string
  whatsappSkipped: boolean
}

const DEFAULT_STATE: OnboardingState = {
  step: 1,
  firmName: '',
  gstNumber: '',
  panNumber: '',
  address: '',
  phone: '',
  modulesEnabled: ['dashboard', 'collections', 'reporting', 'documents', 'assistant', 'whatsapp'],
  clientsAdded: 0,
  whatsappPhone: '',
  whatsappSkipped: false,
}

const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard', desc: 'AI insights + KPIs', locked: true },
  { key: 'collections', label: 'Collections', desc: 'Receivables & risk scoring', locked: false },
  { key: 'reporting', label: 'Reports', desc: 'Automated report generation', locked: false },
  { key: 'documents', label: 'Documents', desc: 'OCR + document management', locked: false },
  { key: 'assistant', label: 'AI Assistant', desc: 'RAG-powered knowledge base', locked: false },
  { key: 'whatsapp', label: 'WhatsApp', desc: 'Automated client messaging', locked: false },
]

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            i + 1 < step ? 'bg-blue-600 text-white' :
            i + 1 === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
            'bg-gray-200 text-gray-500'
          }`}>
            {i + 1 < step ? '✓' : i + 1}
          </div>
          {i < TOTAL_STEPS - 1 && (
            <div className={`flex-1 h-0.5 w-12 ${i + 1 < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-sm text-gray-400">{step} of {TOTAL_STEPS}</span>
    </div>
  )
}

export function OnboardingWizard() {
  const router = useRouter()
  const { request } = useApiClient()
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newClient, setNewClient] = useState({ name: '', gstin: '', filerType: 'MONTHLY' })
  const [addingClient, setAddingClient] = useState(false)
  const [provisioned, setProvisioned] = useState(false)

  // Restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setState(JSON.parse(saved) as OnboardingState)
    } catch { /* ignore */ }
  }, [])

  // Provision DB user (idempotent) before any API calls
  useEffect(() => {
    request<{ ok: boolean }>('/auth/register', { method: 'POST' })
      .then(() => setProvisioned(true))
      .catch((err) => setError(err instanceof Error ? err.message : 'Account setup failed'))
  }, [request])

  function persist(patch: Partial<OnboardingState>) {
    const next = { ...state, ...patch }
    setState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function next() {
    setError('')
    persist({ step: state.step + 1 })
  }

  function back() {
    setError('')
    persist({ step: state.step - 1 })
  }

  async function saveFirmProfile() {
    if (!state.firmName.trim()) { setError('Firm name is required'); return }
    setSaving(true)
    try {
      await request('/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: state.firmName,
          gstNumber: state.gstNumber || undefined,
          panNumber: state.panNumber || undefined,
          address: state.address || undefined,
          phone: state.phone || undefined,
        }),
      })
      next()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function addClient() {
    if (!newClient.name.trim()) return
    setAddingClient(true)
    try {
      await request('/clients', {
        method: 'POST',
        body: JSON.stringify(newClient),
      })
      persist({ clientsAdded: state.clientsAdded + 1 })
      setNewClient({ name: '', gstin: '', filerType: 'MONTHLY' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add client')
    } finally {
      setAddingClient(false)
    }
  }

  function finish() {
    localStorage.removeItem(STORAGE_KEY)
    router.push('/dashboard')
  }

  if (!provisioned && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Setting up your account…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="text-2xl font-bold text-blue-600">OpsCopilot</div>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">Setup wizard</span>
        </div>

        <ProgressBar step={state.step} />

        {/* Step 1 — Firm details */}
        {state.step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tell us about your firm</h2>
              <p className="text-sm text-gray-500 mt-1">This information will appear on communications and reports.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Firm name *</label>
              <input type="text" value={state.firmName}
                onChange={(e) => setState((s) => ({ ...s, firmName: e.target.value }))}
                placeholder="Mehta & Associates CA"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">GSTIN</label>
                <input type="text" value={state.gstNumber}
                  onChange={(e) => setState((s) => ({ ...s, gstNumber: e.target.value.toUpperCase() }))}
                  placeholder="29AABCS1429B1Z4" maxLength={15}
                  className="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">PAN</label>
                <input type="text" value={state.panNumber}
                  onChange={(e) => setState((s) => ({ ...s, panNumber: e.target.value.toUpperCase() }))}
                  placeholder="AABCS1429B" maxLength={10}
                  className="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
              <input type="text" value={state.phone}
                onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Address</label>
              <textarea value={state.address} rows={2}
                onChange={(e) => setState((s) => ({ ...s, address: e.target.value }))}
                placeholder="Office address..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={saveFirmProfile} disabled={saving}
              className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        )}

        {/* Step 2 — Modules */}
        {state.step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Choose your modules</h2>
              <p className="text-sm text-gray-500 mt-1">Enable the features your firm needs. You can change this later in Settings.</p>
            </div>
            <div className="space-y-2">
              {ALL_MODULES.map((m) => (
                <div key={m.key}
                  onClick={() => {
                    if (m.locked) return
                    const enabled = state.modulesEnabled.includes(m.key)
                    persist({ modulesEnabled: enabled ? state.modulesEnabled.filter((k) => k !== m.key) : [...state.modulesEnabled, m.key] })
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${state.modulesEnabled.includes(m.key) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'} ${m.locked ? 'opacity-70 cursor-not-allowed' : 'hover:border-blue-300'}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${state.modulesEnabled.includes(m.key) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {state.modulesEnabled.includes(m.key) && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                      {m.label}
                      {m.locked && <span className="text-xs text-gray-400">(always on)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={back} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">← Back</button>
              <button onClick={next} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Clients */}
        {state.step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add your clients</h2>
              <p className="text-sm text-gray-500 mt-1">Add clients now or skip — you can always add them from Settings → Clients.</p>
            </div>
            {state.clientsAdded > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                {state.clientsAdded} client{state.clientsAdded > 1 ? 's' : ''} added so far.
              </div>
            )}
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-600">Add a client manually</p>
              <input type="text" value={newClient.name}
                onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
                placeholder="Client name *"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={newClient.gstin}
                  onChange={(e) => setNewClient((c) => ({ ...c, gstin: e.target.value.toUpperCase() }))}
                  placeholder="GSTIN (optional)" maxLength={15}
                  className="text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={newClient.filerType}
                  onChange={(e) => setNewClient((c) => ({ ...c, filerType: e.target.value }))}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="MONTHLY">Monthly filer</option>
                  <option value="QUARTERLY">Quarterly filer</option>
                  <option value="ANNUAL">Annual filer</option>
                </select>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button onClick={addClient} disabled={addingClient || !newClient.name.trim()}
                className="w-full py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-60">
                {addingClient ? 'Adding…' : '+ Add this client'}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={back} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">← Back</button>
              <button onClick={next} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">
                {state.clientsAdded > 0 ? 'Continue →' : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — WhatsApp */}
        {state.step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">WhatsApp setup</h2>
              <p className="text-sm text-gray-500 mt-1">Connect Twilio to send automated payment reminders and filing nudges.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2 text-sm text-blue-800">
              <p className="font-medium">Twilio Sandbox setup:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                <li>Create a free Twilio account at twilio.com</li>
                <li>Go to Messaging → Try it out → Send a WhatsApp message</li>
                <li>Note your sandbox number: <span className="font-mono">+1 415 523 8886</span></li>
                <li>From your phone, send <span className="font-mono">join [your-sandbox-word]</span> to that number</li>
                <li>Add your Twilio credentials to the <span className="font-mono">.env</span> file</li>
              </ol>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Your WhatsApp number (for test)</label>
              <input type="text" value={state.whatsappPhone}
                onChange={(e) => setState((s) => ({ ...s, whatsappPhone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">We'll send a test message when you first send a reminder.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={back} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">← Back</button>
              <button onClick={() => { persist({ whatsappSkipped: true }); next() }}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50">
                Skip
              </button>
              <button onClick={next} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">Continue →</button>
            </div>
          </div>
        )}

        {/* Step 5 — Review */}
        {state.step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">You're all set!</h2>
              <p className="text-sm text-gray-500 mt-1">Here's a summary of your setup.</p>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Firm name', value: state.firmName || '(not set)' },
                { label: 'GSTIN', value: state.gstNumber || '—' },
                { label: 'Modules enabled', value: state.modulesEnabled.length.toString() },
                { label: 'Clients added', value: state.clientsAdded > 0 ? state.clientsAdded.toString() : 'None (add from Settings)' },
                { label: 'WhatsApp', value: state.whatsappSkipped ? 'Skipped — configure later' : (state.whatsappPhone || 'Not configured') },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={back} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">← Back</button>
              <button onClick={finish} className="flex-1 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700">
                Go to Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
