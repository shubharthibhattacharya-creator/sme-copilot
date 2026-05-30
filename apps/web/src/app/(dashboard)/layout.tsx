export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { apiClient } from '@/lib/api-client'
import { INDUSTRY_DEFAULTS, type IndustryType, type ModuleKey } from '@opsc/types'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/toast'
import { UpgradeModal } from '@/components/ui/upgrade-modal'

interface NavItem {
  href: string
  label: string
  module: ModuleKey | null
}

const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',      module: 'dashboard' },
  { href: '/filings',     label: 'GST Filings',    module: 'filings' },
  { href: '/collections', label: 'Collections',    module: 'collections' },
  { href: '/inventory',   label: 'Inventory',      module: 'inventory' },
  { href: '/documents',   label: 'Documents',      module: 'documents' },
  { href: '/reporting',   label: 'Reports',        module: 'reporting' },
  { href: '/whatsapp',    label: 'WhatsApp',       module: 'whatsapp' },
  { href: '/assistant',   label: 'AI Assistant',   module: 'assistant' },
  { href: '/settings',    label: 'Settings',       module: null },
]

const PERSONA_LABELS: Record<IndustryType, { label: string; color: string }> = {
  CA_FIRM:      { label: 'CA / Tax Firm',  color: 'bg-blue-50 text-blue-700' },
  DISTRIBUTOR:  { label: 'Distributor',    color: 'bg-amber-50 text-amber-700' },
  MANUFACTURER: { label: 'Manufacturer',  color: 'bg-green-50 text-green-700' },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  const cookieStore = await cookies()
  const isImpersonating = !!cookieStore.get('impersonation_session')?.value
  if (!userId && !isImpersonating) redirect('/sign-in')

  // Fetch company profile to get industry + enabled modules
  let industry: IndustryType | null = null
  let enabledModules: ModuleKey[] | null = null
  try {
    const profile = await apiClient<{
      industry?: string | null
      modulesEnabled?: string[]
      onboardingCompleted?: boolean
    }>('/api/v1/settings/profile', { cache: 'no-store' })

    // Redirect to onboarding if not yet completed (skip for admin impersonation)
    if (!isImpersonating && !profile.onboardingCompleted) {
      redirect('/onboarding')
    }

    if (profile.industry && profile.industry in INDUSTRY_DEFAULTS) {
      industry = profile.industry as IndustryType
    }
    // Use per-tenant modulesEnabled from DB; fall back to industry defaults
    if (Array.isArray(profile.modulesEnabled) && profile.modulesEnabled.length > 0) {
      enabledModules = profile.modulesEnabled as ModuleKey[]
    } else if (industry) {
      enabledModules = INDUSTRY_DEFAULTS[industry].modulesEnabled
    }
  } catch {
    // API unavailable or user not provisioned — redirect to onboarding
    if (!isImpersonating) redirect('/onboarding')
  }

  const navItems = ALL_NAV_ITEMS.filter(({ module }) =>
    module === null || enabledModules === null || enabledModules.includes(module),
  )

  const persona = industry ? PERSONA_LABELS[industry] : null

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <ImpersonationBanner />
    <div className="flex flex-1">
      <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col">
        <div className="mb-6">
          <div className="text-lg font-bold text-blue-600">OpsCopilot</div>
          {persona && (
            <span className={`mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${persona.color}`}>
              {persona.label}
            </span>
          )}
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="block px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-100"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="pt-4 border-t border-slate-200 flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <span className="text-sm text-slate-500">Account</span>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
    <Toaster />
    <UpgradeModal />
    </div>
  )
}
