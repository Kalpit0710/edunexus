import { ContentAreaLoader } from '@/components/loaders/page-loaders'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 shimmer rounded-lg" />
      <ContentAreaLoader label="Loading pricing…" />
    </div>
  )
}
