import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Students' }
export default function StudentsPage() {
  return <div className="p-8"><h1 className="text-3xl font-bold">Students</h1><p className="mt-2 text-muted-foreground">Milestone 1.5</p></div>
}
