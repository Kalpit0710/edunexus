'use server'

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'

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
  const db = supabase as any
  const { data, error } = await db
    .from('fee_categories')
    .insert({ school_id: schoolId, name: name.trim(), description: description?.trim() || null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as FeeCategoryRow
}

export async function toggleCategoryStatus(categoryId: string, isActive: boolean): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any
  const { error } = await db
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
  return ((data ?? []) as any[]).map(r => ({
    ...r,
    class_name: r.classes?.name,
    category_name: r.fee_categories?.name,
    academic_year_name: r.academic_years?.name,
  }))
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
  const db = supabase as any
  const { error } = await db.from('fee_structures').insert({
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
  const db = supabase as any
  const { error } = await db
    .from('fee_structures')
    .update({ amount })
    .eq('id', structureId)
  if (error) throw new Error(error.message)
}

export async function deleteFeeStructure(structureId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('fee_structures').delete().eq('id', structureId)
  if (error) throw new Error(error.message)
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
  return (data ?? []) as AcademicYearRow[]
}

// ─── Payment (POS) Actions ────────────────────────────────────────────────────

export async function searchStudentForFee(
  schoolId: string,
  query: string,
): Promise<{ id: string; full_name: string; admission_number: string; class_id: string; section_id: string; class_name: string; section_name: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('students')
    .select('id, full_name, admission_number, class_id, section_id, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .or(`admission_number.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    id: (data as any).id,
    full_name: (data as any).full_name,
    admission_number: (data as any).admission_number,
    class_id: (data as any).class_id,
    section_id: (data as any).section_id,
    class_name: (data as any).classes?.name ?? '',
    section_name: (data as any).sections?.name ?? '',
  }
}

export async function getStudentFeeStructure(
  schoolId: string,
  studentId: string,
): Promise<{ student: any; structures: FeeStructureRow[]; currentYear: AcademicYearRow | null }> {
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

  const student = studentRes.data
  const currentYear = yearRes.data as AcademicYearRow | null

  if (!student || !currentYear) return { student, structures: [], currentYear }

  const { data: structs, error } = await supabase
    .from('fee_structures')
    .select('*, fee_categories(name)')
    .eq('school_id', schoolId)
    .eq('class_id', (student as any).class_id)
    .eq('academic_year_id', currentYear.id)
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  const structures: FeeStructureRow[] = ((structs ?? []) as any[]).map(r => ({
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
  const supabase = await createServerSupabaseClient()
  const db = supabase as any
  const totalAmount = input.items.reduce((s, i) => s + i.amount, 0)

  const { data: payment, error: payErr } = await db
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
  if (payErr) throw new Error(payErr.message)

  const paymentId = (payment as any).id as string
  const { error: itemErr } = await db.from('fee_payment_items').insert(
    input.items.map(i => ({
      payment_id: paymentId,
      category_id: i.categoryId,
      amount: i.amount,
    })),
  )
  if (itemErr) throw new Error(itemErr.message)

  return { paymentId, receiptNumber }
}

export async function getNextReceiptSeq(schoolId: string): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { count } = await supabase
    .from('fee_payments')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
  return (count ?? 0) + 1
}

export async function getPaymentsByStudent(
  schoolId: string,
  studentId: string,
): Promise<FeePaymentRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('fee_payments')
    .select(`*, fee_payment_items(*, fee_categories(name))`)
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[]).map(r => ({
    ...r,
    items: (r.fee_payment_items ?? []).map((item: any) => ({
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

  const payments: FeePaymentRow[] = ((data ?? []) as any[]).map(r => ({
    ...r,
    student_name: r.students?.full_name ?? 'Unknown',
    student_admission_number: r.students?.admission_number,
  }))
  const totalCollected = payments.reduce((s, p) => s + Number(p.paid_amount), 0)
  return { totalCollected, paymentCount: payments.length, payments }
}
