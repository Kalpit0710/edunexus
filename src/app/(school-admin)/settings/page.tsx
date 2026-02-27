import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'School Settings' }
export default function SettingsPage() {
  return <div className="p-8"><h1 className="text-3xl font-bold">School Settings</h1><p className="mt-2 text-muted-foreground">Milestone 1.4</p></div>
}
