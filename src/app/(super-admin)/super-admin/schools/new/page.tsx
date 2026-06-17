'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { createSchool, getPlanPricing } from '../../actions'
import {
  PLAN_LABEL,
  DEFAULT_PLAN_PRICE,
  formatInr,
  SUBSCRIPTION_PLANS,
  type PlanPriceMap,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '@/lib/subscription'
import { getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

export default function NewSchoolPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [prices, setPrices] = useState<PlanPriceMap>(DEFAULT_PLAN_PRICE)

  useEffect(() => {
    getPlanPricing().then(setPrices).catch(() => {})
  }, [])

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [plan, setPlan] = useState<SubscriptionPlan>('basic')
  const [status, setStatus] = useState<SubscriptionStatus>('active')
  const [trialEndsAt, setTrialEndsAt] = useState('')

  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const valid =
    name.trim() &&
    code.trim() &&
    adminName.trim() &&
    adminEmail.trim() &&
    adminPassword.length >= 8 &&
    (status !== 'trial' || trialEndsAt)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      await createSchool({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        subscription_plan: plan,
        subscription_status: status,
        trial_ends_at: status === 'trial' && trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
        admin_full_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
      })
      toast.success('School created and admin provisioned')
      router.push('/super-admin/schools')
      router.refresh()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/super-admin/schools" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Schools
        </Link>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Onboard New School</h2>
        <p className="text-muted-foreground">Create a school tenant and its first School Admin login.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* School details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">School Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>School Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Green Valley School" />
            </div>
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="GVS2024" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="office@school.edu" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
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

        {/* Subscription */}
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
                <Label>Trial ends *</Label>
                <Input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* First admin */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">First School Admin</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Priya Menon" />
            </div>
            <div className="space-y-1">
              <Label>Login Email *</Label>
              <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@school.edu" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Temporary Password * (min 8 chars)</Label>
              <Input type="text" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Share securely with the admin" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/super-admin/schools">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={!valid || saving}>
            {saving && <Spinner size="sm" className="mr-2 border-primary-foreground" />}
            {saving ? 'Creating…' : 'Create School'}
          </Button>
        </div>
      </form>
    </div>
  )
}
