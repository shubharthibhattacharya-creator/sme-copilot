'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]!) : undefined
}

export function ImpersonationBanner() {
  const [firmName, setFirmName] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const val = getCookie('impersonation_session')
    if (val) {
      const name = decodeURIComponent(val.split(':').slice(1).join(':'))
      setFirmName(name || 'Unknown firm')
    }
  }, [])

  function endSession() {
    document.cookie = 'impersonation_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    router.push('/dashboard')
    router.refresh()
  }

  if (!firmName) return null

  return (
    <div className="w-full bg-orange-500 text-white text-sm flex items-center justify-between px-6 py-2.5 z-50">
      <div className="flex items-center gap-2">
        <span className="text-orange-200 font-medium">⚠ Admin view:</span>
        <span className="font-semibold">{firmName}</span>
        <span className="text-orange-200">— you are viewing as this tenant</span>
      </div>
      <button
        onClick={endSession}
        className="text-xs bg-orange-700 hover:bg-orange-600 px-3 py-1 rounded-md font-medium transition-colors"
      >
        End session
      </button>
    </div>
  )
}
