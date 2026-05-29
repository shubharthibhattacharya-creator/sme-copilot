import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Validate ADMIN_SECRET length on startup
  async headers() {
    const secret = process.env.ADMIN_SECRET
    if (secret && secret.length < 32) {
      throw new Error('ADMIN_SECRET must be at least 32 characters')
    }
    return []
  },
}

export default nextConfig
