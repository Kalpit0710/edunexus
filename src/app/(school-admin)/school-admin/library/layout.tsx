import { requireFeature } from '@/lib/plan-guard'

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('inventory')
  return <>{children}</>
}
