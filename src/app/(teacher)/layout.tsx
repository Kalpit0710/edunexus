import { TeacherSidebar } from '@/components/teacher-sidebar'
import { AppInitializer } from '@/components/app-initializer'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppInitializer />
      <TeacherSidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
