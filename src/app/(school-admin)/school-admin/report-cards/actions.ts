'use server'

import {
  createClient as createServerSupabaseClient,
  createAdminClient,
} from '@/lib/supabase/server'
import { requireActor } from '@/lib/auth/require-actor'
import { logAudit } from '@/lib/audit'
import { computeStudentFeeBalance } from '@/lib/fees/balance'
import {
  calcStandardSubjectResult,
  calcLowerSubjectResult,
  calcOverallResult,
  resolveGrade,
  DEFAULT_STANDARD_MAX,
  CO_SCHOLASTIC_AREAS,
  STANDARD_TERM1_FIELDS,
  STANDARD_TERM2_FIELDS,
  validateComponentMark,
  type ReportCardType,
  type StandardMaxMarks,
  type LowerComponent,
  type MarksMap,
  type GradingRule,
} from '@/lib/report-card-utils'

const WRITE_ROLES = ['school_admin', 'teacher', 'manager']
const ADMIN_ROLES = ['school_admin', 'manager']

// ── shared shapes ─────────────────────────────────────────────────────────────

export interface ClassMeta {
  id: string
  name: string
  reportCardType: ReportCardType
  sections: { id: string; name: string }[]
}

export interface ReportSetup {
  classes: ClassMeta[]
  academicYearId: string | null
  gradingRules: GradingRule[]
}

export interface SubjectConfigRow {
  subjectId: string
  subjectName: string
  subjectCode: string | null
  configId: string | null
  maxMarks: StandardMaxMarks
  components: LowerComponent[]
  displayOrder: number
}

export interface StudentRow {
  id: string
  fullName: string
  admissionNumber: string
  rollNumber: string | null
  sectionId: string | null
}

export interface ScholasticMarkRow {
  subjectId: string
  term1: MarksMap
  term2: MarksMap
}

export interface CoScholasticMarkRow {
  area: string
  term1: string | null
  term2: string | null
}

export interface StudentMeta {
  term1Attendance: string | null
  term2Attendance: string | null
  remarks: string | null
  resultStatus: string | null
}

export interface PublicationRow {
  status: 'draft' | 'published' | 'locked'
  resultVisible: boolean
  publishedAt: string | null
}

// ── helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function actorProfileId(db: any, schoolId: string): Promise<string | null> {
  const { data: userResult } = await db.auth.getUser()
  if (!userResult?.user) return null
  const { data: profile } = await db
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', userResult.user.id)
    .eq('school_id', schoolId)
    .maybeSingle()
  return profile?.id ?? null
}

function normalizeMaxMarks(raw: unknown): StandardMaxMarks {
  const value = (raw ?? {}) as Partial<StandardMaxMarks>
  return {
    term1: { ...DEFAULT_STANDARD_MAX.term1, ...(value.term1 ?? {}) },
    term2: { ...DEFAULT_STANDARD_MAX.term2, ...(value.term2 ?? {}) },
  }
}

function normalizeComponents(raw: unknown): LowerComponent[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c) => c && typeof c.name === 'string')
    .map((c) => ({ name: String(c.name), maxMarks: Number(c.maxMarks) || 0 }))
}

/**
 * Server-side guard for scholastic marks. The marks editor validates client-side,
 * but server actions are callable directly, so the same rules (no negatives, no
 * non-numbers, never above the configured component max) must be enforced here
 * before anything is written.
 */
function assertScholasticMarksValid(
  term1: MarksMap,
  term2: MarksMap,
  tier: ReportCardType,
  maxMarks: StandardMaxMarks,
  components: LowerComponent[],
): void {
  const check = (marks: MarksMap, key: string, max: number) => {
    const raw = marks?.[key]
    if (raw === null || raw === undefined || raw === ('' as unknown)) return
    const value = typeof raw === 'number' ? raw : Number(raw)
    const err = validateComponentMark(value, max)
    if (err) throw new Error(`Invalid mark for "${key}": ${err}`)
  }

  if (tier === 'lower') {
    for (const c of components) {
      check(term1, c.name, c.maxMarks)
      check(term2, c.name, c.maxMarks)
    }
  } else {
    for (const f of STANDARD_TERM1_FIELDS) {
      check(term1, f.key, Number((maxMarks.term1 as unknown as MarksMap)[f.key] ?? 0))
    }
    for (const f of STANDARD_TERM2_FIELDS) {
      check(term2, f.key, Number((maxMarks.term2 as unknown as MarksMap)[f.key] ?? 0))
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGradingRules(db: any, schoolId: string, classId?: string): Promise<GradingRule[]> {
  let query = db
    .from('grading_rules')
    .select('min_marks, max_marks, grade_name, class_id')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
  if (classId) query = query.or(`class_id.eq.${classId},class_id.is.null`)
  const { data } = await query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    min_marks: Number(r.min_marks),
    max_marks: Number(r.max_marks),
    grade_name: r.grade_name,
  }))
}

