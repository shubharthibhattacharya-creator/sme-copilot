'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-xl w-full bg-white rounded-xl border border-red-200 p-6 space-y-4">
            <h1 className="text-lg font-semibold text-red-700">Something went wrong</h1>
            <pre className="text-xs bg-red-50 p-4 rounded overflow-auto whitespace-pre-wrap break-all text-red-800">
              {error?.message ?? 'Unknown error'}
              {'\n\n'}
              {error?.stack ?? ''}
            </pre>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
