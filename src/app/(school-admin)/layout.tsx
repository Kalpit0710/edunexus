export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar will be added in Milestone 1.3 */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
