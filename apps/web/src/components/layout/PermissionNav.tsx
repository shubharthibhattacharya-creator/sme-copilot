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
  GitMerge,
} from 'lucide-react'
import { usePermissions, type AppModule } from '@/contexts/permissions.context'

interface NavItem {
  href: string
  label: string
  module: AppModule | null
  icon: React.ElementType
  iconColor: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',      label: 'Dashboard',     module: 'dashboard',   icon: LayoutDashboard, iconColor: '#2563EB' },
  { href: '/filings',        label: 'GST Filings',   module: 'compliance',  icon: FileCheck2,      iconColor: '#16A34A' },
  { href: '/collections',    label: 'Collections',   module: 'collections', icon: CreditCard,      iconColor: '#D97706' },
  { href: '/documents',      label: 'Documents',     module: 'documents',   icon: FolderOpen,      iconColor: '#7C3AED' },
  { href: '/reconciliation', label: 'GSTR-2B Recon', module: 'documents',   icon: GitMerge,        iconColor: '#0891B2' },
  { href: '/reporting',      label: 'Reports',       module: 'reports',     icon: BarChart2,       iconColor: '#4F46E5' },
  { href: '/whatsapp',       label: 'WhatsApp',      module: 'whatsapp',    icon: MessageSquare,   iconColor: '#16A34A' },
  { href: '/assistant',      label: 'AI Assistant',  module: 'assistant',   icon: Bot,             iconColor: '#8B5CF6' },
  { href: '/settings',       label: 'Settings',      module: 'settings',    icon: Settings,        iconColor: '#64748B' },
]

export function PermissionNav() {
  const { hasModule, loaded } = usePermissions()
  const pathname = usePathname()

  const visible = NAV_ITEMS.filter(({ module }) => !module || !loaded || hasModule(module))

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
      {visible.map(({ href, label, icon: Icon, iconColor }) => {
        const active =
          pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? '#FFFFFF' : '#374151',
              background: active
                ? 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)'
                : 'transparent',
              textDecoration: 'none',
              transition: 'background 150ms, color 150ms',
              boxShadow: active ? '0 1px 4px rgba(79,70,229,0.25)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#F1F5F9'
            }}
            onMouseLeave={(e) => {
              if (!active)
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
            }}
          >
            <Icon
              size={16}
              strokeWidth={active ? 2.25 : 1.75}
              color={active ? '#FFFFFF' : iconColor}
              style={{ flexShrink: 0 }}
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
