'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getLatestAnnouncements, type AnnouncementRow } from '../actions'
import { Megaphone, Bell } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

const AUDIENCE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  parents: { color: '#3b82f6', bg: '#3b82f620', border: '#3b82f630' },
  students: { color: '#8b5cf6', bg: '#8b5cf620', border: '#8b5cf630' },
  teachers: { color: '#f59e0b', bg: '#f59e0b20', border: '#f59e0b30' },
  all: { color: '#10b981', bg: '#10b98120', border: '#10b98130' },
}

export default function AnnouncementsPage() {
  const { school, activeChildId } = useAuthStore()
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!school?.id) return
    setLoading(true)
    getLatestAnnouncements(school.id).then(data => {
      setAnnouncements(data)
      setLoading(false)
    })
  }, [school?.id, activeChildId])

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10">
          <Megaphone className="h-5 w-5 text-rose-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Announcements</h1>
          <p className="text-xs text-zinc-500">School notices and updates</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl bg-white/5" />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center gap-3 mt-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Bell className="h-8 w-8 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500">No announcements yet.</p>
          <p className="text-xs text-zinc-600">Check back later for school notices.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const audienceStyle = AUDIENCE_STYLE[a.targetAudience] ?? AUDIENCE_STYLE.all!
            return (
              <div
                key={a.id}
                className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-all"
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                  style={{ backgroundColor: audienceStyle.color }}
                />
                <div className="pl-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-white leading-tight">{a.title}</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{a.body}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] text-zinc-600 whitespace-nowrap">{timeAgo(a.createdAt)}</span>
                    {a.targetAudience && a.targetAudience !== 'all' && (
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize"
                        style={{
                          color: audienceStyle.color,
                          backgroundColor: audienceStyle.bg,
                          borderColor: audienceStyle.border,
                        }}
                      >
                        {a.targetAudience}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
