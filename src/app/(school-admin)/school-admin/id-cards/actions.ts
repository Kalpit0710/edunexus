'use server'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Database } from '@/types/database.types'
import { createAdminClient, createClient as getSupabase } from '@/lib/supabase/server'
import { requireActor } from '@/lib/auth/require-actor'

type SchoolCardRow = Pick<Database['public']['Tables']['schools']['Row'], 'id' | 'name' | 'code' | 'logo_url'>
type StudentCardRow = Pick<
  Database['public']['Tables']['students']['Row'],
  'id' | 'full_name' | 'admission_number' | 'photo_url' | 'class_id' | 'section_id' | 'is_active' | 'school_id' | 'updated_at'
> & {
  classes: { name: string | null } | null
  sections: { name: string | null } | null
}
type TeacherCardRow = Pick<
  Database['public']['Tables']['teachers']['Row'],
  'id' | 'employee_id' | 'photo_url' | 'is_active' | 'school_id'
> & {
  user_profiles: { full_name: string | null } | null
}
type AttendanceExistingRow = Pick<Database['public']['Tables']['attendance_records']['Row'], 'id'>

type QrEntity = 'student' | 'teacher'

interface QrPayload {
  v: 1 | 2
  entity: QrEntity
  id: string
  schoolId: string
  profileSig?: string
  iat: number
  exp: number
}

interface SignedQrEnvelope {
  header: 'ENX1'
  payload: string
  signature: string
}

export interface IdCardSchoolInfo {
  id: string
  name: string
  code: string
  logoUrl: string | null
}

export interface StudentIdCard {
  id: string
  fullName: string
  admissionNumber: string
  className: string | null
  sectionName: string | null
  photoUrl: string | null
  qrText: string
}

export interface TeacherIdCard {
  id: string
  fullName: string
  employeeId: string | null
  photoUrl: string | null
  qrText: string
}

export interface IdCardsData {
  school: IdCardSchoolInfo
  students: StudentIdCard[]
  teachers: TeacherIdCard[]
}

export interface ScannedStudentInfo {
  entity: 'student'
  id: string
  fullName: string
  admissionNumber: string
  className: string | null
  sectionName: string | null
  photoUrl: string | null
}

export interface ScannedTeacherInfo {
  entity: 'teacher'
  id: string
  fullName: string
  employeeId: string | null
  photoUrl: string | null
}

export type ScannedInfo = ScannedStudentInfo | ScannedTeacherInfo

type StudentQrSignatureSource = Pick<
  Database['public']['Tables']['students']['Row'],
  'id' | 'school_id' | 'full_name' | 'admission_number' | 'class_id' | 'section_id' | 'updated_at'
>

const QR_TOKEN_HEADER = 'ENX1'
const QR_DEFAULT_TTL_DAYS = 365 * 3

function getQrSigningSecret(): string {
  const secret = process.env.ID_CARD_QR_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('QR signing secret is not configured. Set ID_CARD_QR_SECRET on the server.')
  }
  return secret
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(payloadBase64Url: string): string {
  return createHmac('sha256', getQrSigningSecret()).update(payloadBase64Url).digest('base64url')
}

function buildStudentProfileSignature(student: StudentQrSignatureSource): string {
  const plain = [
    student.id,
    student.school_id,
    student.full_name,
    student.admission_number,
    student.class_id ?? '',
    student.section_id ?? '',
    student.updated_at,
  ].join('|')

  return createHmac('sha256', getQrSigningSecret()).update(plain).digest('base64url')
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function buildQrText(payloadInput: Omit<QrPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000)
  const ttlSeconds = QR_DEFAULT_TTL_DAYS * 24 * 60 * 60
  const payload: QrPayload = {
    ...payloadInput,
    iat: now,
    exp: now + ttlSeconds,
  }

  const payloadBase64Url = toBase64Url(JSON.stringify(payload))
  const signature = signPayload(payloadBase64Url)
  const envelope: SignedQrEnvelope = {
    header: QR_TOKEN_HEADER,
    payload: payloadBase64Url,
    signature,
  }

  return `${envelope.header}.${envelope.payload}.${envelope.signature}`
}

export async function getStudentQrTokenForSchool(schoolId: string, studentId: string): Promise<string> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('students')
    .select('id, school_id, full_name, admission_number, class_id, section_id, updated_at')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Student not found for QR token generation.')

  const student = data as StudentQrSignatureSource
  return buildQrText({
    v: 2,
    entity: 'student',
    id: student.id,
    schoolId,
    profileSig: buildStudentProfileSignature(student),
  })
}

