import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Quiet during local builds; verbose in CI.
  silent: !process.env.CI,
  // Upload a wider set of client bundles for better stack traces.
  widenClientFileUpload: true,
  // Source-map upload is skipped automatically unless SENTRY_AUTH_TOKEN is set.
})
