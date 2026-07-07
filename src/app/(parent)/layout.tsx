import type { Metadata } from 'next'
import { ParentSidebar } from '@/components/parent-sidebar'
import { AppInitializer } from '@/components/app-initializer'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <AppInitializer />
      <ParentSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
    </div>
  )
}
