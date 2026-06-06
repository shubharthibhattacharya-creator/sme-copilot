'use client'

import { Users } from 'lucide-react'

interface WorkloadEntry {
  userId: string
  name: string
  email: string
  role: string
  clientCount: number
  openDocuments: number
  overdueInvoices: number
  pendingChecklists: number
  totalOpen: number
}

interface Props {
  entries: WorkloadEntry[]
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  OPERATIONS_MANAGER: 'Ops Manager',
  STAFF: 'Staff',
}

function loadLabel(total: number): { label: string; color: string; barColor: string; width: number } {
  if (total === 0) return { label: 'No work', color: '#94A3B8', barColor: '#E2E8F0', width: 5 }
  if (total <= 5) return { label: 'Light', color: '#16A34A', barColor: '#86EFAC', width: 20 }
  if (total <= 12) return { label: 'Balanced', color: '#0891B2', barColor: '#67E8F9', width: 45 }
  if (total <= 20) return { label: 'Busy', color: '#D97706', barColor: '#FCD34D', width: 70 }
  return { label: 'Overloaded', color: '#DC2626', barColor: '#FCA5A5', width: 100 }
}

export function WorkloadClient({ entries }: Props) {
  const totalOpen = entries.reduce((s, e) => s + e.totalOpen, 0)
  const totalClients = entries.reduce((s, e) => s + e.clientCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>Team Workload</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>
            {entries.length} team member{entries.length !== 1 ? 's' : ''} · {totalClients} clients · {totalOpen} open items
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E8EAF0',
            borderRadius: 16,
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Users size={32} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>No team members found</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E8EAF0', borderRadius: 16, overflow: 'hidden' }}>
          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 160px',
              padding: '10px 20px',
              background: '#F8FAFC',
              borderBottom: '1px solid #E8EAF0',
            }}
          >
            {['Member', 'Role', 'Clients', 'Documents', 'Invoices', 'Filings', 'Load'].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {h}
              </span>
            ))}
          </div>

          {entries.map((e, idx) => {
            const load = loadLabel(e.totalOpen)
            return (
              <div
                key={e.userId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 160px',
                  padding: '14px 20px',
                  alignItems: 'center',
                  borderBottom: idx < entries.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}
              >
                {/* Member */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {e.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', margin: 0 }}>{e.name}</p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{e.email}</p>
                  </div>
                </div>

                {/* Role */}
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {ROLE_LABELS[e.role] ?? e.role}
                </span>

                {/* Clients */}
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{e.clientCount}</span>

                {/* Open docs */}
                <span style={{ fontSize: 13, color: e.openDocuments > 0 ? '#7C3AED' : '#94A3B8', fontWeight: e.openDocuments > 0 ? 600 : 400 }}>
                  {e.openDocuments}
                </span>

                {/* Overdue invoices */}
                <span style={{ fontSize: 13, color: e.overdueInvoices > 0 ? '#DC2626' : '#94A3B8', fontWeight: e.overdueInvoices > 0 ? 600 : 400 }}>
                  {e.overdueInvoices}
                </span>

                {/* Pending checklists */}
                <span style={{ fontSize: 13, color: e.pendingChecklists > 0 ? '#0891B2' : '#94A3B8', fontWeight: e.pendingChecklists > 0 ? 600 : 400 }}>
                  {e.pendingChecklists}
                </span>

                {/* Load bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${load.width}%`,
                        background: load.barColor,
                        borderRadius: 3,
                        transition: 'width 400ms ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: load.color, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                    {load.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Unassigned clients note */}
      <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
        Clients with no owner are visible to Admin and Ops Manager only. Assign owners in Settings → Clients.
      </p>
    </div>
  )
}
