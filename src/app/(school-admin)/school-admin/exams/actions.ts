'use server'

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import {
  calculatePercentage,
  canEnterMarks,
  resolveGradeFromRules,
  validateMarksEntry,
  type ExamStatus,
  type GradingRule,
} from '@/lib/exam-utils'
import { sendEmail } from '@/lib/email'
import { ExamPublishedEmail } from '@/emails/ExamPublishedEmail'

export interface ExamSubjectInput {
  subjectId: string
  examDate?: string
  startTime?: string
  durationMins?: number
  maxMarks: number
  passMarks?: number
}

export interface CreateExamInput {
  classId: string
  academicYearId?: string | null
  name: string
  startDate?: string
  endDate?: string
  subjects: ExamSubjectInput[]
  createdByProfileId?: string
}

export interface MarkEntryInput {
  studentId: string
  marksObtained: number | null
  isAbsent?: boolean
}

export interface ClassPerformanceRow {
  examSubjectId: string
  subjectId: string
  subjectName: string
  subjectCode: string | null
  maxMarks: number
  passMarks: number
  averageMarks: number
  passCount: number
  failCount: number
  absentCount: number
  presentCount: number
  recordedCount: number
  studentCount: number
}

export interface TopperRow {
  rank: number
  studentId: string
  studentName: string
  admissionNumber: string
  totalMarks: number
  subjectsCount: number
  percentage: number
}

async function getActorProfileId(
  db: any,
  schoolId: string,
  providedProfileId?: string
): Promise<string | null> {
  if (providedProfileId) return providedProfileId

  const { data: userResult, error: userError } = await db.auth.getUser()
  if (userError || !userResult?.user) return null

  const { data: profile } = await db
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', userResult.user.id)
    .eq('school_id', schoolId)
    .maybeSingle()

  return profile?.id ?? null
}

export async function getExams(
  schoolId: string,
  opts?: {
    classId?: string
    status?: ExamStatus
    limit?: number
  }
) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  let query = db
    .from('exams')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50)

  if (opts?.classId) query = query.eq('class_id', opts.classId)
  if (opts?.status) query = query.eq('status', opts.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getExamById(schoolId: string, examId: string) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { data, error } = await db
    .from('exams')
    .select('*')
    .eq('school_id', schoolId)
    .eq('id', examId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function getExamSubjects(schoolId: string, examId: string) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { data, error } = await db
    .from('exam_subjects')
    .select('*, subjects(name, code)')
    .eq('school_id', schoolId)
    .eq('exam_id', examId)
    .order('exam_date', { ascending: true })
    .limit(100)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createExam(schoolId: string, input: CreateExamInput) {
  if (!input.name.trim()) throw new Error('Exam name is required.')
  if (!input.classId) throw new Error('Class is required.')
  if (!input.subjects.length) throw new Error('At least one exam subject is required.')

  const subjectIds = input.subjects.map(subject => subject.subjectId)
  if (new Set(subjectIds).size !== subjectIds.length) {
    throw new Error('Duplicate subject entries are not allowed for the same exam.')
  }

  for (const subject of input.subjects) {
    if (subject.maxMarks <= 0) {
      throw new Error('Maximum marks must be greater than 0.')
    }
    if ((subject.passMarks ?? 33) > subject.maxMarks) {
      throw new Error('Pass marks cannot be greater than maximum marks.')
    }
  }

  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const actorProfileId = await getActorProfileId(db, schoolId, input.createdByProfileId)

  const { data: examRow, error: examError } = await db
    .from('exams')
    .insert({
      school_id: schoolId,
      class_id: input.classId,
      academic_year_id: input.academicYearId ?? null,
      name: input.name.trim(),
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      status: 'draft',
      created_by: actorProfileId,
    })
    .select('*')
    .single()

  if (examError) throw new Error(examError.message)

  const examSubjectsPayload = input.subjects.map(subject => ({
    school_id: schoolId,
    exam_id: examRow.id,
    subject_id: subject.subjectId,
    exam_date: subject.examDate ?? null,
    start_time: subject.startTime ?? null,
    duration_mins: subject.durationMins ?? null,
    max_marks: subject.maxMarks,
    pass_marks: subject.passMarks ?? 33,
  }))

  const { error: examSubjectsError } = await db.from('exam_subjects').insert(examSubjectsPayload)
  if (examSubjectsError) throw new Error(examSubjectsError.message)

  return examRow
}

export async function updateExamStatus(
  schoolId: string,
  examId: string,
  status: ExamStatus,
  resultVisible?: boolean
) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { error } = await db
    .from('exams')
    .update({
      status,
      result_visible: resultVisible,
    })
    .eq('school_id', schoolId)
    .eq('id', examId)

  if (error) throw new Error(error.message)
}

export async function saveExamMarks(
  schoolId: string,
  examId: string,
  examSubjectId: string,
  rows: MarkEntryInput[],
  enteredByProfileId?: string
): Promise<{ savedCount: number }> {
  if (!rows.length) return { savedCount: 0 }

  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const [{ data: examRow, error: examError }, { data: subjectRow, error: subjectError }] =
    await Promise.all([
      db
        .from('exams')
        .select('id, class_id, status')
        .eq('school_id', schoolId)
        .eq('id', examId)
        .single(),
      db
        .from('exam_subjects')
        .select('id, exam_id, max_marks')
        .eq('school_id', schoolId)
        .eq('id', examSubjectId)
        .eq('exam_id', examId)
        .single(),
    ])

  if (examError) throw new Error(examError.message)
  if (subjectError) throw new Error(subjectError.message)

  if (!canEnterMarks(examRow.status as ExamStatus)) {
    throw new Error('Marks can only be entered when exam status is published or ongoing.')
  }

  const { data: gradingRulesData, error: gradingRulesError } = await db
    .from('grading_rules')
    .select('min_marks, max_marks, grade_name')
    .eq('school_id', schoolId)
    .or(`class_id.eq.${examRow.class_id},class_id.is.null`)
    .order('min_marks', { ascending: false })
    .limit(50)

  if (gradingRulesError) throw new Error(gradingRulesError.message)

  const gradingRules = (gradingRulesData ?? []) as GradingRule[]
  const actorProfileId = await getActorProfileId(db, schoolId, enteredByProfileId)

  const validationErrors: string[] = []
  const payload = rows.map((row, index) => {
    const isAbsent = row.isAbsent ?? false
    const marksObtained = row.marksObtained

    const rowErrors = validateMarksEntry({
      marksObtained,
      isAbsent,
      maxMarks: subjectRow.max_marks,
    })

    if (rowErrors.length) {
      validationErrors.push(`Row ${index + 1}: ${rowErrors.join(' ')}`)
    }

    const percentage = !isAbsent && marksObtained !== null
      ? calculatePercentage(marksObtained, subjectRow.max_marks)
      : 0

    const grade = !isAbsent && marksObtained !== null
      ? resolveGradeFromRules(percentage, gradingRules)
      : null

    return {
      school_id: schoolId,
      exam_id: examId,
      exam_subject_id: examSubjectId,
      student_id: row.studentId,
      marks_obtained: isAbsent ? null : marksObtained,
      grade,
      is_absent: isAbsent,
      entered_by: actorProfileId,
      entered_at: new Date().toISOString(),
    }
  })

  if (validationErrors.length) {
    throw new Error(validationErrors.join(' | '))
  }

  const { error: upsertError } = await db
    .from('marks')
    .upsert(payload, { onConflict: 'exam_subject_id,student_id' })

  if (upsertError) throw new Error(upsertError.message)
  return { savedCount: payload.length }
}

export async function publishExamResults(examId: string, notifyParents = true) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { data, error } = await db.rpc('publish_exam_results', {
    p_exam_id: examId,
    p_notify_parents: notifyParents,
  })

  if (error) throw new Error(error.message)
  return data
}

