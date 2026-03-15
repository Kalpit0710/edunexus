'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getLatestAnnouncements, type AnnouncementRow } from '../actions'
import { Megaphone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function AnnouncementsPage() {
  const { school, activeChildId } = useAuthStore()
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!school?.id) return
    setLoading(true)
    // classId derived from child — for now pass through as we don't have it here directly
    getLatestAnnouncements(school.id).then(data => {
      setAnnouncements(data)
      setLoading(false)
    })
  }, [school?.id, activeChildId])

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-rose-500" /> Announcements
      </h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground mt-16">
          <Megaphone className="h-12 w-12 opacity-30" />
          <p className="text-sm">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <Card key={a.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight">{a.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{a.body}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(a.createdAt)}</span>
                    {a.targetAudience && a.targetAudience !== 'all' && (
                      <Badge variant="secondary" className="text-[10px]">{a.targetAudience}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
