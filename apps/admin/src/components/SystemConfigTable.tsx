'use client'
import { useState } from 'react'
import type { ConfigRow } from '@/lib/admin-api'

const API = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:3001'
const SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''

const CATEGORY_ORDER = ['COLLECTIONS','AI_INSIGHTS','GST_COMPLIANCE','DOCUMENTS','REPORTS','WHATSAPP']

export function SystemConfigTable({ initialConfig }: { initialConfig: ConfigRow[] }) {
  const [config, setConfig] = useState(initialConfig)

  async function handleUpdate(key: string, value: unknown) {
    await fetch(`${API}/api/v1/admin/system-config/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': SECRET },
      body: JSON.stringify({ value }),
    })
    setConfig((prev) => prev.map((r) => r.key === key ? { ...r, value } : r))
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, ConfigRow[]>>((acc, cat) => {
    acc[cat] = config.filter((r) => r.category === cat)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {CATEGORY_ORDER.map((cat) => {
        const rows = grouped[cat] ?? []
        if (rows.length === 0) return null
        return (
          <div key={cat} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/40">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{cat.replace(/_/g, ' ')}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Label','Key','Value','Type','Range'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((row) => (
                  <SysConfigRow key={row.key} row={row} onUpdate={(v) => handleUpdate(row.key, v)} />
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function SysConfigRow({ row, onUpdate }: { row: ConfigRow; onUpdate: (v: unknown) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(row.value))

  function save() {
    let v: unknown = draft
    if (row.dataType === 'NUMBER') v = parseFloat(draft)
    if (row.dataType === 'BOOLEAN') v = draft === 'true'
    if (row.dataType === 'JSON') { try { v = JSON.parse(draft) } catch { return } }
    onUpdate(v)
    setEditing(false)
  }

  const range = [row.minValue, row.maxValue].filter(Boolean).join('–')

  return (
    <tr className="hover:bg-gray-800/30">
      <td className="px-4 py-2.5 text-white text-xs font-medium">
        {row.label}
        {row.unit && <span className="text-gray-500 ml-1">({row.unit})</span>}
        {row.description && <div className="text-gray-500 font-normal mt-0.5">{row.description}</div>}
      </td>
      <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">{row.key}</td>
      <td className="px-4 py-2.5">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
              className="bg-gray-800 border border-gray-600 text-white rounded px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button onClick={save} className="text-xs text-indigo-400 hover:text-indigo-300">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500">×</button>
          </div>
        ) : (
          <button
            onClick={() => { setDraft(String(row.value)); setEditing(true) }}
            className="text-xs text-white hover:text-indigo-300 text-left"
          >
            {String(row.value)}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-gray-500 text-xs">{row.dataType}</td>
      <td className="px-4 py-2.5 text-gray-500 text-xs">{range || '—'}</td>
    </tr>
  )
}
