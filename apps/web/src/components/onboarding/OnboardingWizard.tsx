'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'

const TOTAL_STEPS = 5

interface FirmProfile {
  name: string
  gstNumber?: string | null
  panNumber?: string | null
  address?: string | null
  phone?: string | null
  industry?: string | null
}

interface Client {
  id: string
  name: string
  gstin?: string | null
  filerType: string
}

function ProgressBar({ step }: { step: number }) {
  const labels = ['Firm details', 'Clients', 'WhatsApp', 'Integrations', 'Done']
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              i + 1 < step ? 'bg-blue-600 text-white' :
              i + 1 === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
              'bg-gray-200 text-gray-500'
            }`}>
              {i + 1 < step ? '✓' : i + 1}
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">{label}</span>
          </div>
          {i < TOTAL_STEPS - 1 && <div className={`h-0.5 w-8 mt-[-12px] ${i + 1 < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

export function OnboardingWizard() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApiClient()

  const [step, setStep] = useState(1)
  const [provisioned, setProvisioned] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Firm profile state
  const [firm, setFirm] = useState<FirmProfile | null>(null)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [panNumber, setPanNumber] = useState('')

  // Clients state
  const [clients, setClients] = useState<Client[]>([])
  const [newClient, setNewClient] = useState({ name: '', gstin: '', filerType: 'MONTHLY' })
  const [addingClient, setAddingClient] = useState(false)

  // WhatsApp state
  const [waPhone, setWaPhone] = useState('')
  const [waSkipped, setWaSkipped] = useState(false)

  // Confirm user is provisioned and load firm profile
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.replace('/sign-in'); return }

    request<{ ok: boolean }>('/auth/register', { method: 'POST' })
      .then(() => {
        setProvisioned(true)
        return request<FirmProfile>('/settings/profile')
      })
      .then((profile) => {
        setFirm(profile)
        setPhone(profile.phone ?? '')
        setAddress(profile.address ?? '')
        setGstNumber(profile.gstNumber ?? '')
        setPanNumber(profile.panNumber ?? '')
      })
      .catch((err) => setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Account setup failed'))
  }, [isLoaded, isSignedIn, request, router])

  // Load existing clients for step 2
  useEffect(() => {
    if (step !== 2) return
    request<{ data: Client[] }>('/clients')
      .then((res) => setClients(res.data ?? []))
      .catch(() => { /* non-fatal */ })
  }, [step, request])

  if (!provisioned && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Setting up your account…</div>
      </div>
    )
  }

  async function saveFirmDetails() {
    setSaving(true)
    setError('')
    try {
      await request('/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          phone: phone || undefined,
          address: address || undefined,
          gstNumber: gstNumber || undefined,
          panNumber: panNumber || undefined,
        }),
      })
      setStep(2)
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function addClient() {
    if (!newClient.name.trim()) return
    setAddingClient(true)
    try {
      const created = await request<Client>('/clients', {
        method: 'POST',
        body: JSON.stringify(newClient),
      })
      setClients((prev) => [...prev, created])
      setNewClient({ name: '', gstin: '', filerType: 'MONTHLY' })
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Failed to add client')
    } finally {
      setAddingClient(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="text-2xl font-bold text-blue-600">OpsCopilot</div>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">Setup wizard</span>
        </div>

        <ProgressBar step={step} />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Step 1 — Confirm firm details */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Welcome to OpsCopilot</h2>
              <p className="text-sm text-gray-500 mt-1">Your account was set up by the OpsCopilot team. Please confirm your firm details.</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Firm name</p>
              <p className="text-base font-semibold text-gray-900">{firm?.name ?? '—'}</p>
              {firm?.gstNumber && <p className="text-xs text-gray-500 mt-1">GSTIN: {firm.gstNumber}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">GSTIN</label>
                <input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5" maxLength={15}
                  className="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">PAN</label>
                <input type="text" value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="AAAAA0000A" maxLength={10}
                  className="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Office address</label>
              <textarea value={address} rows={2} onChange={(e) => setAddress(e.target.value)}
                placeholder="Office address..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={saveFirmDetails} disabled={saving}
              className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Confirm & Continue →'}
            </button>
          </div>
        )}

        {/* Step 2 — Review clients */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your clients</h2>
              <p className="text-sm text-gray-500 mt-1">
                {clients.length > 0
                  ? `${clients.length} client${clients.length !== 1 ? 's' : ''} loaded. Add any missing ones.`
                  : 'No clients imported yet. Add your first client below.'}
              </p>
            </div>
            {clients.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                {clients.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className="text-xs text-gray-400">{c.gstin ?? c.filerType}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-600">Add a client</p>
              <input type="text" value={newClient.name} onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
                placeholder="Client name *"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={newClient.gstin} onChange={(e) => setNewClient((c) => ({ ...c, gstin: e.target.value.toUpperCase() }))}
                  placeholder="GSTIN (optional)" maxLength={15}
                  className="text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={newClient.filerType} onChange={(e) => setNewClient((c) => ({ ...c, filerType: e.target.value }))}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </div>
              <button onClick={addClient} disabled={addingClient || !newClient.name.trim()}
                className="w-full py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-60">
                {addingClient ? 'Adding…' : '+ Add client'}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">← Back</button>
              <button onClick={() => setStep(3)} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">
                {clients.length > 0 ? 'Looks good →' : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — WhatsApp (skippable) */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">WhatsApp setup</h2>
              <p className="text-sm text-gray-500 mt-1">Connect Twilio to send automated payment reminders and filing nudges.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-medium text-sm">Twilio Sandbox</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Create a free Twilio account at twilio.com</li>
                <li>Go to Messaging → Try it out → Send a WhatsApp message</li>
                <li>From your phone, send the sandbox join code to <span className="font-mono">+1 415 523 8886</span></li>
              </ol>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Your WhatsApp number (for test)</label>
              <input type="text" value={waPhone} onChange={(e) => setWaPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <p className="text-xs text-gray-400">
              You can configure full Twilio credentials (Account SID, Auth Token, number) from
              Settings → Integrations after setup.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">← Back</button>
              <button
                onClick={() => { setWaSkipped(true); setStep(4) }}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-xl hover:bg-gray-50">
                Skip
              </button>
              <button
                onClick={async () => {
                  if (waPhone.trim()) {
                    await request('/settings/profile', {
                      method: 'PATCH',
                      body: JSON.stringify({ phone: waPhone.trim() }),
                    }).catch(() => undefined)
                  }
                  setStep(4)
                }}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Tax integrations (skippable) */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tax filing software</h2>
              <p className="text-sm text-gray-500 mt-1">Connect your tax filing tool to sync documents automatically. You can do this later from Settings → Integrations.</p>
            </div>
            {[
              { key: 'CLEARTAX', label: 'ClearTax', desc: 'India\'s most popular GST filing platform' },
              { key: 'ZOHO_BOOKS', label: 'Zoho Books', desc: 'Accounting + GST returns in one place' },
              { key: 'TALLY', label: 'Tally', desc: 'On-premise Tally bridge integration' },
            ].map((p) => (
              <div key={p.key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 opacity-60 cursor-not-allowed">
                <div className="w-4 h-4 rounded border border-gray-300" />
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.label}</div>
                  <div className="text-xs text-gray-500">{p.desc}</div>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 text-center">Configure integrations from Settings → Integrations after setup.</p>
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">← Back</button>
              <button onClick={() => setStep(5)} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">Continue →</button>
            </div>
          </div>
        )}

        {/* Step 5 — Done */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">You&apos;re all set!</h2>
              <p className="text-sm text-gray-500 mt-1">Your workspace is ready. Here&apos;s a summary.</p>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Firm', value: firm?.name ?? '—' },
                { label: 'GSTIN', value: gstNumber || '—' },
                { label: 'Clients', value: clients.length > 0 ? `${clients.length} loaded` : 'None — add from Settings' },
                { label: 'WhatsApp', value: waSkipped || !waPhone ? 'Configure from Settings' : waPhone },
                { label: 'Tax integration', value: 'Configure from Settings' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                await request('/settings/complete-onboarding', { method: 'POST' }).catch(() => {})
                router.push('/dashboard')
              }}
              className="w-full py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700">
              Go to Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