// ── setup / selectors ─────────────────────────────────────────────────────────

export async function getReportSetup(schoolId: string): Promise<ReportSetup> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: classes }, { data: sections }, { data: years }, gradingRules] = await Promise.all([
    db
      .from('classes')
      .select('id, name, report_card_type, display_order')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true }),
    db
      .from('sections')
      .select('id, name, class_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    db
      .from('academic_years')
      .select('id, is_current, start_date')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false }),
    fetchGradingRules(db, schoolId),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectionsByClass = new Map<string, { id: string; name: string }[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sections ?? []) as any[]) {
    const list = sectionsByClass.get(s.class_id) ?? []
    list.push({ id: s.id, name: s.name })
    sectionsByClass.set(s.class_id, list)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yearList = (years ?? []) as any[]
  const currentYear = yearList.find((y) => y.is_current) ?? yearList[0] ?? null

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    classes: ((classes ?? []) as any[]).map((c) => ({
      id: c.id,
      name: c.name,
      reportCardType: (c.report_card_type === 'lower' ? 'lower' : 'standard') as ReportCardType,
      sections: sectionsByClass.get(c.id) ?? [],
    })),
    academicYearId: currentYear?.id ?? null,
    gradingRules,
  }
}

export async function getClassSubjectConfigs(
  schoolId: string,
  classId: string,
): Promise<SubjectConfigRow[]> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: subjects }, { data: configs }] = await Promise.all([
    db
      .from('subjects')
      .select('id, name, code')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    db
      .from('report_subject_configs')
      .select('id, subject_id, max_marks, components, display_order')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .is('deleted_at', null),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configBySubject = new Map<string, any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (configs ?? []) as any[]) configBySubject.set(c.subject_id, c)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((subjects ?? []) as any[]).map((s, idx) => {
    const cfg = configBySubject.get(s.id)
    return {
      subjectId: s.id,
      subjectName: s.name,
      subjectCode: s.code ?? null,
      configId: cfg?.id ?? null,
      maxMarks: normalizeMaxMarks(cfg?.max_marks),
      components: normalizeComponents(cfg?.components),
      displayOrder: cfg?.display_order ?? idx,
    }
  })
}

export async function saveSubjectConfig(
  schoolId: string,
  classId: string,
  subjectId: string,
  maxMarks: StandardMaxMarks,
  components: LowerComponent[],
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ADMIN_ROLES)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: existing } = await db
    .from('report_subject_configs')
    .select('id')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .is('deleted_at', null)
    .maybeSingle()

  const payload = {
    school_id: schoolId,
    class_id: classId,
    subject_id: subjectId,
    max_marks: maxMarks,
    components,
  }

  if (existing?.id) {
    const { error } = await db.from('report_subject_configs').update(payload).eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from('report_subject_configs').insert(payload)
    if (error) throw new Error(error.message)
  }
}

// ── students ──────────────────────────────────────────────────────────────────

export async function getClassStudents(
  schoolId: string,
  classId: string,
  sectionId?: string,
): Promise<StudentRow[]> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  let query = db
    .from('students')
    .select('id, full_name, admission_number, roll_number, section_id')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('roll_number', { ascending: true })
    .order('full_name', { ascending: true })

  if (sectionId) query = query.eq('section_id', sectionId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((s) => ({
    id: s.id,
    fullName: s.full_name,
    admissionNumber: s.admission_number,
    rollNumber: s.roll_number,
    sectionId: s.section_id,
  }))
}

// ── full per-student data (marks entry + report card) ──────────────────────────

