'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, ShieldCheck, Power, Users2, BookOpen, IndianRupee, CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { ContentAreaLoader } from '@/components/loaders/page-loaders'
import { getSchoolById, updateSchool, setSchoolSuspended, getSchoolOverview, getPlanPricing, type SchoolRow, type SchoolOverview } from '../../actions'
import {
  PLAN_LABEL,
  DEFAULT_PLAN_PRICE,
  STATUS_LABEL,
  formatInr,
  SUBSCRIPTION_PLANS,
  type PlanPriceMap,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '@/lib/subscription'
import { getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  trial: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/20',
}

export default function SchoolDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [school, setSchool] = useState<SchoolRow | null>(null)
  const [overview, setOverview] = useState<SchoolOverview | null>(null)
  const [prices, setPrices] = useState<PlanPriceMap>(DEFAULT_PLAN_PRICE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [plan, setPlan] = useState<SubscriptionPlan>('basic')
  const [status, setStatus] = useState<SubscriptionStatus>('active')
  const [trialEndsAt, setTrialEndsAt] = useState('')

  function hydrate(s: SchoolRow) {
    setSchool(s)
    setName(s.name)
    setEmail(s.email ?? '')
    setPhone(s.phone ?? '')
    setCity(s.city ?? '')
    setState(s.state ?? '')
    setPlan(s.subscription_plan)
    setStatus(s.subscription_status)
    setTrialEndsAt(s.trial_ends_at ? s.trial_ends_at.slice(0, 10) : '')
  }

  async function load() {
    try {
      const [s, ov, p] = await Promise.all([
        getSchoolById(id),
        getSchoolOverview(id).catch(() => null),
        getPlanPricing().catch(() => DEFAULT_PLAN_PRICE),
      ])
      if (!s) {
        toast.error('School not found')
        return
      }
      hydrate(s)
      setOverview(ov)
      setPrices(p)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await updateSchool(id, {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        subscription_plan: plan,
        subscription_status: status,
        trial_ends_at: status === 'trial' && trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
      })
      toast.success('School updated')
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleSuspend() {
    if (!school || toggling) return
    const suspend = school.subscription_status !== 'suspended'
    if (suspend && !confirm('Suspend this school? Its users will be blocked from operating.')) return
    setToggling(true)
    try {
      await setSchoolSuspended(id, suspend)
      toast.success(suspend ? 'School suspended' : 'School reactivated')
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setToggling(false)
    }
  }

  if (loading) return <ContentAreaLoader label="Loading school..." />
  if (!school) {
    return (
      <div className="space-y-4">
        <Link href="/super-admin/schools" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Schools
        </Link>
        <p className="text-muted-foreground">School not found.</p>
      </div>
    )
  }

  const suspended = school.subscription_status === 'suspended'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/super-admin/schools" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Schools
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-white">{school.name}</h2>
          <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[school.subscription_status]}`}>
            {STATUS_LABEL[school.subscription_status]}
          </span>
        </div>
        <p className="text-muted-foreground">{school.code}</p>
      </div>

      {/* Operational overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Students</p>
            <GraduationCap className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{overview?.students ?? school.student_count ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Teachers</p>
            <Users2 className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{overview?.teachers ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Classes</p>
            <BookOpen className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{overview?.classes ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">School Admins</p>
            <ShieldCheck className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{school.admin_count ?? 0}</p>
        </div>
      </div>

      {/* Operations snapshot */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total Collected</p>
            <IndianRupee className="h-4 w-4 text-green-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{formatInr(overview?.totalCollected ?? 0)}</p>
          <p className="mt-1 text-xs text-zinc-500">Today: {formatInr(overview?.todayCollected ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Today's Attendance</p>
            <CalendarCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">
            {overview?.attendanceTodayPct == null ? '—' : `${overview.attendanceTodayPct}%`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">% present today</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-sm text-muted-foreground">Recent Activity</p>
          {overview && overview.recentActivity.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {overview.recentActivity.map((a) => (
                <li key={a.id} className="truncate text-xs text-zinc-400">
                  <span className="text-zinc-200">{a.action.replace(/\./g, ' · ').replace(/_/g, ' ')}</span>
                  {' · '}
                  {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">No recorded activity yet.</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">School Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>School Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input value={school.code} disabled />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as SubscriptionPlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_PLANS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLAN_LABEL[p]} — {formatInr(prices[p])}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status === 'trial' && (
              <div className="space-y-1">
                <Label>Trial ends</Label>
                <Input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleToggleSuspend}
            disabled={toggling}
            className={suspended ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}
          >
            {toggling ? <Spinner size="sm" className="mr-2" /> : <Power className="mr-2 h-4 w-4" />}
            {suspended ? 'Reactivate School' : 'Suspend School'}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Spinner size="sm" className="mr-2 border-primary-foreground" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
