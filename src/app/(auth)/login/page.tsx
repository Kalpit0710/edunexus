'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import Link from 'next/link'

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
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()
  const { setUser, setSchool } = useAuthStore()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (authError) { toast.error(authError.message); return }
      if (!authData.user) { toast.error('Login failed. No user returned.'); return }

      const { data: profileResp, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single()

      const profileData = profileResp as any

      if (profileError || !profileData) {
        console.error('Profile fetch error:', profileError)
        toast.error('Could not fetch user profile details.')
        return
      }

      let schoolData: any = null
      if (profileData.school_id) {
        const { data: s, error: sError } = await supabase
          .from('schools')
          .select('*')
          .eq('id', profileData.school_id)
          .single()
        if (!sError && s) schoolData = s as any
      }

      setUser({
        ...authData.user,
        user_metadata: {
          role: profileData.role,
          school_id: profileData.school_id || undefined,
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url || undefined,
        },
      })

      if (schoolData) {
        setSchool({
          id: schoolData.id,
          name: schoolData.name,
          code: schoolData.code,
          logo_url: schoolData.logo_url,
          theme_color: schoolData.theme_color,
          academic_year_start_month: schoolData.academic_year_start_month,
          is_active: schoolData.is_active,
          created_at: schoolData.created_at,
          updated_at: schoolData.updated_at,
        })
      }

      toast.success('Welcome back!')

      const ROLE_ROUTES: Record<string, string> = {
        super_admin: '/super-admin/dashboard',
        school_admin: '/school-admin/dashboard',
        teacher: '/teacher/dashboard',
        manager: '/manager/dashboard',
        parent: '/parent/dashboard',
      }

      router.push((ROLE_ROUTES[profileData.role] || '/school-admin/dashboard') as any)
      router.refresh()
    } catch (error) {
      toast.error('An unexpected error occurred during login.')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] p-4">
      {/* Radial blue glow background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/8 blur-[80px]" />
      </div>

      {/* Grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Card */}
      <div className="animate-fade-in relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/10">
            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">EduNexus</h1>
          <p className="mt-2 text-sm text-zinc-500">Sign in to your school management portal</p>
        </div>

        {/* Form card */}
        <div
          className="rounded-3xl border border-white/[0.08] p-8"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="you@school.edu"
                        type="email"
                        disabled={isLoading}
                        className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:border-blue-500/50 focus-visible:ring-1 focus-visible:ring-blue-500/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                        Password
                      </FormLabel>
                      <Link
                        href="/reset-password"
                        className="text-xs text-zinc-500 transition-colors hover:text-blue-400"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input
                        type="password"
                        disabled={isLoading}
                        className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:border-blue-500/50 focus-visible:ring-1 focus-visible:ring-blue-500/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-2 h-11 w-full rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/30 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : 'Sign in'}
              </Button>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-center">
                <p className="text-xs text-zinc-500">
                  Parent account not activated yet?{' '}
                  <Link href="/create-account" className="font-medium text-blue-400 hover:text-blue-300">
                    Create account
                  </Link>
                </p>
              </div>
            </form>
          </Form>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} EduNexus. All rights reserved.
        </p>
      </div>
    </div>
  )
}

