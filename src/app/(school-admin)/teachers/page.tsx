import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Teachers' }
export default function TeachersPage() {
  return <div className="p-8"><h1 className="text-3xl font-bold">Teachers</h1><p className="mt-2 text-muted-foreground">Milestone 1.6</p></div>
}
