'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import {
  detectTeacherConflicts,
  periodsOverlap,
  normalizeWorkingDays,
  type ConflictEntry,
  type TeacherConflict,
} from '@/lib/timetable-utils'

export interface PeriodRow {
  id: string
  name: string
  startTime: string | null
  endTime: string | null
  displayOrder: number
  isBreak: boolean
}

export interface SectionOption {
  id: string
  name: string
}

export interface ClassWithSections {
  id: string
  name: string
  displayOrder: number
  sections: SectionOption[]
}

export interface TeacherOption {
  id: string
  name: string
}

export interface SubjectOption {
  id: string
  name: string
}

/** A teacher's section/subject assignment — drives the smart teacher picker. */
export interface TeacherAssignment {
  teacherId: string
  sectionId: string
  subjectId: string | null
}

export interface EntryCell {
  id: string
  dayOfWeek: number
  periodId: string
  subjectId: string | null
  subjectName: string | null
  teacherId: string | null
  teacherName: string | null
  room: string | null
}

export interface TimetableSetup {
  periods: PeriodRow[]
  classes: ClassWithSections[]
  teachers: TeacherOption[]
  assignments: TeacherAssignment[]
  workingDays: number[]
}

export interface SectionGrid {
  entries: EntryCell[]
  subjects: SubjectOption[]
  classId: string | null
}

export interface PeriodInput {
  schoolId: string
  name: string
  startTime: string | null
  endTime: string | null
  displayOrder: number
  isBreak: boolean
}

