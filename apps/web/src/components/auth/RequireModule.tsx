'use client'
import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions, type AppModule } from '@/contexts/permissions.context'

export function RequireModule({ module, children }: { module: AppModule; children: ReactNode }) {
  const { hasModule, loaded } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (loaded && !hasModule(module)) {
      router.replace('/dashboard?access=denied')
    }
  }, [loaded, module, hasModule, router])

  if (!loaded) return null
  if (!hasModule(module)) return null

  return <>{children}</>
}
