import { requireFeature } from '@/lib/plan-guard'

export default async function TeachersLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('teachers')
  return <>{children}</>
}
