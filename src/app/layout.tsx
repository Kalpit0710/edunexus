import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/sonner'
import { ImpersonationBanner } from '@/components/impersonation-banner'
import { NavigationProgress } from '@/components/navigation-progress'
import { PwaRegister } from '@/components/pwa-register'
import { JsonLd } from '@/components/json-ld'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.app'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1d4ed8' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'EduNexus — School Management System',
    template: '%s | EduNexus',
  },
  description:
    'EduNexus is a modern, all-in-one school management system. Manage students, teachers, fees, attendance, exams, report cards, and more — all in one secure platform.',
  keywords: [
    'school management system',
    'school ERP',
    'student management',
    'fee management',
    'attendance tracking',
    'report card',
    'teacher management',
    'education software',
    'school administration',
    'EduNexus',
    'school SaaS',
    'multi-tenant school platform',
  ],
  authors: [{ name: 'EduNexus', url: APP_URL }],
  creator: 'EduNexus',
  publisher: 'EduNexus',
  category: 'Education',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    siteName: 'EduNexus',
    title: 'EduNexus — School Management System',
    description:
      'EduNexus is a modern, all-in-one school management system. Manage students, teachers, fees, attendance, exams, report cards, and more — all in one secure platform.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'EduNexus — School Management System',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@edunexus',
    creator: '@edunexus',
    title: 'EduNexus — School Management System',
    description:
      'Modern all-in-one school management: students, fees, attendance, exams & more.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: APP_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <JsonLd />
        <PwaRegister />
        <NavigationProgress />
        <ImpersonationBanner />
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
