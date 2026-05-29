import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@opsc/types', '@opsc/config'],
  // Standalone output bundles only what's needed — smaller Docker image
  output: 'standalone',
}

export default nextConfig
