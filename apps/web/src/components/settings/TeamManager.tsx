'use client'
import { useState } from 'react'
import { useApiClient } from '@/lib/client-api'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'
  createdAt: string
}

const ROLES: TeamMember['role'][] = ['ADMIN', 'OPERATIONS_MANAGER', 'STAFF']
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  STAFF: 'Staff',
}

export function TeamManager({ initialTeam }: { initialTeam: TeamMember[] }) {
  const { request } = useApiClient()
  const [team, setTeam] = useState(initialTeam)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('STAFF')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError, setInviteError] = useState('')

  async function changeRole(userId: string, role: TeamMember['role']) {
    setUpdatingRole(userId)
    try {
      await request(`/settings/team/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      setTeam((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setUpdatingRole(null)
    }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      await request('/settings/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('STAFF')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-0.5">{team.length} member{team.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Current members */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Email', 'Role', 'Member since'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {team.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>
                <td className="px-4 py-3 text-gray-600">{member.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={member.role}
                    onChange={(e) => changeRole(member.id, e.target.value as TeamMember['role'])}
                    disabled={updatingRole === member.id}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(member.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Send invitation</h2>
        <p className="text-xs text-gray-500">The invited person will receive an email with a link to create their account and join your firm.</p>
        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@yourfirm.com"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as TeamMember['role'])}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
          >
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        {inviteSuccess && <p className="text-sm text-green-600">{inviteSuccess}</p>}
        {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
      </div>
    </div>
  )
}