export async function unlockExamResults(examId: string) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { data, error } = await db.rpc('unlock_exam_results', {
    p_exam_id: examId,
  })

  if (error) throw new Error(error.message)
  return data as boolean
}

export async function getClassPerformanceReport(
  schoolId: string,
  examId: string
): Promise<ClassPerformanceRow[]> {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { data: examRow, error: examError } = await db
    .from('exams')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('id', examId)
    .single()

  if (examError) throw new Error(examError.message)

  const [{ data: subjectsData, error: subjectsError }, { data: marksData, error: marksError }, { count: studentCount, error: studentsError }] =
    await Promise.all([
      db
        .from('exam_subjects')
        .select('id, subject_id, max_marks, pass_marks, subjects(name, code)')
        .eq('school_id', schoolId)
        .eq('exam_id', examId)
        .limit(200),
      db
        .from('marks')
        .select('exam_subject_id, marks_obtained, is_absent')
        .eq('school_id', schoolId)
        .eq('exam_id', examId)
        .limit(10000),
      db
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('class_id', (examRow as any)?.class_id ?? '')
        .eq('is_active', true),
    ])
  if (subjectsError) throw new Error(subjectsError.message)
  if (marksError) throw new Error(marksError.message)
  if (studentsError) throw new Error(studentsError.message)

  const marksBySubject = new Map<string, { marksObtained: number | null; isAbsent: boolean }[]>()
  for (const markRow of marksData ?? []) {
    const bucket = marksBySubject.get(markRow.exam_subject_id) ?? []
    bucket.push({
      marksObtained: markRow.marks_obtained,
      isAbsent: markRow.is_absent,
    })
    marksBySubject.set(markRow.exam_subject_id, bucket)
  }

  const totalStudents = studentCount ?? 0

  return (subjectsData ?? []).map((subjectRow: any) => {
    const rows = marksBySubject.get(subjectRow.id) ?? []
    const presentRows = rows.filter(row => !row.isAbsent && row.marksObtained !== null)
    const absentCount = rows.length - presentRows.length
    const recordedCount = rows.length
    const presentCount = presentRows.length

    const totalMarks = presentRows.reduce((sum, row) => sum + Number(row.marksObtained), 0)
    const averageMarks = presentRows.length ? Number((totalMarks / presentRows.length).toFixed(2)) : 0
    const passCount = presentRows.filter(
      row => Number(row.marksObtained) >= Number(subjectRow.pass_marks)
    ).length

    return {
      examSubjectId: subjectRow.id,
      subjectId: subjectRow.subject_id,
      subjectName: subjectRow.subjects?.name ?? 'Unknown Subject',
      subjectCode: subjectRow.subjects?.code ?? null,
      maxMarks: Number(subjectRow.max_marks),
      passMarks: Number(subjectRow.pass_marks),
      averageMarks,
      passCount,
      failCount: Math.max(0, presentRows.length - passCount),
      absentCount,
      presentCount,
      recordedCount,
      studentCount: totalStudents,
    }
  })
}

