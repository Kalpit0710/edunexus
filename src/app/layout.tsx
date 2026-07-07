import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/sonner'
import { ImpersonationBanner } from '@/components/impersonation-banner'
import { NavigationProgress } from '@/components/navigation-progress'
import { PwaRegister } from '@/components/pwa-register'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

export const metadata: Metadata = {
  title: {
    default: 'EduNexus — School Management System',
    template: '%s | EduNexus',
  },
  description: 'Modern school management system for the next generation of learning institutions.',
  keywords: ['school management', 'EduNexus', 'education', 'students', 'teachers'],
  authors: [{ name: 'EduNexus Team' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
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
        <PwaRegister />
        <NavigationProgress />
        <ImpersonationBanner />
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
