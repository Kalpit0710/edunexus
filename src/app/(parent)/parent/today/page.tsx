'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { getParentTodayFeed, type ParentTodayFeed, type TodayAttendanceStatus } from '../actions'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarCheck,
  BookText,
  IndianRupee,
  Megaphone,
  AlertCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  LayoutDashboard,
} from 'lucide-react'
import Link from 'next/link'

const ATTENDANCE_META: Record<
  TodayAttendanceStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  present: { label: 'Present', color: '#10b981', icon: CheckCircle2 },
  absent: { label: 'Absent', color: '#ef4444', icon: XCircle },
  late: { label: 'Late', color: '#f59e0b', icon: Clock },
  half_day: { label: 'Half Day', color: '#f59e0b', icon: Clock },
  not_marked: { label: 'Not marked yet', color: '#6b7280', icon: HelpCircle },
}

export default function ParentTodayPage() {
  const { user, school, activeChildId } = useAuthStore()
  const now = new Date()

  const [feed, setFeed] = useState<ParentTodayFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setNotFound(false)
    setError(null)
    try {
      // Resolve the active child id (falls back to the parent's first child).
      const { getParentChildData } = await import('../actions')
      const childData = await getParentChildData(user?.email ?? '', school.id, activeChildId)
      if (!childData) {
        setNotFound(true)
        return
      }
      const result = await getParentTodayFeed(school.id, childData.id)
      if (!result) {
        setNotFound(true)
        return
      }
      setFeed(result)
    } catch (err) {
      setError(getErrorMessage(err))
      toast.error('Unable to load your feed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user?.email, school?.id, activeChildId])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="p-5 space-y-5 animate-fade-in">
        <Skeleton className="h-10 w-48 bg-white/5 rounded-xl" />
        <Skeleton className="h-28 rounded-2xl bg-white/5" />
        <div className="grid gap-3 grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-2xl bg-white/5" />
      </div>
    )
  }

  if (error) {
    return (
      <DataLoadError
        title="Couldn’t load your feed"
        message={error}
        onRetry={() => loadData()}
        retrying={loading}
      />
    )
  }

  if (notFound || !feed) {
    return (
      <div className="p-8 flex flex-col items-center gap-4 mt-16 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <AlertCircle className="h-8 w-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">No Student Linked</h2>
        <p className="text-center max-w-sm text-sm text-zinc-500">
          We couldn&apos;t find a student linked to your account email ({user?.email}). Please
          contact the school administrator.
        </p>
      </div>
    )
  }

  const att = ATTENDANCE_META[feed.attendanceStatus]
  const AttIcon = att.icon

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Today</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {now.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-600/10 px-3 py-1 text-xs font-medium text-blue-300">
          {feed.child.fullName.split(' ')[0]}
        </span>
      </div>

      {/* Attendance + Fee glance */}
      <div className="grid gap-3 grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div
            className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full blur-2xl opacity-20"
            style={{ backgroundColor: att.color }}
          />
          <div className="relative">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Attendance
              </p>
              <div
                className="flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${att.color}14`, color: att.color }}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <AttIcon className="h-5 w-5" style={{ color: att.color }} />
              <p className="text-lg font-bold text-white">{att.label}</p>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">marked for today</p>
          </div>
        </div>

        <Link href="/parent/fees">
          <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-all">
            <div
              className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full blur-2xl opacity-15"
              style={{ backgroundColor: feed.feeBalance > 0 ? '#ef4444' : '#10b981' }}
            />
            <div className="relative">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Fee Balance
                </p>
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: feed.feeBalance > 0 ? '#ef444414' : '#10b98114',
                    color: feed.feeBalance > 0 ? '#ef4444' : '#10b981',
                  }}
                >
                  <IndianRupee className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-lg font-bold text-white">
                ₹{feed.feeBalance.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {feed.feeBalance > 0 ? 'outstanding — tap to view' : '✓ All paid up!'}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Fee due alert */}
      {feed.feeBalance > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-600/8 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">
              Fee payment pending: ₹{feed.feeBalance.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Please clear the outstanding balance at the school office.
            </p>
          </div>
        </div>
      )}

      {/* Today's homework */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-600/10">
              <BookText className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-white">Today&apos;s Homework</p>
          </div>
          <Link
            href="/parent/homework"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {feed.todayHomework.length === 0 ? (
          <p className="text-sm text-zinc-500">No homework posted today. 🎉</p>
        ) : (
          <div className="space-y-2.5">
            {feed.todayHomework.map((hw) => (
              <div
                key={hw.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-center gap-2">
                  {hw.subjectName && (
                    <span className="inline-flex items-center rounded-full border border-purple-500/25 bg-purple-600/10 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                      {hw.subjectName}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-white">{hw.title}</p>
                </div>
                {hw.description && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{hw.description}</p>
                )}
                {hw.dueDate && (
                  <p className="text-[10px] text-amber-400/80 mt-1">
                    Due {new Date(hw.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {feed.upcomingHomework.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Due Soon
            </p>
            <div className="space-y-1.5">
              {feed.upcomingHomework.map((hw) => (
                <div key={hw.id} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-300 truncate">
                    {hw.subjectName ? `${hw.subjectName} — ` : ''}
                    {hw.title}
                  </p>
                  <span className="text-[10px] text-amber-400/80 shrink-0">
                    {hw.dueDate &&
                      new Date(hw.dueDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Latest notice */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-600/10">
              <Megaphone className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-white">Latest Notice</p>
          </div>
          <Link
            href="/parent/announcements"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {feed.latestAnnouncement ? (
          <div>
            <p className="text-sm font-semibold text-white">{feed.latestAnnouncement.title}</p>
            <p className="text-xs text-zinc-400 mt-1 line-clamp-3">{feed.latestAnnouncement.body}</p>
            <p className="text-[10px] text-zinc-600 mt-2">
              {new Date(feed.latestAnnouncement.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No notices yet.</p>
        )}
      </div>

      {/* Full dashboard link */}
      <Link href="/parent/dashboard">
        <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-600/10">
              <LayoutDashboard className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Full Dashboard</p>
              <p className="text-xs text-zinc-500">Attendance & exam trends</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-500" />
        </div>
      </Link>
    </div>
  )
}