export interface StudentReportData {
  student: {
    id: string
    fullName: string
    admissionNumber: string
    rollNumber: string | null
    classId: string | null
    className: string
    sectionName: string | null
    reportCardType: ReportCardType
    fatherName: string | null
    motherName: string | null
    dateOfBirth: string | null
  }
  configs: SubjectConfigRow[]
  scholastic: ScholasticMarkRow[]
  coScholastic: CoScholasticMarkRow[]
  meta: StudentMeta
  gradingRules: GradingRule[]
  publication: PublicationRow | null
}

export async function getStudentReportData(
  schoolId: string,
  studentId: string,
): Promise<StudentReportData | null> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: student } = await db
    .from('students')
    .select(
      'id, full_name, admission_number, roll_number, class_id, date_of_birth, ' +
        'classes ( name, report_card_type ), sections ( name )',
    )
    .eq('school_id', schoolId)
    .eq('id', studentId)
    .maybeSingle()

  if (!student) return null

  const classId: string | null = student.class_id
  const reportCardType: ReportCardType =
    student.classes?.report_card_type === 'lower' ? 'lower' : 'standard'

  const [configs, scholasticRes, coScholasticRes, metaRes, gradingRules, publication] =
    await Promise.all([
      classId ? getClassSubjectConfigs(schoolId, classId) : Promise.resolve([]),
      db
        .from('report_scholastic_marks')
        .select('subject_id, term1, term2')
        .eq('school_id', schoolId)
        .eq('student_id', studentId),
      db
        .from('report_co_scholastic_marks')
        .select('area, term1, term2')
        .eq('school_id', schoolId)
        .eq('student_id', studentId),
      db
        .from('report_student_meta')
        .select('term1_attendance, term2_attendance, remarks, result_status')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .maybeSingle(),
      classId ? fetchGradingRules(db, schoolId, classId) : fetchGradingRules(db, schoolId),
      classId ? getClassPublication(schoolId, classId) : Promise.resolve(null),
    ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scholastic: ScholasticMarkRow[] = ((scholasticRes.data ?? []) as any[]).map((m) => ({
    subjectId: m.subject_id,
    term1: (m.term1 ?? {}) as MarksMap,
    term2: (m.term2 ?? {}) as MarksMap,
  }))

  const coScholastic: CoScholasticMarkRow[] = CO_SCHOLASTIC_AREAS.map((area) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = ((coScholasticRes.data ?? []) as any[]).find((m) => m.area === area)
    return { area, term1: found?.term1 ?? null, term2: found?.term2 ?? null }
  })

  const meta: StudentMeta = {
    term1Attendance: metaRes.data?.term1_attendance ?? null,
    term2Attendance: metaRes.data?.term2_attendance ?? null,
    remarks: metaRes.data?.remarks ?? null,
    resultStatus: metaRes.data?.result_status ?? null,
  }

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      admissionNumber: student.admission_number,
      rollNumber: student.roll_number,
      classId,
      className: student.classes?.name ?? '',
      sectionName: student.sections?.name ?? null,
      reportCardType,
      fatherName: null,
      motherName: null,
      dateOfBirth: student.date_of_birth ?? null,
    },
    configs,
    scholastic,
    coScholastic,
    meta,
    gradingRules,
    publication,
  }
}

// ── mark writes ───────────────────────────────────────────────────────────────

export async function saveScholasticMark(
  schoolId: string,
  classId: string,
  studentId: string,
  subjectId: string,
  term1: MarksMap,
  term2: MarksMap,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, WRITE_ROLES)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const enteredBy = await actorProfileId(db, schoolId)

  // Validate against the subject's configured maxima before persisting.
  const [{ data: cfg }, { data: cls }] = await Promise.all([
    db
      .from('report_subject_configs')
      .select('max_marks, components')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .is('deleted_at', null)
      .maybeSingle(),
    db.from('classes').select('report_card_type').eq('id', classId).maybeSingle(),
  ])
  const tier: ReportCardType = cls?.report_card_type === 'lower' ? 'lower' : 'standard'
  assertScholasticMarksValid(
    term1 ?? {},
    term2 ?? {},
    tier,
    normalizeMaxMarks(cfg?.max_marks),
    normalizeComponents(cfg?.components),
  )

  const { error } = await db.from('report_scholastic_marks').upsert(
    {
      school_id: schoolId,
      class_id: classId,
      student_id: studentId,
      subject_id: subjectId,
      term1,
      term2,
      entered_by: enteredBy,
      entered_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,subject_id' },
  )
  if (error) throw new Error(error.message)
}

