export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/toast'
import { UpgradeModal } from '@/components/ui/upgrade-modal'
import { PermissionsProvider } from '@/contexts/permissions.context'
import Image from 'next/image'
import { PermissionNav } from '@/components/layout/PermissionNav'
import { SidebarUserSection } from '@/components/layout/SidebarUserSection'
import { AccessDeniedHandler } from '@/components/auth/AccessDeniedHandler'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  const cookieStore = await cookies()
  const isImpersonating = !!cookieStore.get('impersonation_session')?.value
  if (!userId && !isImpersonating) redirect('/sign-in')

  try {
    const profile = await apiClient<{
      onboardingCompleted?: boolean
    }>('/api/v1/settings/profile', { cache: 'no-store' })

    if (!isImpersonating && !profile.onboardingCompleted) redirect('/onboarding')
  } catch {
    if (!isImpersonating) redirect('/onboarding')
  }

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
                width={200}
                height={70}
                style={{ objectFit: 'contain', objectPosition: 'left' }}
                priority
              />
            </div>

            {/* Nav */}
            <PermissionNav />
          </aside>

          {/* Right: top bar + content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Top header bar */}
            <header
              style={{
                height: 56,
                background: '#FFFFFF',
                borderBottom: '1px solid #E8EAF0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '0 28px',
                flexShrink: 0,
              }}
            >
              <SidebarUserSection />
            </header>

            <main className="flex-1 p-8" style={{ minWidth: 0 }}>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </div>
        <Suspense><AccessDeniedHandler /></Suspense>
        <Toaster />
        <UpgradeModal />
      </div>
    </PermissionsProvider>
  )
}
