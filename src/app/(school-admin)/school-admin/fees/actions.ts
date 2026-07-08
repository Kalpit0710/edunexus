'use server'

import { createClient as createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { requireActor } from '@/lib/auth/require-actor'
import { requirePermission } from '@/lib/auth/permissions'
import { sendEmail } from '@/lib/email'
import { logAudit } from '@/lib/audit'
import { validateCollectFeeInput } from '@/lib/fee-utils'
import { FeeReceiptEmail } from '@/emails/FeeReceiptEmail'
import type { Database } from '@/types/database.types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FeeCategoryRow {
  id: string
  school_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface FeeStructureRow {
  id: string
  school_id: string
  class_id: string
  category_id: string
  academic_year_id: string
  amount: number
  due_date: string | null
  is_active: boolean
  // joined
  class_name?: string
  category_name?: string
  academic_year_name?: string
}

export interface FeePaymentRow {
  id: string
  school_id: string
  student_id: string
  receipt_number: string
  total_amount: number
  paid_amount: number
  discount_amount: number
  payment_mode: string
  payment_date: string
  collected_by: string
  reference_number: string | null
  remarks: string | null
  created_at: string
  // joined
  student_name?: string
  student_admission_number?: string
  items?: FeePaymentItemRow[]
}

export interface FeePaymentItemRow {
  id: string
  payment_id: string
  category_id: string
  amount: number
  category_name?: string
}

export interface AcademicYearRow {
  id: string
  name: string
  is_current: boolean
}

export interface CollectFeeInput {
  studentId: string
  items: { categoryId: string; amount: number }[]
  paidAmount: number
  discountAmount: number
  paymentMode: 'cash' | 'cheque' | 'upi' | 'neft' | 'card' | 'online'
  collectedById: string
  referenceNumber?: string
  remarks?: string
}

type FeeCategoryDbRow = Database['public']['Tables']['fee_categories']['Row']
type FeeStructureDbRow = Database['public']['Tables']['fee_structures']['Row']
type AcademicYearDbRow = Pick<Database['public']['Tables']['academic_years']['Row'], 'id' | 'name' | 'is_current'>
type StudentDbRow = Database['public']['Tables']['students']['Row']
type FeePaymentDbRow = Database['public']['Tables']['fee_payments']['Row']
type FeePaymentItemDbRow = Database['public']['Tables']['fee_payment_items']['Row']

type FeeStructureJoinedRow = FeeStructureDbRow & {
  classes: { name: string } | null
  fee_categories: { name: string } | null
  academic_years: { name: string } | null
}

type FeeStructureDeletedJoinedRow = Pick<FeeStructureDbRow, 'id' | 'amount' | 'deleted_at'> & {
  classes: { name: string } | null
  fee_categories: { name: string } | null
}

type StudentSearchJoinedRow = Pick<StudentDbRow, 'id' | 'full_name' | 'admission_number' | 'class_id' | 'section_id' | 'photo_url'> & {
  classes: { name: string } | null
  sections: { name: string } | null
}

type StudentForFeeStructureRow = Pick<StudentDbRow, 'id' | 'full_name' | 'admission_number' | 'class_id' | 'section_id'> & {
  classes: { name: string } | null
  sections: { name: string } | null
}

type FeeStructureForStudentRow = FeeStructureDbRow & {
  fee_categories: { name: string } | null
}

type PaymentWithItemsJoinedRow = FeePaymentDbRow & {
  fee_payment_items: Array<FeePaymentItemDbRow & { fee_categories: { name: string } | null }> | null
}

type PaymentWithStudentJoinedRow = FeePaymentDbRow & {
  students: Pick<StudentDbRow, 'full_name' | 'admission_number'> | null
}

type PaymentWithStudentClassJoinedRow = FeePaymentDbRow & {
  students: (Pick<StudentDbRow, 'full_name' | 'admission_number'> & { classes: { name: string } | null }) | null
}

interface PendingFeeRpcRow {
  student_id: string
  student_name: string
  admission_number: string | null
  class_name: string | null
  section_name: string | null
  total_fee: number | string
  total_paid: number | string
  balance: number | string
}

// ─── Category Actions ─────────────────────────────────────────────────────────

export async function getFeeCategories(schoolId: string): Promise<FeeCategoryRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('fee_categories')
    .select('*')
    .eq('school_id', schoolId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as FeeCategoryRow[]
}

export async function createFeeCategory(
  schoolId: string,
  name: string,
  description?: string,
): Promise<FeeCategoryRow> {
  const supabase = await createServerSupabaseClient()
  await requirePermission(supabase, 'fees.configure')
  const { data, error } = await supabase
    .from('fee_categories')
    .insert({ school_id: schoolId, name: name.trim(), description: description?.trim() || null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as FeeCategoryDbRow
}

export async function toggleCategoryStatus(categoryId: string, isActive: boolean): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('fee_categories')
    .update({ is_active: isActive })
    .eq('id', categoryId)
  if (error) throw new Error(error.message)
}

// ─── Structure Actions ────────────────────────────────────────────────────────

export async function getFeeStructures(schoolId: string, academicYearId?: string): Promise<FeeStructureRow[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('fee_structures')
    .select(`
      *,
      classes ( name ),
      fee_categories ( name ),
      academic_years ( name )
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  if (academicYearId) {
    query = query.eq('academic_year_id', academicYearId)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as FeeStructureJoinedRow[]).map(r => ({
    ...r,
    class_name: r.classes?.name,
    category_name: r.fee_categories?.name,
    academic_year_name: r.academic_years?.name,
  }))
}

/** List soft-deleted fee structures for the caller's school (for a restore UI). */
export async function getDeletedFeeStructures(
  schoolId: string,
  academicYearId?: string,
): Promise<{ id: string; label: string; deletedAt: string }[]> {
  const supabase = await createServerSupabaseClient()
  const actor = await requireActor(supabase, ['school_admin'])
  if (!actor.school_id || actor.school_id !== schoolId) {
    throw new Error('Item not found or not permitted.')
  }

  const admin = await createAdminClient()
  let query = admin
    .from('fee_structures')
    .select(`
      id, amount, deleted_at,
      classes ( name ),
      fee_categories ( name )
    `)
    .eq('school_id', actor.school_id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (academicYearId) {
    query = query.eq('academic_year_id', academicYearId)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as FeeStructureDeletedJoinedRow[]).map(r => {
    const cls = r.classes?.name ?? 'Unknown class'
    const cat = r.fee_categories?.name ?? 'Unknown category'
    return {
      id: r.id,
      label: `${cls} · ${cat} · ₹${Number(r.amount).toLocaleString('en-IN')}`,
      deletedAt: String(r.deleted_at),
    }
  })
}

export async function createFeeStructure(
  schoolId: string,
  classId: string,
  categoryId: string,
  academicYearId: string,
  amount: number,
  dueDate?: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requirePermission(supabase, 'fees.configure')
  const { error } = await supabase.from('fee_structures').insert({
    school_id: schoolId,
    class_id: classId,
    category_id: categoryId,
    academic_year_id: academicYearId,
    amount,
    due_date: dueDate || null,
  })
  if (error) throw new Error(error.message)
}

export async function updateFeeStructureAmount(structureId: string, amount: number): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requirePermission(supabase, 'fees.configure')
  const { error } = await supabase
    .from('fee_structures')
    .update({ amount })
    .eq('id', structureId)
  if (error) throw new Error(error.message)
}

export async function deleteFeeStructure(structureId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const actor = await requireActor(supabase, ['school_admin'])
  if (!actor.school_id) throw new Error('Your account is not linked to any school.')

  const admin = await createAdminClient()

  const { data: row, error: readErr } = await admin
    .from('fee_structures')
    .select('id, school_id')
    .eq('id', structureId)
    .maybeSingle()
  if (readErr) throw new Error(readErr.message)
  if (!row || row.school_id !== actor.school_id) {
    throw new Error('Fee structure not found or not permitted.')
  }

  const { error } = await admin
    .from('fee_structures')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', structureId)
    .eq('school_id', actor.school_id)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  await logAudit({
    schoolId: actor.school_id,
    actorId: actor.id,
    actorRole: actor.role,
    action: 'fee_structure.deleted',
    entityType: 'fee_structure',
    entityId: structureId,
  })
}

export async function restoreFeeStructure(structureId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const actor = await requireActor(supabase, ['school_admin'])
  if (!actor.school_id) throw new Error('Your account is not linked to any school.')

  const admin = await createAdminClient()

  const { data: row, error: readErr } = await admin
    .from('fee_structures')
    .select('id, school_id')
    .eq('id', structureId)
    .maybeSingle()
  if (readErr) throw new Error(readErr.message)
  if (!row || row.school_id !== actor.school_id) {
    throw new Error('Fee structure not found or not permitted.')
  }

  const { error } = await admin
    .from('fee_structures')
    .update({ deleted_at: null })
    .eq('id', structureId)
    .eq('school_id', actor.school_id)
    .not('deleted_at', 'is', null)
  if (error) throw new Error(error.message)

  await logAudit({
    schoolId: actor.school_id,
    actorId: actor.id,
    actorRole: actor.role,
    action: 'fee_structure.restored',
    entityType: 'fee_structure',
    entityId: structureId,
  })
}

// ─── Academic Year helpers ────────────────────────────────────────────────────

export async function getAcademicYearsForFees(schoolId: string): Promise<AcademicYearRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, name, is_current')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as AcademicYearDbRow[]
}

// ─── Payment (POS) Actions ────────────────────────────────────────────────────

export interface FeeStudentResult {
  id: string
  full_name: string
  admission_number: string
  class_id: string | null
  section_id: string | null
  class_name: string
  section_name: string
  photo_url: string | null
}

export async function searchStudentForFee(
  schoolId: string,
  query: string,
): Promise<FeeStudentResult | null> {
  const q = query.trim()
  if (!q) return null
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('students')
    .select('id, full_name, admission_number, class_id, section_id, photo_url, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .or(`admission_number.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const row = data as StudentSearchJoinedRow
  return {
    id: row.id,
    full_name: row.full_name,
    admission_number: row.admission_number,
    class_id: row.class_id ?? null,
    section_id: row.section_id ?? null,
    class_name: row.classes?.name ?? '',
    section_name: row.sections?.name ?? '',
    photo_url: row.photo_url ?? null,
  }
}

export async function searchStudentsForFeeLive(
  schoolId: string,
  query: string,
  limit = 8,
): Promise<FeeStudentResult[]> {
  const q = query.trim()
  if (!q) return []
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, admission_number, class_id, section_id, photo_url, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .or(`admission_number.ilike.%${q}%,full_name.ilike.%${q}%`)
    .order('full_name', { ascending: true })
    .limit(limit)
  
  if (error) throw new Error(error.message)
    return ((data ?? []) as StudentSearchJoinedRow[]).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    admission_number: row.admission_number,
      class_id: row.class_id ?? null,
      section_id: row.section_id ?? null,
    class_name: row.classes?.name ?? '',
    section_name: row.sections?.name ?? '',
    photo_url: row.photo_url ?? null,
  }))
}

