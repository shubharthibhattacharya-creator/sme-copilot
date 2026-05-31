'use client'
import { useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from '@/components/ui/toast'

export function AccessDeniedHandler() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (params.get('access') === 'denied') {
      toast.error("Access denied", {
        description: "You don't have permission to view that page.",
      })
      // Strip the query param without a re-render loop
      const next = new URLSearchParams(params.toString())
      next.delete('access')
      const qs = next.toString()
      router.replace(pathname + (qs ? `?${qs}` : ''))
    }
    // Only run on mount or when the 'access' param appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('access')])

  return null
}