export async function getTopperList(
  schoolId: string,
  examId: string,
  limit = 10
): Promise<TopperRow[]> {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const [{ data: subjectRows, error: subjectsError }, { data: marksRows, error: marksError }] =
    await Promise.all([
      db
        .from('exam_subjects')
        .select('id, max_marks')
        .eq('school_id', schoolId)
        .eq('exam_id', examId)
        .limit(200),
      db
        .from('marks')
        .select('student_id, marks_obtained, is_absent, students(full_name, admission_number)')
        .eq('school_id', schoolId)
        .eq('exam_id', examId)
        .limit(10000),
    ])

  if (subjectsError) throw new Error(subjectsError.message)
  if (marksError) throw new Error(marksError.message)

  const examTotalMax = (subjectRows ?? []).reduce(
    (sum: number, row: { max_marks: number }) => sum + Number(row.max_marks),
    0
  )

  const aggregate = new Map<
    string,
    { studentName: string; admissionNumber: string; totalMarks: number; subjectsCount: number }
  >()

  for (const row of marksRows ?? []) {
    const current = aggregate.get(row.student_id) ?? {
      studentName: row.students?.full_name ?? 'Unknown Student',
      admissionNumber: row.students?.admission_number ?? '',
      totalMarks: 0,
      subjectsCount: 0,
    }

    if (!row.is_absent && row.marks_obtained !== null) {
      current.totalMarks += Number(row.marks_obtained)
    }

    current.subjectsCount += 1
    aggregate.set(row.student_id, current)
  }

  return [...aggregate.entries()]
    .map(([studentId, value]) => ({
      studentId,
      ...value,
      percentage: examTotalMax > 0 ? Number(((value.totalMarks / examTotalMax) * 100).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.totalMarks - left.totalMarks)
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      studentId: row.studentId,
      studentName: row.studentName,
      admissionNumber: row.admissionNumber,
      totalMarks: Number(row.totalMarks.toFixed(2)),
      subjectsCount: row.subjectsCount,
      percentage: row.percentage,
    }))
}

export async function getStudentReportCardData(
  schoolId: string,
  examId: string,
  studentId: string
) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const [{ data: examRow, error: examError }, { data: studentRow, error: studentError }] = await Promise.all([
    db
      .from('exams')
      .select('*')
      .eq('school_id', schoolId)
      .eq('id', examId)
      .single(),
    db
      .from('students')
      .select('id, full_name, admission_number, roll_number')
      .eq('school_id', schoolId)
      .eq('id', studentId)
      .single(),
  ])

  if (examError) throw new Error(examError.message)
  if (studentError) throw new Error(studentError.message)

  const { data: marksRows, error: marksError } = await db
    .from('marks')
    .select('marks_obtained, grade, is_absent, exam_subjects(max_marks, pass_marks, subjects(name, code))')
    .eq('school_id', schoolId)
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .limit(200)

  if (marksError) throw new Error(marksError.message)

  const rows: Array<{
    subjectName: string
    subjectCode: string | null
    maxMarks: number
    passMarks: number
    marksObtained: number | null
    grade: string | null
    isAbsent: boolean
  }> = (marksRows ?? []).map((row: any) => ({
    subjectName: row.exam_subjects?.subjects?.name ?? 'Unknown Subject',
    subjectCode: row.exam_subjects?.subjects?.code ?? null,
    maxMarks: Number(row.exam_subjects?.max_marks ?? 0),
    passMarks: Number(row.exam_subjects?.pass_marks ?? 0),
    marksObtained: row.marks_obtained === null ? null : Number(row.marks_obtained),
    grade: row.grade ?? null,
    isAbsent: row.is_absent,
  }))

  const totalMax = rows.reduce((sum: number, row) => sum + row.maxMarks, 0)
  const totalObtained = rows.reduce((sum: number, row) => sum + (row.marksObtained ?? 0), 0)
  const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0

  return {
    exam: examRow,
    student: studentRow,
    rows,
    summary: {
      totalMax,
      totalObtained: Number(totalObtained.toFixed(2)),
      percentage,
    },
  }
}
