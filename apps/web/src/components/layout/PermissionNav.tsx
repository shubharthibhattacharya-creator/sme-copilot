'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileCheck2,
  CreditCard,
  FolderOpen,
  BarChart2,
  MessageSquare,
  Bot,
  Settings,
} from 'lucide-react'
import { usePermissions, type AppModule } from '@/contexts/permissions.context'

const NAV_ITEMS: { href: string; label: string; module: AppModule | null; icon: React.ElementType }[] = [
  { href: '/dashboard',    label: 'Dashboard',    module: 'dashboard',   icon: LayoutDashboard },
  { href: '/filings',      label: 'GST Filings',  module: 'compliance',  icon: FileCheck2 },
  { href: '/collections',  label: 'Collections',  module: 'collections', icon: CreditCard },
  { href: '/documents',    label: 'Documents',    module: 'documents',   icon: FolderOpen },
  { href: '/reporting',    label: 'Reports',      module: 'reports',     icon: BarChart2 },
  { href: '/whatsapp',     label: 'WhatsApp',     module: 'whatsapp',    icon: MessageSquare },
  { href: '/assistant',    label: 'AI Assistant', module: 'assistant',   icon: Bot },
  { href: '/settings',     label: 'Settings',     module: 'settings',    icon: Settings },
]

export function PermissionNav() {
  const { hasModule, loaded } = usePermissions()
  const pathname = usePathname()

  const visible = NAV_ITEMS.filter(({ module }) => !module || !loaded || hasModule(module))

  return (
    <nav className="space-y-1 flex-1">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
