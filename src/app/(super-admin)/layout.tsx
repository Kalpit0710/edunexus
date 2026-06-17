import { SuperAdminSidebar } from '@/components/super-admin-sidebar'
import { AppInitializer } from '@/components/app-initializer'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AppInitializer />
      <SuperAdminSidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
