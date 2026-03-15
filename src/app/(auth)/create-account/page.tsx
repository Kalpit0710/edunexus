'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, ShieldCheck, UserRoundPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface LookupStudent {
  schoolName: string
  schoolCode: string
  studentId: string
  studentName: string
  admissionNumber: string
  className: string
  sectionName: string
}

interface LinkedStudent {
  id: string
  fullName: string
  admissionNumber: string
}

export default function CreateAccountPage() {
  const [schoolCode, setSchoolCode] = useState('')
  const [admissionNumber, setAdmissionNumber] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [lookupLoading, setLookupLoading] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [student, setStudent] = useState<LookupStudent | null>(null)
  const [createdEmail, setCreatedEmail] = useState<string | null>(null)
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([])

  const lookupStudent = async () => {
    if (!schoolCode.trim() || !admissionNumber.trim()) {
      toast.error('Enter school code and student registration number')
      return
    }

    setLookupLoading(true)
    setStudent(null)
    setCreatedEmail(null)
    setLinkedStudents([])

    try {
      const response = await fetch('/api/auth/parent-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup',
          schoolCode: schoolCode.trim(),
          admissionNumber: admissionNumber.trim(),
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        toast.error(payload?.message ?? 'Unable to fetch student details')
        return
      }

      setStudent(payload.student as LookupStudent)
      toast.success('Student verified. Continue with parent details.')
    } catch (error) {
      console.error(error)
      toast.error('Unable to verify student right now')
    } finally {
      setLookupLoading(false)
    }
  }

  const createParentAccount = async () => {
    if (!student) {
      toast.error('Verify student details first')
      return
    }

    if (!parentEmail.trim() || !parentPhone.trim()) {
      toast.error('Parent email and phone are required')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/
    if (!passwordStrength.test(password)) {
      toast.error('Password must include uppercase, lowercase, and a number')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setRegisterLoading(true)

    try {
      const response = await fetch('/api/auth/parent-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          schoolCode: schoolCode.trim(),
          admissionNumber: admissionNumber.trim(),
          parentEmail: parentEmail.trim(),
          parentPhone: parentPhone.trim(),
          password,
          confirmPassword,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        toast.error(payload?.message ?? 'Unable to create account')
        return
      }

      setCreatedEmail(payload.account?.email ?? parentEmail.trim())
      setLinkedStudents((payload.account?.linkedStudents ?? []) as LinkedStudent[])
      toast.success('Account created successfully. You can now login.')
    } catch (error) {
      console.error(error)
      toast.error('Unable to create account right now')
    } finally {
      setRegisterLoading(false)
    }
  }

  const accountCreated = !!createdEmail

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[620px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/8 blur-[84px]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="animate-fade-in relative z-10 w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/10">
            <UserRoundPlus className="h-6 w-6 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Create Parent Account</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Only parents with school-registered email and phone can activate portal access.
          </p>
        </div>

        <div
          className="rounded-3xl border border-white/[0.08] p-6"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}
        >
          {accountCreated ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Account created successfully</p>
                    <p className="mt-1 text-xs text-emerald-200/90">Login email: {createdEmail}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Linked Students</p>
                <div className="mt-3 space-y-2">
                  {linkedStudents.length === 0 ? (
                    <p className="text-xs text-zinc-500">No linked students returned.</p>
                  ) : (
                    linkedStudents.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2"
                      >
                        <span className="text-sm text-white">{row.fullName}</span>
                        <span className="font-mono text-xs text-zinc-400">{row.admissionNumber}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Button asChild className="h-11 w-full rounded-full bg-blue-600 text-white hover:bg-blue-500">
                <Link href="/login">Go to Login</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Step 1: Verify Student</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">School Code</label>
                    <Input
                      placeholder="DHS001"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                      className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
                      disabled={lookupLoading || registerLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Student Reg. No.</label>
                    <Input
                      placeholder="ADM-10A-001"
                      value={admissionNumber}
                      onChange={(e) => setAdmissionNumber(e.target.value.toUpperCase())}
                      className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
                      disabled={lookupLoading || registerLoading}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={lookupStudent}
                  disabled={lookupLoading || registerLoading}
                  className="mt-3 h-10 w-full rounded-full bg-blue-600 text-white hover:bg-blue-500"
                >
                  {lookupLoading ? 'Verifying Student...' : 'Fetch Student Details'}
                </Button>
              </div>

              {student && (
                <div className="rounded-2xl border border-blue-500/20 bg-blue-600/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Verified Student</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-white">{student.studentName}</p>
                    <p className="text-zinc-300">{student.className} {student.sectionName !== 'N/A' ? `- ${student.sectionName}` : ''}</p>
                    <p className="font-mono text-xs text-zinc-400">{student.admissionNumber} | {student.schoolCode}</p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Step 2: Parent Verification</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Parent Email</label>
                    <Input
                      type="email"
                      placeholder="parent@example.com"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
                      disabled={registerLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Parent Phone</label>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
                      disabled={registerLoading}
                    />
                    <p className="text-[11px] text-zinc-500">
                      You can enter phone as <span className="font-mono">+91 98765 43210</span>, <span className="font-mono">9876543210</span>, or with spaces/hyphens.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
                      disabled={registerLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Confirm Password</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
                      disabled={registerLoading}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={createParentAccount}
                  disabled={!student || registerLoading}
                  className="mt-4 h-11 w-full rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {registerLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </div>

              <p className="text-center text-xs text-zinc-500">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
