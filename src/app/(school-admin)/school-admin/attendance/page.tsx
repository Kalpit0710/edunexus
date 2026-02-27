import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Attendance' }
export default function AttendancePage() {
  return <div className="p-8"><h1 className="text-3xl font-bold">Attendance</h1><p className="mt-2 text-muted-foreground">Milestone 1.7</p></div>
}
