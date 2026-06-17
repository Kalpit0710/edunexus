import { requireFeature } from '@/lib/plan-guard'

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('reports')
  return <>{children}</>
}
