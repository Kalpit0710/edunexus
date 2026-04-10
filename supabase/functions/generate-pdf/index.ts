import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type PdfType = 'fee_receipt' | 'report_card' | 'report_card_batch' | 'inventory_bill'

interface GeneratePdfRequest {
  type: PdfType
  payment_id?: string
  student_id?: string
  exam_id?: string
  class_id?: string
  sale_id?: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PDF_BUCKET = Deno.env.get('PDF_BUCKET') ?? 'documents'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null
  }
  return authHeader.slice(7).trim()
}

function toAscii(input: string): string {
  return input.replace(/[^\x20-\x7E]/g, ' ')
}

function escapePdfText(input: string): string {
  return toAscii(input)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function createSimplePdf(lines: string[]): Uint8Array {
  const safeLines = lines.map((line) => line.trim()).filter(Boolean)
  const maxLinesPerPage = 46
  const pageChunks: string[][] = []

  for (let index = 0; index < safeLines.length; index += maxLinesPerPage) {
    pageChunks.push(safeLines.slice(index, index + maxLinesPerPage))
  }

  if (pageChunks.length === 0) {
    pageChunks.push(['EduNexus', 'No content available'])
  }

  const pageCount = pageChunks.length
  const fontObjectNumber = 3 + pageCount * 2
  const objectMap = new Map<number, string>()

  objectMap.set(1, '<< /Type /Catalog /Pages 2 0 R >>')

  const pageObjectNumbers = pageChunks.map((_, i) => 3 + i * 2)
  objectMap.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] /Count ${pageCount} >>`
  )

  pageChunks.forEach((chunk, i) => {
    const pageObjectNumber = 3 + i * 2
    const contentObjectNumber = 4 + i * 2

    const commands: string[] = ['BT', '/F1 11 Tf']
    let y = 806
    for (const line of chunk) {
      commands.push(`1 0 0 1 44 ${y} Tm (${escapePdfText(line)}) Tj`)
      y -= 16
      if (y < 56) break
    }
    commands.push('ET')

    const content = commands.join('\n')

    objectMap.set(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    )
    objectMap.set(contentObjectNumber, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  objectMap.set(fontObjectNumber, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  let pdf = '%PDF-1.4\n'
  const offsets = new Map<number, number>()
  const objectNumbers = Array.from(objectMap.keys()).sort((a, b) => a - b)
  const maxObjectNumber = Math.max(...objectNumbers)

  for (const objectNumber of objectNumbers) {
    offsets.set(objectNumber, pdf.length)
    pdf += `${objectNumber} 0 obj\n${objectMap.get(objectNumber)}\nendobj\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${maxObjectNumber + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let objectNumber = 1; objectNumber <= maxObjectNumber; objectNumber += 1) {
    const offset = offsets.get(objectNumber) ?? 0
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${maxObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new TextEncoder().encode(pdf)
}

async function ensureBucket(serviceClient: ReturnType<typeof createClient>, bucket: string) {
  const { data: existing } = await serviceClient.storage.getBucket(bucket)
  if (existing) return

  const { error } = await serviceClient.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: '10MB',
  })

  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Failed to ensure storage bucket: ${error.message}`)
  }
}

function requireEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables for generate-pdf function')
  }
}

async function requireAuthenticatedClient(req: Request) {
  const token = getBearerToken(req)
  if (!token) {
    throw new Error('Missing bearer token')
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token)

  if (error || !user) {
    throw new Error('Unauthorized request')
  }

  return userClient
}

async function buildFeeReceipt(
  userClient: ReturnType<typeof createClient>,
  paymentId: string
): Promise<{ schoolId: string; referenceId: string; lines: string[] }> {
  const { data: payment, error } = await userClient
    .from('fee_payments')
    .select(`
      id,
      school_id,
      receipt_number,
      payment_date,
      total_amount,
      paid_amount,
      discount_amount,
      payment_mode,
      reference_number,
      remarks,
      students(full_name, admission_number),
      fee_payment_items(amount, fee_categories(name))
    `)
    .eq('id', paymentId)
    .single()

  if (error || !payment) {
    throw new Error(error?.message ?? 'Fee payment not found')
  }

  const { data: schoolData } = await userClient
    .from('schools')
    .select('name, code')
    .eq('id', payment.school_id)
    .single()

  const lines: string[] = [
    `${schoolData?.name ?? 'School'} - Fee Receipt`,
    `Receipt No: ${payment.receipt_number}`,
    `Date: ${payment.payment_date}`,
    `Student: ${payment.students?.full_name ?? 'N/A'}`,
    `Admission No: ${payment.students?.admission_number ?? 'N/A'}`,
    `Payment Mode: ${String(payment.payment_mode).toUpperCase()}`,
  ]

  const items = (payment.fee_payment_items ?? []) as Array<{
    amount: number
    fee_categories?: { name?: string | null } | null
  }>

  if (items.length > 0) {
    lines.push('')
    lines.push('Fee Items:')
    for (const item of items.slice(0, 20)) {
      lines.push(`- ${item.fee_categories?.name ?? 'Fee Head'}: Rs ${Number(item.amount).toFixed(2)}`)
    }
  }

  lines.push('')
  lines.push(`Total: Rs ${Number(payment.total_amount).toFixed(2)}`)
  lines.push(`Discount: Rs ${Number(payment.discount_amount).toFixed(2)}`)
  lines.push(`Paid: Rs ${Number(payment.paid_amount).toFixed(2)}`)

  if (payment.reference_number) {
    lines.push(`Reference: ${payment.reference_number}`)
  }
  if (payment.remarks) {
    lines.push(`Remarks: ${payment.remarks}`)
  }

  return {
    schoolId: payment.school_id,
    referenceId: payment.id,
    lines,
  }
}

async function buildInventoryBill(
  userClient: ReturnType<typeof createClient>,
  saleId: string
): Promise<{ schoolId: string; referenceId: string; lines: string[] }> {
  const { data: sale, error } = await userClient
    .from('inventory_sales')
    .select(`
      id,
      school_id,
      bill_number,
      sale_date,
      total_amount,
      payment_mode,
      students(full_name, admission_number),
      inventory_sale_items(quantity, unit_price, total_price, inventory_items(name))
    `)
    .eq('id', saleId)
    .single()

  if (error || !sale) {
    throw new Error(error?.message ?? 'Inventory sale not found')
  }

  const { data: schoolData } = await userClient
    .from('schools')
    .select('name, code')
    .eq('id', sale.school_id)
    .single()

  const lines: string[] = [
    `${schoolData?.name ?? 'School'} - Inventory Bill`,
    `Bill No: ${sale.bill_number}`,
    `Date: ${new Date(sale.sale_date).toISOString().slice(0, 10)}`,
    `Customer: ${sale.students?.full_name ?? 'Walk-in'}`,
    `Admission No: ${sale.students?.admission_number ?? 'N/A'}`,
    `Payment Mode: ${String(sale.payment_mode).toUpperCase()}`,
    '',
    'Items:',
  ]

  const items = (sale.inventory_sale_items ?? []) as Array<{
    quantity: number
    unit_price: number
    total_price: number
    inventory_items?: { name?: string | null } | null
  }>

  for (const item of items.slice(0, 24)) {
    lines.push(
      `- ${item.inventory_items?.name ?? 'Item'} | Qty ${item.quantity} | Unit Rs ${Number(
        item.unit_price
      ).toFixed(2)} | Total Rs ${Number(item.total_price).toFixed(2)}`
    )
  }

  lines.push('')
  lines.push(`Grand Total: Rs ${Number(sale.total_amount).toFixed(2)}`)

  return {
    schoolId: sale.school_id,
    referenceId: sale.id,
    lines,
  }
}

async function buildReportCard(
  userClient: ReturnType<typeof createClient>,
  examId: string,
  studentId: string
): Promise<{ schoolId: string; referenceId: string; lines: string[] }> {
  const [{ data: exam, error: examError }, { data: student, error: studentError }] = await Promise.all([
    userClient
      .from('exams')
      .select('id, school_id, name, start_date, end_date')
      .eq('id', examId)
      .single(),
    userClient
      .from('students')
      .select('id, school_id, full_name, admission_number, roll_number')
      .eq('id', studentId)
      .single(),
  ])

  if (examError || !exam) throw new Error(examError?.message ?? 'Exam not found')
  if (studentError || !student) throw new Error(studentError?.message ?? 'Student not found')
  if (student.school_id !== exam.school_id) {
    throw new Error('Student and exam are not in the same school')
  }

  const { data: marks, error: marksError } = await userClient
    .from('marks')
    .select('marks_obtained, grade, is_absent, exam_subjects(max_marks, pass_marks, subjects(name, code))')
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .limit(200)

  if (marksError) throw new Error(marksError.message)

  const { data: schoolData } = await userClient
    .from('schools')
    .select('name, code')
    .eq('id', exam.school_id)
    .single()

  const lines: string[] = [
    `${schoolData?.name ?? 'School'} - Report Card`,
    `Exam: ${exam.name}`,
    `Student: ${student.full_name}`,
    `Admission No: ${student.admission_number ?? 'N/A'}`,
    `Roll No: ${student.roll_number ?? 'N/A'}`,
    '',
    'Subjects:',
  ]

  let totalMax = 0
  let totalObtained = 0

  for (const row of (marks ?? []) as Array<any>) {
    const subjectName = row.exam_subjects?.subjects?.name ?? 'Subject'
    const maxMarks = Number(row.exam_subjects?.max_marks ?? 0)
    const score = row.is_absent ? 'AB' : Number(row.marks_obtained ?? 0).toFixed(2)
    const grade = row.grade ?? '-'
    lines.push(`- ${subjectName}: ${score}/${maxMarks} | Grade ${grade}`)

    totalMax += maxMarks
    if (!row.is_absent && row.marks_obtained !== null) {
      totalObtained += Number(row.marks_obtained)
    }
  }

  const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : '0.00'
  lines.push('')
  lines.push(`Total: ${totalObtained.toFixed(2)} / ${totalMax}`)
  lines.push(`Percentage: ${percentage}%`)

  return {
    schoolId: exam.school_id,
    referenceId: `${exam.id}-${student.id}`,
    lines,
  }
}

async function buildReportCardBatch(
  userClient: ReturnType<typeof createClient>,
  examId: string,
  classId: string
): Promise<{ schoolId: string; referenceId: string; lines: string[] }> {
  const { data: exam, error: examError } = await userClient
    .from('exams')
    .select('id, school_id, class_id, name')
    .eq('id', examId)
    .single()

  if (examError || !exam) throw new Error(examError?.message ?? 'Exam not found')
  if (exam.class_id !== classId) {
    throw new Error('Exam is not associated with the requested class')
  }

  const { data: sections, error: sectionsError } = await userClient
    .from('sections')
    .select('id')
    .eq('school_id', exam.school_id)
    .eq('class_id', classId)
    .limit(200)

  if (sectionsError) throw new Error(sectionsError.message)

  const sectionIds = (sections ?? []).map((section) => section.id)
  if (!sectionIds.length) {
    throw new Error('No sections found for the selected class')
  }

  const { data: students, error: studentsError } = await userClient
    .from('students')
    .select('id, full_name, admission_number, roll_number')
    .eq('school_id', exam.school_id)
    .in('section_id', sectionIds)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .limit(2000)

  if (studentsError) throw new Error(studentsError.message)
  if (!(students ?? []).length) {
    throw new Error('No active students found in this class')
  }

  const [{ data: examSubjects, error: examSubjectsError }, { data: marks, error: marksError }] = await Promise.all([
    userClient
      .from('exam_subjects')
      .select('id, max_marks, pass_marks, subjects(name)')
      .eq('school_id', exam.school_id)
      .eq('exam_id', examId)
      .order('exam_date', { ascending: true })
      .limit(200),
    userClient
      .from('marks')
      .select('student_id, exam_subject_id, marks_obtained, grade, is_absent')
      .eq('school_id', exam.school_id)
      .eq('exam_id', examId)
      .in(
        'student_id',
        (students ?? []).map((student) => student.id)
      )
      .limit(20000),
  ])

  if (examSubjectsError) throw new Error(examSubjectsError.message)
  if (marksError) throw new Error(marksError.message)

  const subjectsById = new Map<string, any>((examSubjects ?? []).map((subject) => [subject.id, subject]))
  const marksByStudent = new Map<string, any[]>()

  for (const mark of marks ?? []) {
    const studentMarks = marksByStudent.get(mark.student_id) ?? []
    studentMarks.push(mark)
    marksByStudent.set(mark.student_id, studentMarks)
  }

  const { data: schoolData } = await userClient
    .from('schools')
    .select('name')
    .eq('id', exam.school_id)
    .single()

  const lines: string[] = [`${schoolData?.name ?? 'School'} - Class Report Card Batch`, `Exam: ${exam.name}`, '']

  for (const student of students ?? []) {
    lines.push('------------------------------------------------------------')
    lines.push(`Student: ${student.full_name}`)
    lines.push(`Admission No: ${student.admission_number ?? 'N/A'} | Roll No: ${student.roll_number ?? 'N/A'}`)

    let totalMax = 0
    let totalObtained = 0

    const studentMarks = marksByStudent.get(student.id) ?? []
    for (const mark of studentMarks) {
      const subject = subjectsById.get(mark.exam_subject_id)
      const subjectName = subject?.subjects?.name ?? 'Subject'
      const maxMarks = Number(subject?.max_marks ?? 0)
      const secured = mark.is_absent ? 'AB' : Number(mark.marks_obtained ?? 0).toFixed(2)
      lines.push(`- ${subjectName}: ${secured}/${maxMarks} | Grade ${mark.grade ?? '-'}`)

      totalMax += maxMarks
      if (!mark.is_absent && mark.marks_obtained !== null) {
        totalObtained += Number(mark.marks_obtained)
      }
    }

    const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : '0.00'
    lines.push(`Total: ${totalObtained.toFixed(2)} / ${totalMax}`)
    lines.push(`Percentage: ${percentage}%`)
    lines.push('')
  }

  return {
    schoolId: exam.school_id,
    referenceId: `${exam.id}-${classId}-batch`,
    lines,
  }
}

async function generateDocument(
  userClient: ReturnType<typeof createClient>,
  body: GeneratePdfRequest
) {
  switch (body.type) {
    case 'fee_receipt': {
      if (!body.payment_id) throw new Error('payment_id is required for fee_receipt')
      return buildFeeReceipt(userClient, body.payment_id)
    }
    case 'inventory_bill': {
      if (!body.sale_id) throw new Error('sale_id is required for inventory_bill')
      return buildInventoryBill(userClient, body.sale_id)
    }
    case 'report_card': {
      if (!body.exam_id || !body.student_id) {
        throw new Error('exam_id and student_id are required for report_card')
      }
      return buildReportCard(userClient, body.exam_id, body.student_id)
    }
    case 'report_card_batch': {
      if (!body.exam_id || !body.class_id) {
        throw new Error('exam_id and class_id are required for report_card_batch')
      }
      return buildReportCardBatch(userClient, body.exam_id, body.class_id)
    }
    default:
      throw new Error('Unsupported PDF type')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    requireEnv()

    const body = (await req.json()) as GeneratePdfRequest
    if (!body?.type) {
      return jsonResponse({ error: 'type is required' }, 400)
    }

    const userClient = await requireAuthenticatedClient(req)
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { schoolId, referenceId, lines } = await generateDocument(userClient, body)

    const documentLines = [
      'EduNexus',
      `Document Type: ${body.type}`,
      `Generated At: ${new Date().toISOString()}`,
      '',
      ...lines,
    ]

    const pdfBytes = createSimplePdf(documentLines)

    await ensureBucket(serviceClient, PDF_BUCKET)

    const safeReference = referenceId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = `${schoolId}/${body.type}/${safeReference}-${Date.now()}.pdf`

    const { error: uploadError } = await serviceClient.storage
      .from(PDF_BUCKET)
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data: signed, error: signedError } = await serviceClient.storage
      .from(PDF_BUCKET)
      .createSignedUrl(filePath, 60 * 60)

    if (signedError || !signed?.signedUrl) {
      throw new Error(signedError?.message ?? 'Failed to create signed URL')
    }

    return jsonResponse({
      url: signed.signedUrl,
      storage_path: filePath,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('bearer')
      ? 401
      : 500

    return jsonResponse({ error: message }, status)
  }
})
