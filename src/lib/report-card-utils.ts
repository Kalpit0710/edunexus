// ─────────────────────────────────────────────────────────────────────────────
// CBSE-style report-card calculations & helpers.
//
// Two tiers (mirrors the reference SRMS model):
//  • standard — Term-1 / Term-2 with fixed components
//      (Periodic Test, Notebook, Sub Enrichment, Half-Yearly | Yearly).
//      Grand total = (Term-1 total ÷ 2) + (Term-2 total ÷ 2).
//  • lower    — dynamic per-subject components ({ name, maxMarks }).
//      Grand total = Term-1 obtained + Term-2 obtained.
//
// Grades are resolved from the per-school configurable `grading_rules`
// (not a hardcoded scale).
// ─────────────────────────────────────────────────────────────────────────────

export type ReportCardType = 'standard' | 'lower'
export type TermKey = 'term1' | 'term2'

export interface GradingRule {
  min_marks: number
  max_marks: number
  grade_name: string
}

// Component key + display label for the standard tier.
export interface ComponentField {
  key: string
  label: string
}

export const STANDARD_TERM1_FIELDS: ComponentField[] = [
  { key: 'periodicTest', label: 'Periodic Test' },
  { key: 'notebook', label: 'Notebook' },
  { key: 'subEnrichment', label: 'Sub Enrichment' },
  { key: 'halfYearlyExam', label: 'Half-Yearly Exam' },
]

export const STANDARD_TERM2_FIELDS: ComponentField[] = [
  { key: 'periodicTest', label: 'Periodic Test' },
  { key: 'notebook', label: 'Notebook' },
  { key: 'subEnrichment', label: 'Sub Enrichment' },
  { key: 'yearlyExam', label: 'Yearly Exam' },
]

export const CO_SCHOLASTIC_AREAS = [
  'Health & Physical Education',
  'Art Education',
  'Work Education',
] as const

export const CO_SCHOLASTIC_GRADES = ['A', 'B', 'C', 'D', 'E'] as const

export const RESULT_STATUSES = ['Passed', 'Failed', 'Promoted', 'Detained'] as const

export interface StandardTermMax {
  periodicTest: number
  notebook: number
  subEnrichment: number
  halfYearlyExam?: number
  yearlyExam?: number
}

export interface StandardMaxMarks {
  term1: StandardTermMax
  term2: StandardTermMax
}

export interface LowerComponent {
  name: string
  maxMarks: number
}

export type MarksMap = Record<string, number | null | undefined>

export const DEFAULT_STANDARD_MAX: StandardMaxMarks = {
  term1: { periodicTest: 10, notebook: 5, subEnrichment: 5, halfYearlyExam: 80 },
  term2: { periodicTest: 10, notebook: 5, subEnrichment: 5, yearlyExam: 80 },
}

// ── primitives ───────────────────────────────────────────────────────────────

function num(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/** Sum a marks map over the given component keys. */
export function sumComponents(marks: MarksMap, keys: string[]): number {
  return keys.reduce((total, key) => total + num(marks[key]), 0)
}

// ── grade resolution (reuses per-school grading_rules) ────────────────────────

export function resolveGrade(percentage: number, rules: GradingRule[]): string | null {
  if (!rules.length) return null
  const sorted = [...rules].sort((a, b) => b.min_marks - a.min_marks)
  const matched = sorted.find((r) => percentage >= r.min_marks && percentage <= r.max_marks)
  return matched?.grade_name ?? null
}

// ── per-subject result ────────────────────────────────────────────────────────

export interface SubjectResult {
  term1Total: number
  term2Total: number
  grandTotal: number
  maxGrandTotal: number
  percentage: number
}

/**
 * Standard tier: grand total is the average of the two terms
 * ((T1 ÷ 2) + (T2 ÷ 2)), matching the reference CBSE model.
 */
export function calcStandardSubjectResult(
  term1Marks: MarksMap,
  term2Marks: MarksMap,
  max: StandardMaxMarks,
): SubjectResult {
  const t1Keys = STANDARD_TERM1_FIELDS.map((f) => f.key)
  const t2Keys = STANDARD_TERM2_FIELDS.map((f) => f.key)

  const term1Total = sumComponents(term1Marks, t1Keys)
  const term2Total = sumComponents(term2Marks, t2Keys)
  const maxTerm1 = sumComponents(max.term1 as unknown as MarksMap, t1Keys)
  const maxTerm2 = sumComponents(max.term2 as unknown as MarksMap, t2Keys)

  const grandTotal = round2(term1Total / 2 + term2Total / 2)
  const maxGrandTotal = round2(maxTerm1 / 2 + maxTerm2 / 2)
  const percentage = maxGrandTotal > 0 ? round2((grandTotal / maxGrandTotal) * 100) : 0

  return { term1Total, term2Total, grandTotal, maxGrandTotal, percentage }
}

/**
 * Lower tier: grand total is the straight sum of both terms' component marks.
 */
export function calcLowerSubjectResult(
  term1Marks: MarksMap,
  term2Marks: MarksMap,
  components: LowerComponent[],
): SubjectResult {
  const keys = components.map((c) => c.name)
  const term1Total = sumComponents(term1Marks, keys)
  const term2Total = sumComponents(term2Marks, keys)
  const subjectMax = components.reduce((total, c) => total + num(c.maxMarks), 0)

  const grandTotal = round2(term1Total + term2Total)
  const maxGrandTotal = round2(subjectMax * 2)
  const percentage = maxGrandTotal > 0 ? round2((grandTotal / maxGrandTotal) * 100) : 0

  return { term1Total, term2Total, grandTotal, maxGrandTotal, percentage }
}

// ── overall result ────────────────────────────────────────────────────────────

export interface OverallResult {
  totalObtained: number
  totalMax: number
  percentage: number
}

export function calcOverallResult(subjects: SubjectResult[]): OverallResult {
  const totalObtained = round2(subjects.reduce((s, r) => s + r.grandTotal, 0))
  const totalMax = round2(subjects.reduce((s, r) => s + r.maxGrandTotal, 0))
  const percentage = totalMax > 0 ? round2((totalObtained / totalMax) * 100) : 0
  return { totalObtained, totalMax, percentage }
}

// ── validation ────────────────────────────────────────────────────────────────

/** Returns an error string when a single component mark is invalid, else null. */
export function validateComponentMark(value: number | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return 'Marks must be a number.'
  if (value < 0) return 'Marks cannot be negative.'
  if (max > 0 && value > max) return `Marks cannot exceed ${max}.`
  return null
}

/** Coerce a free-text input into a stored numeric mark (empty → undefined). */
export function parseMarkInput(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : undefined
}
