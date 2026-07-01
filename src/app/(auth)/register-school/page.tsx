'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { schoolRegisterSchema, TRIAL_DURATION_DAYS, type SchoolRegisterInput } from '@/lib/school-onboarding'

export default function RegisterSchoolPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ schoolCode: string; adminEmail: string } | null>(null)

  const form = useForm<SchoolRegisterInput>({
    resolver: zodResolver(schoolRegisterSchema),
    mode: 'onTouched',
    defaultValues: {
      schoolName: '',
      schoolCode: '',
      schoolEmail: '',
      schoolPhone: '',
      city: '',
      state: '',
      adminFullName: '',
      adminEmail: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: SchoolRegisterInput) {
    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/school-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        toast.error(payload?.message ?? 'We could not create your school right now.')
        return
      }

      toast.success('School created! Redirecting you to sign in…')
      setDone({ schoolCode: payload.schoolCode as string, adminEmail: data.adminEmail.trim() })
    } catch (error) {
      console.error(error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:border-blue-500/50 focus-visible:ring-1 focus-visible:ring-blue-500/30'
  const labelClass = 'text-xs font-semibold uppercase tracking-widest text-zinc-400'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] p-4">
      {/* Radial blue glow background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/8 blur-[80px]" />
      </div>

      <div className="animate-fade-in relative z-10 w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Start your free trial</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Set up your school on EduNexus in a minute — {TRIAL_DURATION_DAYS} days, full access, no card required.
          </p>
        </div>

        <div
          className="rounded-3xl border border-white/[0.08] p-8"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}
        >
          {done ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-600/10">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">You&apos;re all set!</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Your school code is{' '}
                <span className="font-mono font-semibold text-blue-300">{done.schoolCode}</span>. Sign in with{' '}
                <span className="font-medium text-zinc-200">{done.adminEmail}</span> to finish setting up.
              </p>
              <Button
                onClick={() => router.push('/login')}
                className="mt-6 h-11 w-full rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500"
              >
                Go to sign in
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">School details</p>
                  <FormField
                    control={form.control}
                    name="schoolName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>School name</FormLabel>
                        <FormControl>
                          <Input placeholder="Springfield High School" disabled={submitting} className={inputClass} {...field} />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="schoolCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>School code</FormLabel>
                        <FormControl>
                          <Input placeholder="SPRINGFIELD" disabled={submitting} className={inputClass} {...field} />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="schoolEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>School email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="office@school.edu" disabled={submitting} className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="schoolPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>School phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+91 98765 43210" disabled={submitting} className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Mumbai" disabled={submitting} className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>State</FormLabel>
                          <FormControl>
                            <Input placeholder="Maharashtra" disabled={submitting} className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-white/[0.08] pt-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Your admin account</p>
                  <FormField
                    control={form.control}
                    name="adminFullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" disabled={submitting} className={inputClass} {...field} />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="adminEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@school.edu" disabled={submitting} className={inputClass} {...field} />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>Password</FormLabel>
                          <FormControl>
                            <Input type="password" disabled={submitting} className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>Confirm password</FormLabel>
                          <FormControl>
                            <Input type="password" disabled={submitting} className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 h-11 w-full rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 disabled:opacity-50"
                >
                  {submitting ? 'Creating your school…' : 'Create school & start trial'}
                </Button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-blue-400"
                  >
                    <ArrowLeft className="h-3 w-3" /> Already have an account? Sign in
                  </Link>
                </div>
              </form>
            </Form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} EduNexus. All rights reserved.
        </p>
      </div>
    </div>
  )
}
