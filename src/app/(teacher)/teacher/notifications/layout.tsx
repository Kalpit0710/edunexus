import { requireFeature } from '@/lib/plan-guard'

export default async function TeacherNotificationsLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('communication')
  return children
}
