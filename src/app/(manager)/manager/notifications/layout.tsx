import { requireFeature } from '@/lib/plan-guard'

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('communication')
  return children
}
