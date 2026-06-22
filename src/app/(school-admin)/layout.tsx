import { SchoolAdminSidebar } from '@/components/school-admin-sidebar'
import { AppInitializer } from '@/components/app-initializer'

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <AppInitializer />
      <SchoolAdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}

