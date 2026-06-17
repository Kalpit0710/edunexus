import { requireFeature } from '@/lib/plan-guard'

export default async function FeesLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('fees')
  return <>{children}</>
}
