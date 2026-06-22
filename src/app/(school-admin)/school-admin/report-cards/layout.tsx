import { requireFeature } from '@/lib/plan-guard'

export default async function ReportCardsLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('exams')
  return <>{children}</>
}
