export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    })
  }
}

export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string },
) => {
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureException(err, { extra: { path: request.path, method: request.method } })
}