export async function getStudentForFeeById(
  schoolId: string,
  studentId: string,
): Promise<FeeStudentResult | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, admission_number, class_id, section_id, photo_url, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .eq('id', studentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as StudentSearchJoinedRow
  return {
    id: row.id,
    full_name: row.full_name,
    admission_number: row.admission_number,
    class_id: row.class_id ?? null,
    section_id: row.section_id ?? null,
    class_name: row.classes?.name ?? '',
    section_name: row.sections?.name ?? '',
    photo_url: row.photo_url ?? null,
  }
}

export async function getStudentFeeStructure(
  schoolId: string,
  studentId: string,
): Promise<{ student: StudentForFeeStructureRow | null; structures: FeeStructureRow[]; currentYear: AcademicYearRow | null }> {
  const supabase = await createServerSupabaseClient()

  const [studentRes, yearRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, admission_number, class_id, section_id, classes(name), sections(name)')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .single(),
    supabase
      .from('academic_years')
      .select('id, name, is_current')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single(),
  ])

  const student = (studentRes.data as StudentForFeeStructureRow | null)
  const currentYear = (yearRes.data as AcademicYearDbRow | null)

  if (!student || !currentYear) return { student, structures: [], currentYear }
  if (!student.class_id) return { student, structures: [], currentYear }

  const { data: structs, error } = await supabase
    .from('fee_structures')
    .select('*, fee_categories(name)')
    .eq('school_id', schoolId)
    .eq('class_id', student.class_id)
    .eq('academic_year_id', currentYear.id)
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  const structures: FeeStructureRow[] = ((structs ?? []) as FeeStructureForStudentRow[]).map(r => ({
    ...r,
    category_name: r.fee_categories?.name,
  }))
  return { student, structures, currentYear }
}

