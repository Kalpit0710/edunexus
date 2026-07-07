import type { Metadata } from 'next'
import { TeacherSidebar } from '@/components/teacher-sidebar'
import { AppInitializer } from '@/components/app-initializer'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <AppInitializer />
      <TeacherSidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}

