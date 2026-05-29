'use client'
import { useState } from 'react'
import { useApiClient } from '@/lib/client-api'

interface FirmProfile {
  id: string
  name: string
  industry: string
  subscriptionPlan: string
  logoUrl: string | null
  gstNumber: string | null
  panNumber: string | null
  address: string | null
  website: string | null
  phone: string | null
  createdAt: string
}

export function ProfileForm({ profile }: { profile: FirmProfile }) {
  const { request } = useApiClient()
  const [form, setForm] = useState({
    name: profile.name,
    gstNumber: profile.gstNumber ?? '',
    panNumber: profile.panNumber ?? '',
    address: profile.address ?? '',
    phone: profile.phone ?? '',
    website: profile.website ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
    setError('')
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await request('/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Firm Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Update your firm details and compliance information.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Firm name */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Firm name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* GST */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">GSTIN</label>
            <input
              type="text"
              value={form.gstNumber}
              onChange={(e) => set('gstNumber', e.target.value.toUpperCase())}
              placeholder="29AABCS1429B1Z4"
              maxLength={15}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* PAN */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">PAN</label>
            <input
              type="text"
              value={form.panNumber}
              onChange={(e) => set('panNumber', e.target.value.toUpperCase())}
              placeholder="AABCS1429B"
              maxLength={10}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              placeholder="https://example.com"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Address</label>
          <textarea
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            rows={3}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Saved successfully.</p>}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-400 space-y-0.5">
            <p>Plan: <span className="font-medium text-gray-600">{profile.subscriptionPlan}</span></p>
            <p>Industry: <span className="font-medium text-gray-600">{profile.industry.replace('_', ' ')}</span></p>
            <p>Member since: <span className="font-medium text-gray-600">{new Date(profile.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}</span></p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