export async function collectFeePayment(
  schoolId: string,
  receiptNumber: string,
  input: CollectFeeInput,
): Promise<{ paymentId: string; receiptNumber: string }> {
  // Validate the payment payload at the trust boundary (payment mode + amount
  // bounds) before touching the ledger.
  const validationError = validateCollectFeeInput(input)
  if (validationError) throw new Error(validationError)

  const supabase = await createServerSupabaseClient()
  await requirePermission(supabase, 'fees.collect')
  const totalAmount = input.items.reduce((s, i) => s + i.amount, 0)

  const tryReadExistingByReceipt = async (): Promise<{ paymentId: string; receiptNumber: string } | null> => {
    const { data: existing, error: existingErr } = await supabase
      .from('fee_payments')
      .select('id, student_id, paid_amount, total_amount, payment_mode')
      .eq('school_id', schoolId)
      .eq('receipt_number', receiptNumber)
      .maybeSingle()

    if (existingErr || !existing) return null

    const sameStudent = existing.student_id === input.studentId
    const samePaidAmount = Number(existing.paid_amount) === Number(input.paidAmount)
    const sameTotalAmount = Number(existing.total_amount) === Number(totalAmount)
    const samePaymentMode = String(existing.payment_mode) === String(input.paymentMode)

    if (!sameStudent || !samePaidAmount || !sameTotalAmount || !samePaymentMode) {
      throw new Error('Receipt number conflict detected. Please retry the payment.')
    }

    return { paymentId: existing.id, receiptNumber }
  }

  const { data: payment, error: payErr } = await supabase
    .from('fee_payments')
    .insert({
      school_id: schoolId,
      student_id: input.studentId,
      receipt_number: receiptNumber,
      total_amount: totalAmount,
      paid_amount: input.paidAmount,
      discount_amount: input.discountAmount,
      payment_mode: input.paymentMode,
      collected_by: input.collectedById,
      reference_number: input.referenceNumber || null,
      remarks: input.remarks || null,
    })
    .select('id')
    .single()

  if (payErr) {
    if (payErr.code === '23505') {
      const existing = await tryReadExistingByReceipt()
      if (existing) return existing
    }
    throw new Error(payErr.message)
  }

  const paymentId = payment.id
  const { error: itemErr } = await supabase.from('fee_payment_items').insert(
    input.items.map(i => ({
      payment_id: paymentId,
      category_id: i.categoryId,
      amount: i.amount,
    })),
  )
  if (itemErr) throw new Error(itemErr.message)

  // Audit trail: a fee collection is a financial state change.
  await logAudit({
    schoolId,
    actorId: input.collectedById,
    actorRole: 'school_admin',
    action: 'fee.payment.collected',
    entityType: 'fee_payment',
    entityId: paymentId,
    entityLabel: receiptNumber,
    metadata: {
      studentId: input.studentId,
      totalAmount,
      paidAmount: input.paidAmount,
      discountAmount: input.discountAmount,
      paymentMode: input.paymentMode,
    },
  })

  // Send Fee Receipt Email
  try {
    const { data: parent } = await supabase
      .from('parents')
      .select('full_name, email')
      .eq('student_id', input.studentId)
      .eq('is_primary', true)
      .maybeSingle()

    const { data: student } = await supabase
      .from('students')
      .select('full_name, schools(name)')
      .eq('id', input.studentId)
      .single()

    const pEmail = parent?.email
    if (pEmail && student) {
      await sendEmail({
        to: pEmail,
        subject: `Fee Receipt - ${student.full_name}`,
        react: FeeReceiptEmail({
          parentName: parent.full_name,
          studentName: student.full_name,
          schoolName: student.schools?.name || 'EduNexus',
          receiptNumber: receiptNumber,
          amountPaid: `₹${input.paidAmount}`,
          paymentMode: input.paymentMode,
          date: new Date().toLocaleDateString()
        }),
        schoolId,
        event: 'fee_receipt'
      })
    }
  } catch (err) {
    console.error('Failed to send fee receipt email:', err)
  }

  return { paymentId, receiptNumber }
}

