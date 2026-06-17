import { requireFeature } from '@/lib/plan-guard'

export default async function ExamsLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('exams')
  return <>{children}</>
}