export async function saveCoScholasticMark(
  schoolId: string,
  studentId: string,
  area: string,
  term1: string | null,
  term2: string | null,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, WRITE_ROLES)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const enteredBy = await actorProfileId(db, schoolId)

  const { error } = await db.from('report_co_scholastic_marks').upsert(
    {
      school_id: schoolId,
      student_id: studentId,
      area,
      term1: term1 || null,
      term2: term2 || null,
      entered_by: enteredBy,
    },
    { onConflict: 'student_id,area' },
  )
  if (error) throw new Error(error.message)
}

export async function saveStudentMeta(
  schoolId: string,
  studentId: string,
  meta: StudentMeta,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, WRITE_ROLES)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const enteredBy = await actorProfileId(db, schoolId)

  const { error } = await db.from('report_student_meta').upsert(
    {
      school_id: schoolId,
      student_id: studentId,
      term1_attendance: meta.term1Attendance || null,
      term2_attendance: meta.term2Attendance || null,
      remarks: meta.remarks || null,
      result_status: meta.resultStatus || null,
      entered_by: enteredBy,
    },
    { onConflict: 'student_id' },
  )
  if (error) throw new Error(error.message)
}

// ── publication ───────────────────────────────────────────────────────────────

export async function getClassPublication(
  schoolId: string,
  classId: string,
): Promise<PublicationRow | null> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('report_publications')
    .select('status, result_visible, published_at')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    status: data.status,
    resultVisible: data.result_visible,
    publishedAt: data.published_at,
  }
}

export async function publishClassReport(
  classId: string,
  academicYearId: string | null,
  resultVisible = true,
  lock = true,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const actor = await requireActor(supabase, ADMIN_ROLES)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db.rpc('publish_class_report', {
    p_class_id: classId,
    p_academic_year_id: academicYearId,
    p_result_visible: resultVisible,
    p_lock: lock,
  })
  if (error) throw new Error(error.message)

  await logAudit({
    schoolId: actor.school_id ?? '',
    actorId: actor.id,
    actorRole: actor.role,
    action: 'report.published',
    entityType: 'class',
    entityId: classId,
    metadata: { resultVisible, lock },
  })
}

export async function unlockClassReport(
  classId: string,
  academicYearId: string | null,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const actor = await requireActor(supabase, ADMIN_ROLES)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db.rpc('unlock_class_report', {
    p_class_id: classId,
    p_academic_year_id: academicYearId,
  })
  if (error) throw new Error(error.message)

  await logAudit({
    schoolId: actor.school_id ?? '',
    actorId: actor.id,
    actorRole: actor.role,
    action: 'report.unlocked',
    entityType: 'class',
    entityId: classId,
  })
}

// ── class overview (ranking) ───────────────────────────────────────────────────

export interface ClassResultRow {
  studentId: string
  fullName: string
  admissionNumber: string
  rollNumber: string | null
  totalObtained: number
  totalMax: number
  percentage: number
  grade: string | null
  rank: number
}

