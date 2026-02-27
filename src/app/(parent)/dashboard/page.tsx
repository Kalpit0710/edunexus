import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Parent Portal' }
export default function ParentDashboardPage() {
  return <div className="p-8"><h1 className="text-3xl font-bold">Parent Portal</h1><p className="mt-2 text-muted-foreground">Phase 2</p></div>
}
