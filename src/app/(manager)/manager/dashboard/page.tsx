import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Manager Dashboard' }
export default function ManagerDashboardPage() {
  return <div className="p-8"><h1 className="text-3xl font-bold">Manager Dashboard</h1><p className="mt-2 text-muted-foreground">Milestone 1.3</p></div>
}