export async function getClassResultsOverview(
  schoolId: string,
  classId: string,
  sectionId?: string,
): Promise<ClassResultRow[]> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [students, configs, gradingRules, { data: marksData }, { data: classRow }] =
    await Promise.all([
      getClassStudents(schoolId, classId, sectionId),
      getClassSubjectConfigs(schoolId, classId),
      fetchGradingRules(db, schoolId, classId),
      db
        .from('report_scholastic_marks')
        .select('student_id, subject_id, term1, term2')
        .eq('school_id', schoolId)
        .eq('class_id', classId),
      db.from('classes').select('report_card_type').eq('id', classId).maybeSingle(),
    ])

  const reportCardType: ReportCardType =
    classRow?.report_card_type === 'lower' ? 'lower' : 'standard'

  const configBySubject = new Map(configs.map((c) => [c.subjectId, c]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marksByStudent = new Map<string, any[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of (marksData ?? []) as any[]) {
    const list = marksByStudent.get(m.student_id) ?? []
    list.push(m)
    marksByStudent.set(m.student_id, list)
  }

  const rows: ClassResultRow[] = students.map((stu) => {
    const studentMarks = marksByStudent.get(stu.id) ?? []
    const subjectResults = studentMarks.map((m) => {
      const cfg = configBySubject.get(m.subject_id)
      if (!cfg) {
        return { term1Total: 0, term2Total: 0, grandTotal: 0, maxGrandTotal: 0, percentage: 0 }
      }
      return reportCardType === 'lower'
        ? calcLowerSubjectResult(m.term1 ?? {}, m.term2 ?? {}, cfg.components)
        : calcStandardSubjectResult(m.term1 ?? {}, m.term2 ?? {}, cfg.maxMarks)
    })
    const overall = calcOverallResult(subjectResults)
    return {
      studentId: stu.id,
      fullName: stu.fullName,
      admissionNumber: stu.admissionNumber,
      rollNumber: stu.rollNumber,
      totalObtained: overall.totalObtained,
      totalMax: overall.totalMax,
      percentage: overall.percentage,
      grade: resolveGrade(overall.percentage, gradingRules),
      rank: 0,
    }
  })

  // Rank in descending order of percentage, returning the rows already sorted so
  // the "ranks" table reads top-to-bottom. Ties share a rank (1, 1, 3 …).
  rows.sort((a, b) => b.percentage - a.percentage)
  let lastPercentage = Number.NaN
  let lastRank = 0
  rows.forEach((row, idx) => {
    if (row.percentage !== lastPercentage) {
      lastRank = idx + 1
      lastPercentage = row.percentage
    }
    row.rank = lastRank
  })

  return rows
}

// ── printable report card (staff + parent) ─────────────────────────────────────

export interface PrintableSubjectRow {
  subjectName: string
  subjectCode: string | null
  term1: MarksMap
  term2: MarksMap
  term1Total: number
  term2Total: number
  grandTotal: number
  maxGrandTotal: number
  percentage: number
  grade: string | null
  maxMarks: StandardMaxMarks
  components: LowerComponent[]
}

export interface PrintableReportCard {
  reportCardType: ReportCardType
  school: {
    name: string
    address: string | null
    city: string | null
    state: string | null
    pincode: string | null
    phone: string | null
    email: string | null
    logoUrl: string | null
  }
  student: {
    fullName: string
    admissionNumber: string
    rollNumber: string | null
    className: string
    sectionName: string | null
    dateOfBirth: string | null
    fatherName: string | null
    motherName: string | null
  }
  subjects: PrintableSubjectRow[]
  coScholastic: CoScholasticMarkRow[]
  meta: StudentMeta
  overall: { totalObtained: number; totalMax: number; percentage: number; grade: string | null }
  /** Signature image URLs printed on the card (null = blank signature line). */
  signatures: { principalUrl: string | null; classTeacherUrl: string | null }
  publication: PublicationRow | null
  /** Current academic-year label (e.g. "2025-26"); null when none is set. */
  academicSession: string | null
  /** Per-school grade band definitions, used to print an accurate grade legend. */
  gradingRules: GradingRule[]
}

/**
 * Assembles a fully-computed, printable report card. Authorises the caller:
 *  • school staff → full access to own-school students;
 *  • parents → only their own child, and only once the class report is
 *    published with results visible.
 * Returns null when not found or not authorised.
 */
export async function getPrintableReportCard(studentId: string): Promise<PrintableReportCard | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, role, school_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return null

  const admin = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: student } = await db
    .from('students')
    .select(
      'id, full_name, admission_number, roll_number, class_id, section_id, school_id, date_of_birth, ' +
        'schools ( name, address, city, state, pincode, phone, email, logo_url, principal_signature_url, lock_results_on_fee ), ' +
        'classes ( name, report_card_type ), sections ( name )',
    )
    .eq('id', studentId)
    .maybeSingle()
  if (!student) return null

  const schoolId: string = student.school_id
  const classId: string | null = student.class_id
  const staffRoles = ['school_admin', 'teacher', 'manager', 'cashier']
  const isStaff = staffRoles.includes(profile.role) && profile.school_id === schoolId

  let publication: PublicationRow | null = null
  if (classId) {
    const { data: pub } = await db
      .from('report_publications')
      .select('status, result_visible, published_at')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (pub) {
      publication = { status: pub.status, resultVisible: pub.result_visible, publishedAt: pub.published_at }
    }
  }

  if (!isStaff) {
    if (profile.role !== 'parent') return null
    const { data: link } = await db
      .from('parents')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('student_id', studentId)
      .maybeSingle()
    if (!link) return null
    const visible =
      publication &&
      (publication.status === 'published' || publication.status === 'locked') &&
      publication.resultVisible
    if (!visible) return null

    // Fee guardrail — enforced on the server so it cannot be bypassed by
    // navigating directly to the printable route. Only applied when the school
    // has opted in (lock_results_on_fee); a parent with outstanding dues is then
    // treated as not authorised to view the report card.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((student.schools as any)?.lock_results_on_fee) {
      const { balance } = await computeStudentFeeBalance(db, schoolId, studentId, classId)
      if (balance > 0) return null
    }
  }

  return buildPrintableReportCard(db, student, publication)
}