function parseQrText(qrText: string): QrPayload {
  const token = qrText.trim()
  const parts = token.split('.')

  if (parts.length !== 3 || parts[0] !== QR_TOKEN_HEADER) {
    throw new Error('Invalid QR token format. Please scan a valid EduNexus signed QR.')
  }

  const envelope: SignedQrEnvelope = {
    header: parts[0],
      payload: parts[1] ?? '',
      signature: parts[2] ?? '',
  }

  const expectedSig = signPayload(envelope.payload)
  const provided = Buffer.from(envelope.signature)
  const expected = Buffer.from(expectedSig)

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error('QR signature verification failed. The code may be tampered.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fromBase64Url(envelope.payload))
  } catch {
    throw new Error('QR payload is corrupted. Please regenerate the ID card QR.')
  }

  const value = parsed as Partial<QrPayload>
  if (
    (value?.v !== 1 && value?.v !== 2) ||
    (value?.entity !== 'student' && value?.entity !== 'teacher') ||
    typeof value?.id !== 'string' ||
    typeof value?.schoolId !== 'string' ||
    typeof value?.iat !== 'number' ||
    typeof value?.exp !== 'number'
  ) {
    throw new Error('Unsupported QR payload. Please scan a valid EduNexus signed QR.')
  }

  const now = Math.floor(Date.now() / 1000)
  if (value.exp < now) {
    throw new Error('This ID card QR has expired. Please regenerate the card.')
  }

  return value as QrPayload
}

