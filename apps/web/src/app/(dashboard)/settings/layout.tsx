import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function getUserRole(token: string) {
  const res = await fetch(`${API_URL}/api/v1/settings/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  // role is in the auth token — check team endpoint
  const teamRes = await fetch(`${API_URL}/api/v1/settings/team`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return teamRes.ok ? 'ADMIN' : 'STAFF'
}

const NAV = [
  { href: '/settings/profile', label: 'Firm Profile' },
  { href: '/settings/clients', label: 'Clients' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/rules', label: 'Business Rules' },
  { href: '/settings/integrations', label: 'Integrations' },
]

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) redirect('/sign-in')

  return (
    <div className="flex gap-6">
      {/* Left sidebar */}
      <aside className="w-48 shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Settings</h2>
        <nav className="space-y-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
