export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { RequireModule } from '@/components/auth/RequireModule'

const NAV = [
  { href: '/settings/profile', label: 'Firm Profile' },
  { href: '/settings/clients', label: 'Clients' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/rules', label: 'Business Rules' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/filing-templates', label: 'Filing Templates' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireModule module="settings">
      <div className="flex gap-6">
        <aside className="w-48 shrink-0">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Settings</h2>
          <nav className="space-y-1">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href}
                className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </RequireModule>
  )
}