export async function getPaymentsByStudent(
  schoolId: string,
  studentId: string,
  limit = 200,
): Promise<FeePaymentRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('fee_payments')
    .select(`*, fee_payment_items(*, fee_categories(name))`)
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as PaymentWithItemsJoinedRow[]).map(r => ({
    ...r,
    items: (r.fee_payment_items ?? []).map((item) => ({
      ...item,
      category_name: item.fee_categories?.name,
    })),
  }))
}

export async function getDailyCollectionReport(
  schoolId: string,
  date: string,
): Promise<{ totalCollected: number; paymentCount: number; payments: FeePaymentRow[] }> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('fee_payments')
    .select(`*, students(full_name, admission_number)`)
    .eq('school_id', schoolId)
    .eq('payment_date', date)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const payments: FeePaymentRow[] = ((data ?? []) as PaymentWithStudentJoinedRow[]).map(r => ({
    ...r,
    student_name: r.students?.full_name ?? 'Unknown',
    student_admission_number: r.students?.admission_number,
  }))
  const totalCollected = payments.reduce((s, p) => s + Number(p.paid_amount), 0)
  return { totalCollected, paymentCount: payments.length, payments }
}

// ─── Pending Fees ─────────────────────────────────────────────────────────────

export interface PendingFeeRow {
  studentId: string
  studentName: string
  admissionNumber: string
  className: string
  sectionName: string
  totalFee: number
  totalPaid: number
  balance: number
}

