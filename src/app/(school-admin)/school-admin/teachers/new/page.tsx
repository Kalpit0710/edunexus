'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { ArrowLeft, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import Link from 'next/link'
import { createTeacher } from '../actions'

type FormData = {
  // Step 1 — Personal
  full_name: string
  email: string
  phone: string
  password: string
  // Step 2 — Professional
  employee_id: string
  qualification: string
  specialization: string
  join_date: string
}

const STEPS = [
  { label: 'Personal Info', description: 'Name, contact & login credentials' },
  { label: 'Professional', description: 'Role details & joining date' },
  { label: 'Review', description: 'Confirm before creating' },
]

export default function NewTeacherPage() {
  const router = useRouter()
  const { school } = useAuthStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState<FormData>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    employee_id: '',
    qualification: '',
    specialization: '',
    join_date: new Date().toISOString().split('T')[0] ?? '',
  })

  const update = (key: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (!form.full_name.trim()) {
        toast.error('Full name is required.')
        return false
      }
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        toast.error('A valid email address is required.')
        return false
      }
      if (form.password.length < 8) {
        toast.error('Password must be at least 8 characters.')
        return false
      }
    }
    if (s === 2) {
      if (!form.join_date) {
        toast.error('Joining date is required.')
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (validateStep(step)) setStep((p) => p + 1)
  }

  const handleSubmit = async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const teacherId = await createTeacher(school.id, {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        employee_id: form.employee_id || undefined,
        qualification: form.qualification || undefined,
        specialization: form.specialization || undefined,
        join_date: form.join_date,
      })
      toast.success('Teacher created successfully!')
      router.push(`/school-admin/teachers/${teacherId}` as any)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <Link href={'/school-admin/teachers' as any}>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Teachers
        </Button>
      </Link>

      <div>
        <h2 className="text-2xl font-bold">Add New Teacher</h2>
        <p className="text-muted-foreground">
          Create a teacher account and assign portal access.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const sNum = i + 1
          const isCurrent = sNum === step
          const isDone = sNum < step
          return (
            <div key={sNum} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isDone
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                    ? 'border-2 border-primary text-primary'
                    : 'border-2 border-muted text-muted-foreground'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : sNum}
              </div>
              <span
                className={`hidden sm:block text-sm ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-border mx-1 w-8" />
              )}
            </div>
          )
        })}
      </div>

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1]?.label}</CardTitle>
          <CardDescription>{STEPS[step - 1]?.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Step 1: Personal ── */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="full_name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="full_name"
                  placeholder="e.g. Priya Sharma"
                  value={form.full_name}
                  onChange={(e) => update('full_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="teacher@school.in"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This will be used to log into the teacher portal.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="98XXXXXXXX"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Initial Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The teacher can change this after first login.
                </p>
              </div>
            </>
          )}

          {/* ── Step 2: Professional ── */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_id">Employee ID</Label>
                  <Input
                    id="employee_id"
                    placeholder="e.g. EMP-001"
                    value={form.employee_id}
                    onChange={(e) => update('employee_id', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="join_date">
                    Date of Joining <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="join_date"
                    type="date"
                    value={form.join_date}
                    onChange={(e) => update('join_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qualification">Highest Qualification</Label>
                <Input
                  id="qualification"
                  placeholder="e.g. M.Sc. Physics, B.Ed"
                  value={form.qualification}
                  onChange={(e) => update('qualification', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Subject Specialization</Label>
                <Input
                  id="specialization"
                  placeholder="e.g. Mathematics, English Literature"
                  value={form.specialization}
                  onChange={(e) => update('specialization', e.target.value)}
                />
              </div>
            </>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <h4 className="font-semibold text-muted-foreground uppercase text-xs tracking-wide mb-3">
                  Personal
                </h4>
                <ReviewRow label="Full Name" value={form.full_name} />
                <ReviewRow label="Email" value={form.email} />
                <ReviewRow label="Phone" value={form.phone || '—'} />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <h4 className="font-semibold text-muted-foreground uppercase text-xs tracking-wide mb-3">
                  Professional
                </h4>
                <ReviewRow label="Employee ID" value={form.employee_id || '—'} />
                <ReviewRow label="Joining Date" value={form.join_date} />
                <ReviewRow label="Qualification" value={form.qualification || '—'} />
                <ReviewRow label="Specialization" value={form.specialization || '—'} />
              </div>

              <p className="text-xs text-muted-foreground">
                A portal account will be created with the email and password provided.
                Class assignments can be added from the teacher profile after creation.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-4">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep((p) => p - 1)}
              disabled={loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating…' : 'Create Teacher'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
