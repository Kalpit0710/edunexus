import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Super Admin Dashboard',
}

export default function SuperAdminDashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Platform-wide management — Milestone 1.3
      </p>
    </div>
  )
}
