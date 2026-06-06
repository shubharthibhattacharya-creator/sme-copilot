export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { INDUSTRY_DEFAULTS, type IndustryType } from '@opsc/types'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/toast'
import { UpgradeModal } from '@/components/ui/upgrade-modal'
import { PermissionsProvider } from '@/contexts/permissions.context'
import Image from 'next/image'
import { PermissionNav } from '@/components/layout/PermissionNav'
import { SidebarUserSection } from '@/components/layout/SidebarUserSection'
import { AccessDeniedHandler } from '@/components/auth/AccessDeniedHandler'

const PERSONA_LABELS: Record<IndustryType, string> = {
  CA_FIRM:      'CA / Tax Firm',
  DISTRIBUTOR:  'Distributor',
  MANUFACTURER: 'Manufacturer',
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

  const personaLabel = industry ? PERSONA_LABELS[industry] : null

  return (
    <PermissionsProvider>
      <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <ImpersonationBanner />
        <div className="flex flex-1">

          {/* Sidebar */}
          <aside
            style={{
              width: 240,
              minWidth: 240,
              background: '#FFFFFF',
              borderRight: '1px solid #E8EAF0',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 12px 16px',
            }}
          >
            {/* Logo */}
            <div style={{ marginBottom: 24, padding: '0 4px' }}>
              <Image
                src="/practora-logo.png"
                alt="Practora"
                width={160}
                height={56}
                style={{ objectFit: 'contain', objectPosition: 'left' }}
                priority
              />
            </div>

            {/* Nav */}
            <PermissionNav />

            {/* Bottom user section */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
              <SidebarUserSection personaLabel={personaLabel} />
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