export interface EntryInput {
  schoolId: string
  sectionId: string
  dayOfWeek: number
  periodId: string
  subjectId: string | null
  teacherId: string | null
  room: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function teacherName(t: any): string {
  return t?.user_profiles?.full_name ?? t?.employee_id ?? 'Teacher'
}

/** Periods, classes (with sections) and the teacher roster for the editor. */
export async function getTimetableSetup(schoolId: string): Promise<TimetableSetup> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: periods }, { data: classes }, { data: teachers }, { data: school }, { data: assignments }] =
    await Promise.all([
      db
        .from('timetable_periods')
        .select('id, name, start_time, end_time, display_order, is_break')
        .eq('school_id', schoolId)
        .order('display_order', { ascending: true }),
      db
        .from('classes')
        .select('id, name, display_order, is_active, sections ( id, name, is_active )')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      db
        .from('teachers')
        .select('id, employee_id, is_active, user_profiles ( full_name )')
        .eq('school_id', schoolId)
        .eq('is_active', true),
      db.from('schools').select('working_days').eq('id', schoolId).maybeSingle(),
      db
        .from('teacher_section_assignments')
        .select('teacher_id, section_id, subject_id')
        .eq('school_id', schoolId),
    ])

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    periods: ((periods ?? []) as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      startTime: p.start_time,
      endTime: p.end_time,
      displayOrder: p.display_order,
      isBreak: p.is_break,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    classes: ((classes ?? []) as any[]).map((c) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.display_order,
      sections: ((c.sections ?? []) as { id: string; name: string; is_active: boolean }[])
        .filter((s) => s.is_active)
        .map((s) => ({ id: s.id, name: s.name })),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teachers: ((teachers ?? []) as any[])
      .map((t) => ({ id: t.id, name: teacherName(t) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments: ((assignments ?? []) as any[]).map((a) => ({
      teacherId: a.teacher_id,
      sectionId: a.section_id,
      subjectId: a.subject_id,
    })),
    workingDays: normalizeWorkingDays(school?.working_days),
  }
}

/** The grid for one section: existing entries + subjects for its class. */
export async function getSectionGrid(schoolId: string, sectionId: string): Promise<SectionGrid> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: section } = await db
    .from('sections')
    .select('class_id')
    .eq('id', sectionId)
    .eq('school_id', schoolId)
    .maybeSingle()

  const classId: string | null = section?.class_id ?? null

  const [{ data: entries }, { data: subjects }] = await Promise.all([
    db
      .from('timetable_entries')
      .select('id, day_of_week, period_id, subject_id, teacher_id, room, subjects ( name ), teachers ( id, employee_id, user_profiles ( full_name ) )')
      .eq('school_id', schoolId)
      .eq('section_id', sectionId),
    classId
      ? db
          .from('subjects')
          .select('id, name')
          .eq('school_id', schoolId)
          .eq('class_id', classId)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  return {
    classId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entries: ((entries ?? []) as any[]).map((e) => ({
      id: e.id,
      dayOfWeek: e.day_of_week,
      periodId: e.period_id,
      subjectId: e.subject_id,
      subjectName: e.subjects?.name ?? null,
      teacherId: e.teacher_id,
      teacherName: e.teachers ? teacherName(e.teachers) : null,
      room: e.room,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjects: ((subjects ?? []) as any[]).map((s) => ({ id: s.id, name: s.name })),
  }
}

// ─── Period CRUD ─────────────────────────────────────────────

function assertPeriod(input: PeriodInput): void {
  if (!input.name.trim()) throw new Error('Period name is required.')
  if (input.startTime && input.endTime && input.endTime <= input.startTime) {
    throw new Error('End time must be after the start time.')
  }
  if ((input.startTime && !input.endTime) || (!input.startTime && input.endTime)) {
    throw new Error('Provide both a start and end time, or leave both blank.')
  }
}

/**
 * Reject a period whose time range overlaps another period in the same school.
 * Rows without times (unscheduled) and the period being edited are ignored.
 */
async function assertNoPeriodOverlap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: PeriodInput,
  excludeId?: string,
): Promise<void> {
  if (!input.startTime || !input.endTime) return
  const { data } = await db
    .from('timetable_periods')
    .select('id, name, start_time, end_time')
    .eq('school_id', input.schoolId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clash = ((data ?? []) as any[]).find(
    (p) =>
      p.id !== excludeId && periodsOverlap(input.startTime, input.endTime, p.start_time, p.end_time),
  )
  if (clash) {
    throw new Error(`This time range overlaps "${clash.name}". Periods can't overlap.`)
  }
}

export async function createPeriod(input: PeriodInput): Promise<void> {
  assertPeriod(input)
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  await assertNoPeriodOverlap(db, input)
  const { error } = await db.from('timetable_periods').insert({
    school_id: input.schoolId,
    name: input.name.trim(),
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    display_order: input.displayOrder,
    is_break: input.isBreak,
  })
  if (error) throw new Error(error.message.includes('duplicate') ? 'A period with that name already exists.' : error.message)
}

export async function updatePeriod(id: string, input: PeriodInput): Promise<void> {
  assertPeriod(input)
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  await assertNoPeriodOverlap(db, input, id)
  const { error } = await db
    .from('timetable_periods')
    .update({
      name: input.name.trim(),
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      display_order: input.displayOrder,
      is_break: input.isBreak,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', input.schoolId)
  if (error) throw new Error(error.message)
}

/** Deletes a period — its timetable cells (across every section) cascade away. */
export async function deletePeriod(schoolId: string, id: string): Promise<void> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('timetable_periods').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}

// ─── Entry upsert / clear ────────────────────────────────────

/**
 * Set (or clear) a single slot. Returns the section labels where the chosen
 * teacher / room are already booked at the same day+period (non-blocking
 * warnings — the admin can override).
 */
export async function upsertEntry(
  input: EntryInput,
): Promise<{ conflictSections: string[]; roomConflictSections: string[] }> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const empty = !input.subjectId && !input.teacherId && !input.room?.trim()
  if (empty) {
    const { error } = await db
      .from('timetable_entries')
      .delete()
      .eq('school_id', input.schoolId)
      .eq('section_id', input.sectionId)
      .eq('day_of_week', input.dayOfWeek)
      .eq('period_id', input.periodId)
    if (error) throw new Error(error.message)
    return { conflictSections: [], roomConflictSections: [] }
  }

  const room = input.room?.trim() || null
  const { error } = await db.from('timetable_entries').upsert(
    {
      school_id: input.schoolId,
      section_id: input.sectionId,
      day_of_week: input.dayOfWeek,
      period_id: input.periodId,
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      room,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'school_id,section_id,day_of_week,period_id' },
  )
  if (error) throw new Error(error.message)

  // Other sections sharing this exact day+period (for teacher/room clash checks).
  const { data: others } = await db
    .from('timetable_entries')
    .select('teacher_id, room, sections ( name, classes ( name ) )')
    .eq('school_id', input.schoolId)
    .eq('day_of_week', input.dayOfWeek)
    .eq('period_id', input.periodId)
    .neq('section_id', input.sectionId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (others ?? []) as any[]
  const label = (r: { sections?: { name?: string; classes?: { name?: string } } }) =>
    `${r.sections?.classes?.name ?? ''} ${r.sections?.name ?? ''}`.trim()

  const conflictSections = input.teacherId
    ? rows.filter((r) => r.teacher_id === input.teacherId).map(label)
    : []
  const roomConflictSections = room
    ? rows.filter((r) => (r.room ?? '').toLowerCase() === room.toLowerCase()).map(label)
    : []

  return { conflictSections, roomConflictSections }
}

/**
 * Who/what is already booked in a given day+period across *other* sections.
 * Powers the live availability hints inside the cell editor.
 */
export async function getSlotOccupancy(
  schoolId: string,
  dayOfWeek: number,
  periodId: string,
  excludeSectionId: string,
): Promise<{ teacherIds: string[]; rooms: string[]; labelByTeacher: Record<string, string> }> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('timetable_entries')
    .select('teacher_id, room, sections ( name, classes ( name ) )')
    .eq('school_id', schoolId)
    .eq('day_of_week', dayOfWeek)
    .eq('period_id', periodId)
    .neq('section_id', excludeSectionId)

  const teacherIds = new Set<string>()
  const rooms = new Set<string>()
  const labelByTeacher: Record<string, string> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const label = `${r.sections?.classes?.name ?? ''} ${r.sections?.name ?? ''}`.trim()
    if (r.teacher_id) {
      teacherIds.add(r.teacher_id)
      labelByTeacher[r.teacher_id] = label
    }
    if (r.room) rooms.add(String(r.room).toLowerCase())
  }
  return { teacherIds: [...teacherIds], rooms: [...rooms], labelByTeacher }
}

// ─── School-wide conflict report ─────────────────────────────

export async function getAllConflicts(schoolId: string): Promise<TeacherConflict[]> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('timetable_entries')
    .select('id, section_id, day_of_week, period_id, teacher_id, timetable_periods ( name ), sections ( name, classes ( name ) ), teachers ( employee_id, user_profiles ( full_name ) )')
    .eq('school_id', schoolId)
    .not('teacher_id', 'is', null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: ConflictEntry[] = ((data ?? []) as any[]).map((e) => ({
    entryId: e.id,
    sectionId: e.section_id,
    sectionLabel: `${e.sections?.classes?.name ?? ''} ${e.sections?.name ?? ''}`.trim(),
    dayOfWeek: e.day_of_week,
    periodId: e.period_id,
    periodName: e.timetable_periods?.name ?? '',
    teacherId: e.teacher_id,
    teacherName: e.teachers ? teacherName(e.teachers) : null,
  }))

  return detectTeacherConflicts(entries)
}

// ─── Teacher-centric read view (admin) ───────────────────────

export interface TeacherViewEntry {
  dayOfWeek: number
  periodId: string
  sectionLabel: string
  subjectName: string | null
  room: string | null
}

export async function getTeacherGrid(schoolId: string, teacherId: string): Promise<TeacherViewEntry[]> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('timetable_entries')
    .select('day_of_week, period_id, room, subjects ( name ), sections ( name, classes ( name ) )')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((e) => ({
    dayOfWeek: e.day_of_week,
    periodId: e.period_id,
    sectionLabel: `${e.sections?.classes?.name ?? ''} ${e.sections?.name ?? ''}`.trim(),
    subjectName: e.subjects?.name ?? null,
    room: e.room,
  }))
}

// ─── Working days (school setting) ───────────────────────────

export async function setWorkingDays(schoolId: string, days: number[]): Promise<number[]> {
  const clean = normalizeWorkingDays(days)
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('schools')
    .update({ working_days: clean, updated_at: new Date().toISOString() })
    .eq('id', schoolId)
  if (error) throw new Error(error.message)
  return clean
}

// ─── Bulk grid helpers (copy / clear / duplicate) ────────────

/** Replace every slot on `toDay` with a copy of `fromDay` for one section. */
export async function copyDay(
  schoolId: string,
  sectionId: string,
  fromDay: number,
  toDay: number,
): Promise<void> {
  if (fromDay === toDay) throw new Error('Pick two different days.')
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: source } = await db
    .from('timetable_entries')
    .select('period_id, subject_id, teacher_id, room')
    .eq('school_id', schoolId)
    .eq('section_id', sectionId)
    .eq('day_of_week', fromDay)

  await db
    .from('timetable_entries')
    .delete()
    .eq('school_id', schoolId)
    .eq('section_id', sectionId)
    .eq('day_of_week', toDay)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((source ?? []) as any[]).map((e) => ({
    school_id: schoolId,
    section_id: sectionId,
    day_of_week: toDay,
    period_id: e.period_id,
    subject_id: e.subject_id,
    teacher_id: e.teacher_id,
    room: e.room,
  }))
  if (rows.length > 0) {
    const { error } = await db.from('timetable_entries').insert(rows)
    if (error) throw new Error(error.message)
  }
}

/** Remove every slot on a given day for one section. */
export async function clearDay(schoolId: string, sectionId: string, day: number): Promise<void> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('timetable_entries')
    .delete()
    .eq('school_id', schoolId)
    .eq('section_id', sectionId)
    .eq('day_of_week', day)
  if (error) throw new Error(error.message)
}

/**
 * Copy a whole section's weekly grid onto another section. Restricted to
 * sections of the *same class* so the subjects line up.
 */
export async function duplicateSectionTimetable(
  schoolId: string,
  fromSectionId: string,
  toSectionId: string,
): Promise<void> {
  if (fromSectionId === toSectionId) throw new Error('Pick a different target section.')
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: sects } = await db
    .from('sections')
    .select('id, class_id')
    .eq('school_id', schoolId)
    .in('id', [fromSectionId, toSectionId])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (sects ?? []) as any[]
  const from = list.find((s) => s.id === fromSectionId)
  const to = list.find((s) => s.id === toSectionId)
  if (!from || !to) throw new Error('Section not found.')
  if (from.class_id !== to.class_id) {
    throw new Error('Both sections must belong to the same class so subjects match.')
  }

  const { data: source } = await db
    .from('timetable_entries')
    .select('day_of_week, period_id, subject_id, teacher_id, room')
    .eq('school_id', schoolId)
    .eq('section_id', fromSectionId)

  await db.from('timetable_entries').delete().eq('school_id', schoolId).eq('section_id', toSectionId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((source ?? []) as any[]).map((e) => ({
    school_id: schoolId,
    section_id: toSectionId,
    day_of_week: e.day_of_week,
    period_id: e.period_id,
    subject_id: e.subject_id,
    teacher_id: e.teacher_id,
    room: e.room,
  }))
  if (rows.length > 0) {
    const { error } = await db.from('timetable_entries').insert(rows)
    if (error) throw new Error(error.message)
  }
}
