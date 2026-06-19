'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'

export interface StopRow {
  id: string
  name: string
  pickupTime: string | null
  dropTime: string | null
  stopOrder: number
}

export interface BusRow {
  id: string
  busNumber: string
  registrationNumber: string | null
  model: string | null
  capacity: number
  routeName: string | null
  driverName: string | null
  driverPhone: string | null
  driverLicense: string | null
  attendantName: string | null
  attendantPhone: string | null
  notes: string | null
  assignedCount: number
  stops: StopRow[]
}

export interface AssignmentRow {
  id: string
  studentId: string
  studentName: string
  admissionNumber: string | null
  className: string | null
  busId: string
  busNumber: string
  stopId: string | null
  stopName: string | null
  pickupPoint: string | null
  feeAmount: number
}

export interface StudentOption {
  id: string
  name: string
  admissionNumber: string | null
  className: string | null
}

export interface TransportData {
  buses: BusRow[]
  assignments: AssignmentRow[]
  students: StudentOption[]
}

export interface BusInput {
  schoolId: string
  busNumber: string
  registrationNumber: string | null
  model: string | null
  capacity: number
  routeName: string | null
  driverName: string | null
  driverPhone: string | null
  driverLicense: string | null
  attendantName: string | null
  attendantPhone: string | null
  notes: string | null
}

export interface StopInput {
  schoolId: string
  busId: string
  name: string
  pickupTime: string | null
  dropTime: string | null
  stopOrder: number
}

export async function getTransportData(schoolId: string): Promise<TransportData> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: buses }, { data: assignments }, { data: students }] = await Promise.all([
    db
      .from('buses')
      .select('*, bus_stops ( id, name, pickup_time, drop_time, stop_order )')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('bus_number', { ascending: true }),
    db
      .from('student_transport')
      .select('id, student_id, bus_id, stop_id, pickup_point, fee_amount, students ( full_name, admission_number, classes ( name ) ), buses ( bus_number ), bus_stops ( name )')
      .eq('school_id', schoolId),
    db
      .from('students')
      .select('id, full_name, admission_number, classes ( name )')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .limit(2000),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentRows: AssignmentRow[] = ((assignments ?? []) as any[]).map((a) => ({
    id: a.id,
    studentId: a.student_id,
    studentName: a.students?.full_name ?? '—',
    admissionNumber: a.students?.admission_number ?? null,
    className: a.students?.classes?.name ?? null,
    busId: a.bus_id,
    busNumber: a.buses?.bus_number ?? '—',
    stopId: a.stop_id,
    stopName: a.bus_stops?.name ?? null,
    pickupPoint: a.pickup_point,
    feeAmount: Number(a.fee_amount),
  }))

  const countByBus = new Map<string, number>()
  for (const a of assignmentRows) countByBus.set(a.busId, (countByBus.get(a.busId) ?? 0) + 1)

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buses: ((buses ?? []) as any[]).map((b) => ({
      id: b.id,
      busNumber: b.bus_number,
      registrationNumber: b.registration_number,
      model: b.model,
      capacity: b.capacity,
      routeName: b.route_name,
      driverName: b.driver_name,
      driverPhone: b.driver_phone,
      driverLicense: b.driver_license,
      attendantName: b.attendant_name,
      attendantPhone: b.attendant_phone,
      notes: b.notes,
      assignedCount: countByBus.get(b.id) ?? 0,
      stops: ((b.bus_stops ?? []) as StopRow[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          pickupTime: s.pickup_time,
          dropTime: s.drop_time,
          stopOrder: s.stop_order,
        }))
        .sort((x, y) => x.stopOrder - y.stopOrder),
    })),
    assignments: assignmentRows,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students: ((students ?? []) as any[]).map((s) => ({
      id: s.id,
      name: s.full_name,
      admissionNumber: s.admission_number,
      className: s.classes?.name ?? null,
    })),
  }
}

function assertBus(input: BusInput): void {
  if (!input.busNumber.trim()) throw new Error('Bus number / name is required.')
  if (!Number.isFinite(input.capacity) || input.capacity < 0) throw new Error('Capacity must be zero or more.')
}

export async function createBus(input: BusInput): Promise<void> {
  assertBus(input)
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('buses').insert({
    school_id: input.schoolId,
    bus_number: input.busNumber.trim(),
    registration_number: input.registrationNumber?.trim() || null,
    model: input.model?.trim() || null,
    capacity: input.capacity,
    route_name: input.routeName?.trim() || null,
    driver_name: input.driverName?.trim() || null,
    driver_phone: input.driverPhone?.trim() || null,
    driver_license: input.driverLicense?.trim() || null,
    attendant_name: input.attendantName?.trim() || null,
    attendant_phone: input.attendantPhone?.trim() || null,
    notes: input.notes?.trim() || null,
  })
  if (error) {
    throw new Error(error.message.includes('duplicate') ? 'A bus with that number already exists.' : error.message)
  }
}

export async function updateBus(id: string, input: BusInput): Promise<void> {
  assertBus(input)
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Don't allow shrinking capacity below the number already seated.
  const { count } = await db
    .from('student_transport')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', input.schoolId)
    .eq('bus_id', id)
  if (typeof count === 'number' && input.capacity > 0 && input.capacity < count) {
    throw new Error(`${count} students are assigned — capacity cannot be below that.`)
  }

  const { error } = await db
    .from('buses')
    .update({
      bus_number: input.busNumber.trim(),
      registration_number: input.registrationNumber?.trim() || null,
      model: input.model?.trim() || null,
      capacity: input.capacity,
      route_name: input.routeName?.trim() || null,
      driver_name: input.driverName?.trim() || null,
      driver_phone: input.driverPhone?.trim() || null,
      driver_license: input.driverLicense?.trim() || null,
      attendant_name: input.attendantName?.trim() || null,
      attendant_phone: input.attendantPhone?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', input.schoolId)
  if (error) throw new Error(error.message)
}

export async function deleteBus(schoolId: string, id: string): Promise<void> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { count } = await db
    .from('student_transport')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('bus_id', id)
  if (typeof count === 'number' && count > 0) {
    throw new Error('Students are still assigned to this bus. Reassign them before removing it.')
  }

  const { error } = await db
    .from('buses')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}

// ─── Stops ───────────────────────────────────────────────────

export async function addStop(input: StopInput): Promise<void> {
  if (!input.name.trim()) throw new Error('Stop name is required.')
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('bus_stops').insert({
    school_id: input.schoolId,
    bus_id: input.busId,
    name: input.name.trim(),
    pickup_time: input.pickupTime || null,
    drop_time: input.dropTime || null,
    stop_order: input.stopOrder,
  })
  if (error) throw new Error(error.message)
}

export async function deleteStop(schoolId: string, id: string): Promise<void> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('bus_stops').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}

// ─── Assignments ─────────────────────────────────────────────

export async function assignStudent(input: {
  schoolId: string
  studentId: string
  busId: string
  stopId: string | null
  pickupPoint: string | null
  fee: number
}): Promise<void> {
  if (!input.studentId) throw new Error('Select a student.')
  if (!input.busId) throw new Error('Select a bus.')
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.rpc('assign_student_transport', {
    p_school_id: input.schoolId,
    p_student_id: input.studentId,
    p_bus_id: input.busId,
    p_stop_id: input.stopId,
    p_pickup_point: input.pickupPoint?.trim() || null,
    p_fee: input.fee,
  })
  if (error) throw new Error(error.message)
}

export async function unassignStudent(schoolId: string, assignmentId: string): Promise<void> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('student_transport').delete().eq('id', assignmentId).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}
