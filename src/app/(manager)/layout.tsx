import { ManagerSidebar } from '@/components/manager-sidebar'
import { AppInitializer } from '@/components/app-initializer'

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AppInitializer />
      <ManagerSidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}

