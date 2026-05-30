'use client'

import { useEffect } from 'react'

/**
 * Next.js root error boundary (error.tsx).
 * Production-safe: never shows stack traces or internal error detail to users.
 * Technical detail is logged to the console for engineers only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log full detail for engineers — never display to users
    console.error('[GlobalError]', error)
  }, [error])

  const isProd = process.env['NODE_ENV'] === 'production'

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-xl w-full bg-white rounded-xl border border-red-200 p-6 space-y-4">
            <h1 className="text-lg font-semibold text-red-700">Something went wrong</h1>
            <p className="text-sm text-slate-600">
              An unexpected error occurred. Try refreshing the page. If the problem
              continues, please contact{' '}
              <a
                href="mailto:support@opscopilot.in"
                className="underline text-blue-600 hover:text-blue-700"
              >
                support@opscopilot.in
              </a>
              .
            </p>

            {/* Only show technical detail in non-production environments */}
            {!isProd && error?.message && (
              <pre className="text-xs bg-red-50 p-4 rounded overflow-auto whitespace-pre-wrap break-all text-red-800">
                {error.message}
              </pre>
            )}

            {/* digest is a safe opaque ID that engineers can look up — fine to show */}
            {error?.digest && (
              <p className="text-xs text-slate-400">Reference: {error.digest}</p>
            )}

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
