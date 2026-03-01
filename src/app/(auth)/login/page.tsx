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
import type { Database } from '@/types/database.types'

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
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)

    try {
      // 1. Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (authError) {
        toast.error(authError.message)
        return
      }

      if (!authData.user) {
        toast.error('Login failed. No user returned.')
        return
      }

      // 2. Fetch User Profile
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

      // 3. Fetch School Data (if any)
      let schoolData: any = null
      if (profileData.school_id) {
        const { data: s, error: sError } = await supabase
          .from('schools')
          .select('*')
          .eq('id', profileData.school_id)
          .single()
        if (!sError && s) {
          schoolData = s as any
        }
      }

      // 4. Update Zustand Store
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

      toast.success('Login successful!')

      // 5. Redirect based on role (Router will hit middleware, but we can do client side to be safe)
      const role = profileData.role
      const ROLE_ROUTES: Record<string, string> = {
        super_admin: '/super-admin/dashboard',
        school_admin: '/school-admin/dashboard',
        teacher: '/teacher/dashboard',
        manager: '/manager/dashboard',
        parent: '/parent/dashboard',
      }

      const redirectRoute = ROLE_ROUTES[role] || '/school-admin/dashboard'
      router.push(redirectRoute as any)
      router.refresh()
    } catch (error) {
      toast.error('An unexpected error occurred during login.')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">EduNexus</h1>
          <p className="text-sm text-muted-foreground">Sign in to your school management system</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@school.edu" type="email" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/reset-password"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
