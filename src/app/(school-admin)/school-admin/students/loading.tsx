import { TableSkeleton } from '@/components/loaders/page-loaders'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 shimmer rounded-lg" />
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <TableSkeleton rows={8} columns={5} aria-label="Loading students" />
      </div>
    </div>
  )
}
