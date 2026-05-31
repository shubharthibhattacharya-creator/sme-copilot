export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { apiClient } from '@/lib/api-client'
import { INDUSTRY_DEFAULTS, type IndustryType } from '@opsc/types'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/toast'
import { UpgradeModal } from '@/components/ui/upgrade-modal'
import { PermissionsProvider } from '@/contexts/permissions.context'
import { PermissionNav } from '@/components/layout/PermissionNav'
import { AccessDeniedHandler } from '@/components/auth/AccessDeniedHandler'

const PERSONA_LABELS: Record<IndustryType, { label: string; color: string }> = {
  CA_FIRM:      { label: 'CA / Tax Firm',  color: 'bg-blue-50 text-blue-700' },
  DISTRIBUTOR:  { label: 'Distributor',    color: 'bg-amber-50 text-amber-700' },
  MANUFACTURER: { label: 'Manufacturer',  color: 'bg-green-50 text-green-700' },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  const cookieStore = await cookies()
  const isImpersonating = !!cookieStore.get('impersonation_session')?.value
  if (!userId && !isImpersonating) redirect('/sign-in')

  let industry: IndustryType | null = null
  try {
    const profile = await apiClient<{
      industry?: string | null
      onboardingCompleted?: boolean
    }>('/api/v1/settings/profile', { cache: 'no-store' })

    if (!isImpersonating && !profile.onboardingCompleted) redirect('/onboarding')

    if (profile.industry && profile.industry in INDUSTRY_DEFAULTS) {
      industry = profile.industry as IndustryType
    }
  } catch {
    if (!isImpersonating) redirect('/onboarding')
  }

  const persona = industry ? PERSONA_LABELS[industry] : null

  return (
    <PermissionsProvider>
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

            <PermissionNav />

            <div className="pt-4 border-t border-slate-200 flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <span className="text-sm text-slate-500">Account</span>
            </div>
          </aside>

          <main className="flex-1 p-8">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
        <Suspense><AccessDeniedHandler /></Suspense>
        <Toaster />
        <UpgradeModal />
      </div>
    </PermissionsProvider>
  )
}
