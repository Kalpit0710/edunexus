'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getChildHomework, getLinkedChildren, type ChildHomeworkRow } from '../actions'
import { Skeleton } from '@/components/ui/skeleton'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { BookText, CalendarClock } from 'lucide-react'

export default function ParentHomeworkPage() {
  const { user, school, activeChildId, setActiveChildId } = useAuthStore()
  const [items, setItems] = useState<ChildHomeworkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!school?.id || !user?.email) return
    setLoading(true)
    setError(null)
    try {
      let childId = activeChildId
      if (!childId) {
        const kids = await getLinkedChildren(user.email, school.id)
        childId = kids[0]?.id ?? null
        if (childId) setActiveChildId(childId)
      }
      if (!childId) {
        setItems([])
        return
      }
      setItems(await getChildHomework(school.id, childId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load homework.')
    } finally {
      setLoading(false)
    }
  }, [school?.id, user?.email, activeChildId, setActiveChildId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <BookText className="h-5 w-5 text-blue-400" />
        <h1 className="text-lg font-bold text-white">Homework &amp; Diary</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <DataLoadError message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-zinc-500">
          No homework posted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((h) => (
            <div key={h.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-white">{h.title}</span>
                {h.subjectName && (
                  <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">{h.subjectName}</span>
                )}
              </div>
              {h.description && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">{h.description}</p>}
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {new Date(h.homeworkDate).toLocaleDateString('en-IN')}
                </span>
                {h.dueDate && <span>Due {new Date(h.dueDate).toLocaleDateString('en-IN')}</span>}
                {h.postedBy && <span className="ml-auto">— {h.postedBy}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
