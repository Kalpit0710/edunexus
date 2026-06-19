import { requireFeature } from '@/lib/plan-guard'

export default async function TransportLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('students')
  return <>{children}</>
}
