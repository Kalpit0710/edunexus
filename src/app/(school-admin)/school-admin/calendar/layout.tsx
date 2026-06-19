import { requireFeature } from '@/lib/plan-guard'

export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('attendance')
  return <>{children}</>
}
