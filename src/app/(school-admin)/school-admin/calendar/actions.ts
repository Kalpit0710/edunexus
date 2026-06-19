'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'

export type HolidayCategory = 'holiday' | 'event' | 'exam' | 'break'

export interface HolidayRow {
  id: string
  title: string
  category: HolidayCategory
  startDate: string
  endDate: string | null
  description: string | null
}

export interface HolidayInput {
  schoolId: string
  title: string
  category: HolidayCategory
  startDate: string
  endDate: string | null
  description: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertHoliday(input: HolidayInput): void {
  if (!input.title.trim()) throw new Error('Title is required.')
  if (!DATE_RE.test(input.startDate)) throw new Error('A valid start date is required.')
  if (input.endDate && !DATE_RE.test(input.endDate)) throw new Error('Invalid end date.')
  if (input.endDate && input.endDate < input.startDate) {
    throw new Error('End date cannot be before the start date.')
  }
}

export async function getHolidays(schoolId: string): Promise<HolidayRow[]> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('holidays')
    .select('id, title, category, start_date, end_date, description')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('start_date', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((h) => ({
    id: h.id,
    title: h.title,
    category: h.category,
    startDate: h.start_date,
    endDate: h.end_date,
    description: h.description,
  }))
}

export async function createHoliday(input: HolidayInput): Promise<void> {
  assertHoliday(input)
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('holidays').insert({
    school_id: input.schoolId,
    title: input.title.trim(),
    category: input.category,
    start_date: input.startDate,
    end_date: input.endDate,
    description: input.description?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

export async function updateHoliday(id: string, input: HolidayInput): Promise<void> {
  assertHoliday(input)
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('holidays')
    .update({
      title: input.title.trim(),
      category: input.category,
      start_date: input.startDate,
      end_date: input.endDate,
      description: input.description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', input.schoolId)
  if (error) throw new Error(error.message)
}

export async function deleteHoliday(schoolId: string, id: string): Promise<void> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('holidays')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}
