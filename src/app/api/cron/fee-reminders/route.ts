import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { FeeReminderEmail } from '@/emails/FeeReminderEmail'
import type { Database } from '@/types/database.types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Enforce cron secret if configured
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const db = supabase as any

  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Find installments that are overdue and pending
    const { data: installments } = await db
      .from('fee_installments')
      .select('id, school_id, student_id, due_date, total_amount, fee_structure_id')
      .eq('status', 'pending')
      .lt('due_date', today)

    if (!installments || installments.length === 0) {
      return NextResponse.json({ success: true, message: 'No overdue fees' })
    }

    const schoolIds = Array.from(new Set(installments.map((i: any) => i.school_id)))
    const studentIds = Array.from(new Set(installments.map((i: any) => i.student_id)))
    const structureIds = Array.from(new Set(installments.map((i: any) => i.fee_structure_id)))

    // Bulk fetch relations
    const [students, parents, structures, schools] = await Promise.all([
      db.from('students').select('id, full_name').in('id', studentIds),
      db.from('parents').select('student_id, first_name, email').in('student_id', studentIds).eq('is_primary', true),
      db.from('fee_structures').select('id, name').in('id', structureIds),
      db.from('schools').select('id, name').in('id', schoolIds)
    ])

    const emailsSent = []

    for (const inst of installments) {
      const student = students.data?.find((s: any) => s.id === inst.student_id)
      const parent = parents.data?.find((p: any) => p.student_id === inst.student_id)
      const structure = structures.data?.find((s: any) => s.id === inst.fee_structure_id)
      const school = schools.data?.find((s: any) => s.id === inst.school_id)

      if (student && parent && (parent as any).email && structure && school) {
        await sendEmail({
          to: (parent as any).email,
          subject: `Fee Reminder: ${structure.name}`,
          react: FeeReminderEmail({
            parentName: (parent as any).first_name,
            studentName: student.full_name,
            schoolName: school.name,
            feeName: structure.name,
            amountDue: `₹${inst.total_amount}`,
            dueDate: new Date(inst.due_date).toLocaleDateString()
          }),
          schoolId: inst.school_id,
          event: 'fee_reminder'
        })
        emailsSent.push(inst.id)
      }
    }

    return NextResponse.json({ success: true, processed: installments.length, emailsSent: emailsSent.length })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