export async function getPendingFees(schoolId: string): Promise<PendingFeeRow[]> {
  const supabase = await createServerSupabaseClient()

  // Aggregation happens in the DB (get_pending_fees RPC) so we no longer pull
  // every student + every payment into Node and join them in memory. The RPC
  // returns only students with a positive balance, already sorted by balance.
  const { data, error } = await supabase.rpc('get_pending_fees', {
    p_school_id: schoolId,
  })
  if (error) throw new Error(error.message)

  return ((data ?? []) as PendingFeeRpcRow[]).map(r => ({
    studentId: r.student_id,
    studentName: r.student_name,
    admissionNumber: r.admission_number ?? '',
    className: r.class_name ?? '',
    sectionName: r.section_name ?? '',
    totalFee: Number(r.total_fee),
    totalPaid: Number(r.total_paid),
    balance: Number(r.balance),
  }))
}

export async function getStudentPaymentHistory(
  schoolId: string,
  studentId: string,
  limit = 200,
): Promise<FeePaymentRow[]> {
  return getPaymentsByStudent(schoolId, studentId, limit)
}

export async function getAllPayments(
  schoolId: string,
  opts?: { fromDate?: string; toDate?: string; studentQuery?: string },
): Promise<FeePaymentRow[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('fee_payments')
    .select(`*, students(full_name, admission_number, classes(name))`)
    .eq('school_id', schoolId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (opts?.fromDate) query = query.gte('payment_date', opts.fromDate)
  if (opts?.toDate) query = query.lte('payment_date', opts.toDate)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as PaymentWithStudentClassJoinedRow[]).map(r => ({
    ...r,
    student_name: r.students?.full_name ?? 'Unknown',
    student_admission_number: r.students?.admission_number,
    class_name: r.students?.classes?.name,
  }))
}

