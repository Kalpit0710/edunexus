import { requireFeature } from '@/lib/plan-guard'

export default async function SchoolHomeworkLayout({ children }: { children: React.ReactNode }) {
  await requireFeature('teachers')
  return children
}
