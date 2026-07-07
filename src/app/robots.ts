import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/create-account', '/register-school', '/reset-password'],
        disallow: [
          '/school-admin/',
          '/teacher/',
          '/parent/',
          '/manager/',
          '/super-admin/',
          '/api/',
          '/auth/',
          '/subscription-inactive',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