/**
 * Assembles a printable report card from an already-fetched (and already
 * authorised) student row. Shared by the single-student route and the bulk
 * class export so both render identically.
 */
async function buildPrintableReportCard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  student: any,
  publication: PublicationRow | null,
): Promise<PrintableReportCard> {
  const schoolId: string = student.school_id
  const classId: string | null = student.class_id
  const studentId: string = student.id

  const reportCardType: ReportCardType =
    student.classes?.report_card_type === 'lower' ? 'lower' : 'standard'

  const [{ data: subjects }, { data: configs }, { data: marks }, { data: coData }, { data: metaRow }] =
    await Promise.all([
      classId
        ? db
            .from('subjects')
            .select('id, name, code')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('name', { ascending: true })
        : Promise.resolve({ data: [] }),
      classId
        ? db
            .from('report_subject_configs')
            .select('subject_id, max_marks, components')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .is('deleted_at', null)
        : Promise.resolve({ data: [] }),
      db
        .from('report_scholastic_marks')
        .select('subject_id, term1, term2')
        .eq('school_id', schoolId)
        .eq('student_id', studentId),
      db
        .from('report_co_scholastic_marks')
        .select('area, term1, term2')
        .eq('school_id', schoolId)
        .eq('student_id', studentId),
      db
        .from('report_student_meta')
        .select('term1_attendance, term2_attendance, remarks, result_status')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .maybeSingle(),
    ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfgBySubject = new Map<string, any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (configs ?? []) as any[]) cfgBySubject.set(c.subject_id, c)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markBySubject = new Map<string, any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of (marks ?? []) as any[]) markBySubject.set(m.subject_id, m)

  const sectionId: string | null = student.section_id ?? null
  const [gradingRules, { data: yearRow }, { data: parentRows }, { data: classTeacherRow }] =
    await Promise.all([
      fetchGradingRules(db, schoolId, classId ?? undefined),
      db
        .from('academic_years')
        .select('name')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle(),
      db
        .from('parents')
        .select('full_name, relation')
        .eq('school_id', schoolId)
        .eq('student_id', studentId),
      sectionId
        ? db
            .from('teacher_section_assignments')
            .select('teachers ( signature_url )')
            .eq('school_id', schoolId)
            .eq('section_id', sectionId)
            .eq('is_class_teacher', true)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])
  const academicSession: string | null = (yearRow?.name as string | undefined) ?? null
  const findParent = (rel: string): string | null =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((parentRows ?? []) as any[]).find((p) => String(p.relation ?? '').toLowerCase() === rel)?.full_name ?? null
  const fatherName = findParent('father')
  const motherName = findParent('mother')
  const classTeacherSignatureUrl: string | null =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((classTeacherRow as any)?.teachers?.signature_url as string | undefined) ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subjectRows: PrintableSubjectRow[] = ((subjects ?? []) as any[]).map((s) => {
    const cfg = cfgBySubject.get(s.id)
    const maxMarks = normalizeMaxMarks(cfg?.max_marks)
    const components = normalizeComponents(cfg?.components)
    const mk = markBySubject.get(s.id)
    const term1 = (mk?.term1 ?? {}) as MarksMap
    const term2 = (mk?.term2 ?? {}) as MarksMap
    const result =
      reportCardType === 'lower'
        ? calcLowerSubjectResult(term1, term2, components)
        : calcStandardSubjectResult(term1, term2, maxMarks)
    return {
      subjectName: s.name,
      subjectCode: s.code ?? null,
      term1,
      term2,
      term1Total: result.term1Total,
      term2Total: result.term2Total,
      grandTotal: result.grandTotal,
      maxGrandTotal: result.maxGrandTotal,
      percentage: result.percentage,
      grade: resolveGrade(result.percentage, gradingRules),
      maxMarks,
      components,
    }
  })

  const overallRaw = calcOverallResult(
    subjectRows.map((r) => ({
      term1Total: r.term1Total,
      term2Total: r.term2Total,
      grandTotal: r.grandTotal,
      maxGrandTotal: r.maxGrandTotal,
      percentage: r.percentage,
    })),
  )

  const coScholastic: CoScholasticMarkRow[] = CO_SCHOLASTIC_AREAS.map((area) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = ((coData ?? []) as any[]).find((m) => m.area === area)
    return { area, term1: found?.term1 ?? null, term2: found?.term2 ?? null }
  })

  return {
    reportCardType,
    school: {
      name: student.schools?.name ?? '',
      address: student.schools?.address ?? null,
      city: student.schools?.city ?? null,
      state: student.schools?.state ?? null,
      pincode: student.schools?.pincode ?? null,
      phone: student.schools?.phone ?? null,
      email: student.schools?.email ?? null,
      logoUrl: student.schools?.logo_url ?? null,
    },
    student: {
      fullName: student.full_name,
      admissionNumber: student.admission_number,
      rollNumber: student.roll_number,
      className: student.classes?.name ?? '',
      sectionName: student.sections?.name ?? null,
      dateOfBirth: student.date_of_birth ?? null,
      fatherName,
      motherName,
    },
    subjects: subjectRows,
    coScholastic,
    meta: {
      term1Attendance: metaRow?.term1_attendance ?? null,
      term2Attendance: metaRow?.term2_attendance ?? null,
      remarks: metaRow?.remarks ?? null,
      resultStatus: metaRow?.result_status ?? null,
    },
    overall: {
      totalObtained: overallRaw.totalObtained,
      totalMax: overallRaw.totalMax,
      percentage: overallRaw.percentage,
      grade: resolveGrade(overallRaw.percentage, gradingRules),
    },
    signatures: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      principalUrl: ((student.schools as any)?.principal_signature_url as string | null) ?? null,
      classTeacherUrl: classTeacherSignatureUrl,
    },
    publication,
    academicSession,
    gradingRules,
  }
}

