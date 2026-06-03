import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  transpilePackages: ['@opsc/types', '@opsc/config'],
  // Standalone output bundles only what's needed — smaller Docker image
  output: 'standalone',
}

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  // Source map upload requires SENTRY_AUTH_TOKEN — disabled until configured
  sourcemaps: { disable: !process.env['SENTRY_AUTH_TOKEN'] },
  telemetry: false,
})
