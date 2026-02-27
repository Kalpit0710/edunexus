import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default function SchoolAdminDashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">School Admin Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Overview — Milestone 1.9</p>
    </div>
  )
}