const PRINTABLE_STUDENT_SELECT =
  'id, full_name, admission_number, roll_number, class_id, section_id, school_id, date_of_birth, ' +
  'schools ( name, address, city, state, pincode, phone, email, logo_url, principal_signature_url, lock_results_on_fee ), ' +
  'classes ( name, report_card_type ), sections ( name )'

/**
 * Bulk variant of {@link getPrintableReportCard}: returns printable cards for
 * every active student in a class (optionally a single section). Staff-only —
 * used by the "print whole class" route. Unlike the parent path it ignores the
 * publication/fee gate, since staff may always print.
 */
export async function getClassPrintableReportCards(
  classId: string,
  sectionId?: string,
): Promise<PrintableReportCard[]> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, school_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return []

  const staffRoles = ['school_admin', 'teacher', 'manager', 'cashier']
  if (!staffRoles.includes(profile.role) || !profile.school_id) return []
  const schoolId = profile.school_id as string

  const admin = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Resolve the class publication once — it is identical for every student.
  let publication: PublicationRow | null = null
  const { data: pub } = await db
    .from('report_publications')
    .select('status, result_visible, published_at')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (pub) {
    publication = { status: pub.status, resultVisible: pub.result_visible, publishedAt: pub.published_at }
  }

  let query = db
    .from('students')
    .select(PRINTABLE_STUDENT_SELECT)
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('roll_number', { ascending: true })
    .order('full_name', { ascending: true })
  if (sectionId) query = query.eq('section_id', sectionId)

  const { data: students } = await query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (students ?? []) as any[]
  return Promise.all(rows.map((s) => buildPrintableReportCard(db, s, publication)))
}
