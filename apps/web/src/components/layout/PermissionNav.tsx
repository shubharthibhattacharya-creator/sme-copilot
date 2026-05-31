'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePermissions, type AppModule } from '@/contexts/permissions.context'

const NAV_ITEMS: { href: string; label: string; module: AppModule | null }[] = [
  { href: '/dashboard',    label: 'Dashboard',     module: 'dashboard' },
  { href: '/filings',      label: 'GST Filings',   module: 'compliance' },
  { href: '/collections',  label: 'Collections',   module: 'collections' },
  { href: '/documents',    label: 'Documents',     module: 'documents' },
  { href: '/reporting',    label: 'Reports',       module: 'reports' },
  { href: '/whatsapp',     label: 'WhatsApp',      module: 'whatsapp' },
  { href: '/assistant',    label: 'AI Assistant',  module: 'assistant' },
  { href: '/settings',     label: 'Settings',      module: 'settings' },
]

export function PermissionNav() {
  const { hasModule, loaded } = usePermissions()
  const pathname = usePathname()

  const visible = NAV_ITEMS.filter(({ module }) => !module || !loaded || hasModule(module))

  return (
    <nav className="space-y-1 flex-1">
      {visible.map(({ href, label }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`block px-3 py-2 rounded-md text-sm transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
