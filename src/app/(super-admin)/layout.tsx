import type { Metadata } from 'next'
import { SuperAdminSidebar } from '@/components/super-admin-sidebar'
import { AppInitializer } from '@/components/app-initializer'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <AppInitializer />
      <SuperAdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
