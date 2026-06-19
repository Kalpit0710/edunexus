'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'

export interface IssueTCInput {
  schoolId: string
  studentId: string
  issueDate: string
  leavingDate: string | null
  reason: string | null
  conduct: string | null
  remarks: string | null
  deactivate: boolean
}

export interface TransferCertificateSummary {
  id: string
  tcNumber: string
  issueDate: string
  reason: string | null
}

export interface TransferCertificateView {
  id: string
  tcNumber: string
  issueDate: string
  leavingDate: string | null
  reason: string | null
  conduct: string | null
  remarks: string | null
  studentName: string
  admissionNumber: string | null
  className: string | null
  dateOfBirth: string | null
  admissionDate: string | null
  issuedByName: string | null
  school: {
    name: string
    code: string | null
    address: string | null
    city: string | null
    state: string | null
    pincode: string | null
    phone: string | null
    email: string | null
    logoUrl: string | null
  }
}

/** Issues a TC atomically via the SECURITY DEFINER RPC. Returns the new TC id. */
export async function issueTransferCertificate(input: IssueTCInput): Promise<{ id: string }> {
  if (!input.issueDate) throw new Error('Issue date is required.')
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db.rpc('issue_transfer_certificate', {
    p_school_id: input.schoolId,
    p_student_id: input.studentId,
    p_issue_date: input.issueDate,
    p_leaving_date: input.leavingDate,
    p_reason: input.reason?.trim() || null,
    p_conduct: input.conduct?.trim() || null,
    p_remarks: input.remarks?.trim() || null,
    p_deactivate: input.deactivate,
  })
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = Array.isArray(data) ? (data[0] as any) : (data as any)
  if (!row?.id) throw new Error('Transfer certificate could not be created.')
  return { id: row.id }
}

export async function getStudentTransferCertificates(
  schoolId: string,
  studentId: string,
): Promise<TransferCertificateSummary[]> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('transfer_certificates')
    .select('id, tc_number, issue_date, reason')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('issue_date', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((t) => ({
    id: t.id,
    tcNumber: t.tc_number,
    issueDate: t.issue_date,
    reason: t.reason,
  }))
}

/** Full certificate + school letterhead, for the printable view. */
export async function getTransferCertificate(tcId: string): Promise<TransferCertificateView | null> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: tc, error } = await db
    .from('transfer_certificates')
    .select('*')
    .eq('id', tcId)
    .maybeSingle()

  if (error || !tc) return null

  const { data: school } = await db
    .from('schools')
    .select('name, code, address, city, state, pincode, phone, email, logo_url')
    .eq('id', tc.school_id)
    .maybeSingle()

  return {
    id: tc.id,
    tcNumber: tc.tc_number,
    issueDate: tc.issue_date,
    leavingDate: tc.leaving_date,
    reason: tc.reason,
    conduct: tc.conduct,
    remarks: tc.remarks,
    studentName: tc.student_name,
    admissionNumber: tc.admission_number,
    className: tc.class_name,
    dateOfBirth: tc.date_of_birth,
    admissionDate: tc.admission_date,
    issuedByName: tc.issued_by_name,
    school: {
      name: school?.name ?? 'School',
      code: school?.code ?? null,
      address: school?.address ?? null,
      city: school?.city ?? null,
      state: school?.state ?? null,
      pincode: school?.pincode ?? null,
      phone: school?.phone ?? null,
      email: school?.email ?? null,
      logoUrl: school?.logo_url ?? null,
    },
  }
}
