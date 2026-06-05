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
            {/* Logo mark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '0 6px' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: '-0.5px',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(79,70,229,0.35)',
                }}
              >
                OC
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
                  OpsCopilot
                </p>
                {personaLabel && (
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, lineHeight: 1.3 }}>
                    {personaLabel}
                  </p>
                )}
              </div>
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
