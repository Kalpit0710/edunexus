'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export interface DashboardStats {
  totalStudents: number
  activeTeachers: number
  classCount: number
  todayCollection: number
  needsOnboarding: boolean
}

export async function getDashboardStats(
  schoolId: string,
  today: string,
): Promise<DashboardStats> {
  const supabase = await getSupabase()
  const db = supabase as any

  // Run all queries in parallel — use count-only queries to avoid fetching rows
  const [
    studentsRes,
    teachersRes,
    classesRes,
    collectionRes,
    yearsRes,
  ] = await Promise.all([
    db
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),

    db
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),

    db
      .from('classes')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    db
      .from('fee_payments')
      .select('paid_amount')
      .eq('school_id', schoolId)
      .eq('payment_date', today),

    db
      .from('academic_years')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId),
  ])

  const totalStudents = studentsRes.count ?? 0
  const activeTeachers = teachersRes.count ?? 0
  const classCount = classesRes.count ?? 0
  const todayCollection = ((collectionRes.data ?? []) as any[]).reduce(
    (s: number, r: any) => s + Number(r.paid_amount ?? 0),
    0
  )
  const needsOnboarding = (classesRes.count ?? 0) === 0 && (yearsRes.count ?? 0) === 0

  return { totalStudents, activeTeachers, classCount, todayCollection, needsOnboarding }
}
