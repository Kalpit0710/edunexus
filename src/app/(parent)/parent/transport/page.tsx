'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getChildTransport, getLinkedChildren, type ChildTransport } from '../actions'
import { formatTime } from '@/lib/timetable-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { Bus, User, Phone, MapPin, Clock } from 'lucide-react'

export default function ParentTransportPage() {
  const { user, school, activeChildId, setActiveChildId } = useAuthStore()
  const [data, setData] = useState<ChildTransport | null>(null)
  const [loaded, setLoaded] = useState(false)
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
      setData(childId ? await getChildTransport(school.id, childId) : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load transport details.')
    } finally {
      setLoaded(true)
      setLoading(false)
    }
  }, [school?.id, user?.email, activeChildId, setActiveChildId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bus className="h-5 w-5 text-blue-400" />
        <h1 className="text-lg font-bold text-white">Transport</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <DataLoadError message={error} onRetry={load} />
      ) : !data ? (
        loaded ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-zinc-500">
            Your child is not assigned to school transport.
          </div>
        ) : null
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Bus</p>
            <p className="text-lg font-semibold text-white">{data.busNumber}</p>
            <p className="text-sm text-zinc-400">
              {[data.routeName, data.registrationNumber].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Driver</p>
            <div className="flex items-center gap-2 text-sm text-white">
              <User className="h-4 w-4 text-zinc-500" /> {data.driverName || 'Not assigned'}
            </div>
            {data.driverPhone && (
              <a href={`tel:${data.driverPhone}`} className="flex items-center gap-2 text-sm text-blue-400">
                <Phone className="h-4 w-4" /> {data.driverPhone}
              </a>
            )}
            {data.attendantName && (
              <p className="text-xs text-zinc-500">
                Attendant: {data.attendantName}
                {data.attendantPhone ? ` · ${data.attendantPhone}` : ''}
              </p>
            )}
          </div>

          {(data.stopName || data.pickupPoint || data.pickupTime) && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Pickup</p>
              {(data.stopName || data.pickupPoint) && (
                <div className="flex items-center gap-2 text-sm text-white">
                  <MapPin className="h-4 w-4 text-zinc-500" /> {data.stopName || data.pickupPoint}
                </div>
              )}
              {(data.pickupTime || data.dropTime) && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Clock className="h-4 w-4 text-zinc-500" />
                  {[formatTime(data.pickupTime), formatTime(data.dropTime)].filter(Boolean).join(' / ')}
                </div>
              )}
            </div>
          )}

          {data.feeAmount > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Monthly fee</p>
              <p className="text-lg font-semibold text-white">₹{data.feeAmount.toLocaleString('en-IN')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