export async function getIdCardsData(schoolId: string): Promise<IdCardsData> {
  const supabase = await getSupabase()
  const actor = await requireActor(supabase, ['school_admin'])
  if (actor.school_id !== schoolId) {
    throw new Error('Forbidden')
  }

  const [{ data: school }, { data: students }, { data: teachers }] = await Promise.all([
    supabase.from('schools').select('id, name, code, logo_url').eq('id', schoolId).single(),
    supabase
      .from('students')
        .select('id, full_name, admission_number, photo_url, class_id, section_id, is_active, school_id, updated_at, classes(name), sections(name)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('full_name', { ascending: true }),
    supabase
      .from('teachers')
      .select('id, employee_id, photo_url, is_active, school_id, user_profiles(full_name)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  const schoolRow = school as SchoolCardRow
  const studentRows = (students ?? []) as StudentCardRow[]
  const teacherRows = (teachers ?? []) as TeacherCardRow[]

  return {
    school: {
      id: schoolRow.id,
      name: schoolRow.name,
      code: schoolRow.code,
      logoUrl: schoolRow.logo_url,
    },
    students: studentRows.map((s) => ({
      id: s.id,
      fullName: s.full_name,
      admissionNumber: s.admission_number ?? '—',
      className: s.classes?.name ?? null,
      sectionName: s.sections?.name ?? null,
      photoUrl: s.photo_url,
      qrText: buildQrText({
        v: 2,
        entity: 'student',
        id: s.id,
        schoolId: schoolId,
        profileSig: buildStudentProfileSignature(s),
      }),
    })),
    teachers: teacherRows.map((t) => ({
      id: t.id,
      fullName: t.user_profiles?.full_name ?? 'Teacher',
      employeeId: t.employee_id,
      photoUrl: t.photo_url,
      qrText: buildQrText({ v: 1, entity: 'teacher', id: t.id, schoolId: schoolId }),
    })),
  }
}

export async function resolveQrInfo(qrText: string): Promise<ScannedInfo> {
  const supabase = await getSupabase()
  const actor = await requireActor(supabase, ['school_admin', 'teacher', 'manager', 'cashier'])
  const payload = parseQrText(qrText)

  if (!actor.school_id || actor.school_id !== payload.schoolId) {
    throw new Error('This QR does not belong to your school.')
  }

  if (payload.entity === 'student') {
    const { data } = await supabase
      .from('students')
      .select('id, full_name, admission_number, photo_url, school_id, class_id, section_id, updated_at, classes(name), sections(name)')
      .eq('id', payload.id)
      .eq('school_id', payload.schoolId)
      .maybeSingle()

    const row = data as (Pick<
      Database['public']['Tables']['students']['Row'],
      'id' | 'full_name' | 'admission_number' | 'photo_url' | 'school_id' | 'class_id' | 'section_id' | 'updated_at'
    > & {
      classes: { name: string | null } | null
      sections: { name: string | null } | null
    }) | null

    if (!row) throw new Error('Student not found for this QR code.')

    if (payload.v !== 2 || !payload.profileSig) {
      throw new Error('This student QR is outdated. Regenerate the ID card to continue.')
    }

    const expectedSig = buildStudentProfileSignature({
      id: row.id,
      school_id: row.school_id,
      full_name: row.full_name,
      admission_number: row.admission_number ?? '',
      class_id: row.class_id,
      section_id: row.section_id,
      updated_at: row.updated_at,
    })

    if (!signaturesMatch(payload.profileSig, expectedSig)) {
      throw new Error('Student details changed. Regenerate the ID card QR and scan again.')
    }

    return {
      entity: 'student',
      id: row.id,
      fullName: row.full_name,
      admissionNumber: row.admission_number ?? '—',
      className: row.classes?.name ?? null,
      sectionName: row.sections?.name ?? null,
      photoUrl: row.photo_url,
    }
  }

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, employee_id, photo_url, school_id, user_profiles(full_name)')
    .eq('id', payload.id)
    .eq('school_id', payload.schoolId)
    .maybeSingle()

  const row = teacher as (Pick<Database['public']['Tables']['teachers']['Row'], 'id' | 'employee_id' | 'photo_url'> & {
    user_profiles: { full_name: string | null } | null
  }) | null

  if (!row) throw new Error('Teacher not found for this QR code.')

  return {
    entity: 'teacher',
    id: row.id,
    fullName: row.user_profiles?.full_name ?? 'Teacher',
    employeeId: row.employee_id,
    photoUrl: row.photo_url,
  }
}

export async function markStudentAttendanceFromQr(qrText: string, date: string): Promise<{ marked: boolean }> {
  const supabase = await getSupabase()
  const actor = await requireActor(supabase, ['school_admin', 'teacher', 'manager', 'cashier'])
  const payload = parseQrText(qrText)

  if (payload.entity !== 'student') {
    throw new Error('Attendance scan supports Student ID cards only.')
  }

  if (payload.v !== 2 || !payload.profileSig) {
    throw new Error('This student QR is outdated. Regenerate the ID card to continue.')
  }

  if (!actor.school_id || actor.school_id !== payload.schoolId) {
    throw new Error('This QR does not belong to your school.')
  }

  const { data: student } = await supabase
    .from('students')
    .select('id, school_id, full_name, admission_number, class_id, section_id, is_active, updated_at')
    .eq('id', payload.id)
    .eq('school_id', payload.schoolId)
    .maybeSingle()

  const studentRow = student as Pick<
    Database['public']['Tables']['students']['Row'],
    'id' | 'school_id' | 'full_name' | 'admission_number' | 'class_id' | 'section_id' | 'is_active' | 'updated_at'
  > | null

  if (!studentRow || !studentRow.is_active) {
    throw new Error('Student not found or inactive.')
  }

  const expectedSig = buildStudentProfileSignature({
    id: studentRow.id,
    school_id: studentRow.school_id,
    full_name: studentRow.full_name,
    admission_number: studentRow.admission_number ?? '',
    class_id: studentRow.class_id,
    section_id: studentRow.section_id,
    updated_at: studentRow.updated_at,
  })

  if (!signaturesMatch(payload.profileSig, expectedSig)) {
    throw new Error('Student details changed. Regenerate the ID card QR and scan again.')
  }

  if (!studentRow.class_id || !studentRow.section_id) {
    throw new Error('Student class/section is not configured.')
  }

  const admin = await createAdminClient()

  const { data: existing } = await admin
    .from('attendance_records')
    .select('id')
    .eq('school_id', studentRow.school_id)
    .eq('student_id', studentRow.id)
    .eq('class_id', studentRow.class_id)
    .eq('section_id', studentRow.section_id)
    .eq('date', date)

  const existingRows = (existing ?? []) as AttendanceExistingRow[]
  if (existingRows.length > 0) {
    const ids = existingRows.map((r) => r.id)
    const { error: deleteError } = await admin.from('attendance_records').delete().in('id', ids)
    if (deleteError) throw new Error(deleteError.message)
  }

  const { error: insertError } = await admin.from('attendance_records').insert({
    school_id: studentRow.school_id,
    class_id: studentRow.class_id,
    section_id: studentRow.section_id,
    student_id: studentRow.id,
    date,
    status: 'present',
    marked_by: actor.id,
    remarks: 'Marked via QR scan',
  })

  if (insertError) throw new Error(insertError.message)
  return { marked: true }
}
