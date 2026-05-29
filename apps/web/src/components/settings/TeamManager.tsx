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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-0.5">{team.length} member{team.length !== 1 ? 's' : ''}</p>
      </div>

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

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        To invite new team members, use the Clerk dashboard or contact support. Role changes take effect immediately.
      </div>
    </div>
  )
}
