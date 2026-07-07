// ─────────────────────────────────────────────────────────────────────────────
// Shared server-side fee-balance computation.
//
// Single source of truth for "how much does this student still owe?", used by
// both the parent fee-status view and the report-card fee guardrail so the two
// can never disagree.
//
//   balance = (active fee structures for the student's class in the *current*
//              academic year)  −  (all fee payments ever recorded)
//
// Note: `totalPaid` MUST sum every payment, not a recent slice — otherwise a
// student who paid in many installments would appear to still owe money and be
// wrongly locked out of their report card.
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentFeeBalance {
  totalFee: number
  totalPaid: number
  balance: number
}

/**
 * Computes a student's outstanding fee balance.
 *
 * @param db        A Supabase client with read access to the student's school
 *                  (service-role admin client, or an RLS-scoped user client).
 * @param schoolId  Tenant scope.
 * @param studentId Student to evaluate.
 * @param classId   The student's class (fees are configured per class). When
 *                  null, the student has no class fees and `totalFee` is 0.
 */
export async function computeStudentFeeBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  schoolId: string,
  studentId: string,
  classId: string | null,
): Promise<StudentFeeBalance> {
  let totalFee = 0

  if (classId) {
    const { data: yearData } = await db
      .from('academic_years')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle()

    if (yearData) {
      const { data: structs } = await db
        .from('fee_structures')
        .select('amount')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('academic_year_id', yearData.id)
        .eq('is_active', true)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalFee = ((structs ?? []) as any[]).reduce((s, r) => s + Number(r.amount), 0)
    }
  }

  // Library fines are recorded on book_loans.fine_amount and are treated as an
  // amount the student owes (folded into the fee balance so they surface in
  // Pending Fees / parent fee view — see migration
  // 20260702000001_library_fines_in_pending_fees). Kept in lockstep with the
  // get_pending_fees RPC so the admin list and this helper never disagree.
  const { data: fines } = await db
    .from('book_loans')
    .select('fine_amount')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .gt('fine_amount', 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  totalFee += ((fines ?? []) as any[]).reduce((s, l) => s + Number(l.fine_amount), 0)

  // Promotion carry-forward arrears are billed as "Previous Arrears".
  const { data: arrears } = await db
    .from('student_fee_arrears')
    .select('amount')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  totalFee += ((arrears ?? []) as any[]).reduce((s, a) => s + Number(a.amount), 0)

  // Sum every payment for this student — never a limited slice.
  const { data: payments } = await db
    .from('fee_payments')
    .select('paid_amount')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPaid = ((payments ?? []) as any[]).reduce((s, p) => s + Number(p.paid_amount), 0)

  return {
    totalFee,
    totalPaid,
    balance: Math.max(0, totalFee - totalPaid),
  }
}
