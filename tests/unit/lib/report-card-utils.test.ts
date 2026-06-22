import { describe, it, expect } from 'vitest'
import {
  sumComponents,
  resolveGrade,
  calcStandardSubjectResult,
  calcLowerSubjectResult,
  calcOverallResult,
  validateComponentMark,
  parseMarkInput,
  DEFAULT_STANDARD_MAX,
  type GradingRule,
  type LowerComponent,
} from '@/lib/report-card-utils'

const RULES: GradingRule[] = [
  { min_marks: 91, max_marks: 100, grade_name: 'A1' },
  { min_marks: 81, max_marks: 90.99, grade_name: 'A2' },
  { min_marks: 71, max_marks: 80.99, grade_name: 'B1' },
  { min_marks: 33, max_marks: 70.99, grade_name: 'C' },
  { min_marks: 0, max_marks: 32.99, grade_name: 'E' },
]

describe('sumComponents', () => {
  it('sums only the requested keys and treats missing/null as 0', () => {
    expect(sumComponents({ periodicTest: 9, notebook: 4, extra: 100 }, ['periodicTest', 'notebook'])).toBe(13)
    expect(sumComponents({ periodicTest: null, notebook: undefined }, ['periodicTest', 'notebook'])).toBe(0)
  })
})

describe('resolveGrade', () => {
  it('matches the correct band', () => {
    expect(resolveGrade(95, RULES)).toBe('A1')
    expect(resolveGrade(85, RULES)).toBe('A2')
    expect(resolveGrade(50, RULES)).toBe('C')
    expect(resolveGrade(10, RULES)).toBe('E')
  })
  it('returns null when no rules supplied', () => {
    expect(resolveGrade(50, [])).toBeNull()
  })
})

describe('calcStandardSubjectResult', () => {
  it('averages the two terms for the grand total', () => {
    // Full marks both terms: T1 = 10+5+5+80 = 100, T2 = 100.
    const r = calcStandardSubjectResult(
      { periodicTest: 10, notebook: 5, subEnrichment: 5, halfYearlyExam: 80 },
      { periodicTest: 10, notebook: 5, subEnrichment: 5, yearlyExam: 80 },
      DEFAULT_STANDARD_MAX,
    )
    expect(r.term1Total).toBe(100)
    expect(r.term2Total).toBe(100)
    expect(r.grandTotal).toBe(100) // 100/2 + 100/2
    expect(r.maxGrandTotal).toBe(100)
    expect(r.percentage).toBe(100)
  })

  it('computes a partial percentage correctly', () => {
    // T1 = 5+3+3+40 = 51, T2 = 5+2+2+41 = 50 → grand = 25.5 + 25 = 50.5 of 100
    const r = calcStandardSubjectResult(
      { periodicTest: 5, notebook: 3, subEnrichment: 3, halfYearlyExam: 40 },
      { periodicTest: 5, notebook: 2, subEnrichment: 2, yearlyExam: 41 },
      DEFAULT_STANDARD_MAX,
    )
    expect(r.term1Total).toBe(51)
    expect(r.term2Total).toBe(50)
    expect(r.grandTotal).toBe(50.5)
    expect(r.percentage).toBe(50.5)
  })

  it('guards against a zero max', () => {
    const r = calcStandardSubjectResult({}, {}, {
      term1: { periodicTest: 0, notebook: 0, subEnrichment: 0, halfYearlyExam: 0 },
      term2: { periodicTest: 0, notebook: 0, subEnrichment: 0, yearlyExam: 0 },
    })
    expect(r.maxGrandTotal).toBe(0)
    expect(r.percentage).toBe(0)
  })
})

describe('calcLowerSubjectResult', () => {
  const comps: LowerComponent[] = [
    { name: 'Oral', maxMarks: 20 },
    { name: 'Written', maxMarks: 30 },
  ]

  it('sums both terms straight (no averaging)', () => {
    const r = calcLowerSubjectResult(
      { Oral: 18, Written: 25 },
      { Oral: 20, Written: 28 },
      comps,
    )
    expect(r.term1Total).toBe(43)
    expect(r.term2Total).toBe(48)
    expect(r.grandTotal).toBe(91)
    expect(r.maxGrandTotal).toBe(100) // (20+30) * 2
    expect(r.percentage).toBe(91)
  })

  it('handles empty components', () => {
    const r = calcLowerSubjectResult({}, {}, [])
    expect(r.maxGrandTotal).toBe(0)
    expect(r.percentage).toBe(0)
  })
})

describe('calcOverallResult', () => {
  it('aggregates subject grand totals and derives percentage', () => {
    const overall = calcOverallResult([
      { term1Total: 0, term2Total: 0, grandTotal: 80, maxGrandTotal: 100, percentage: 80 },
      { term1Total: 0, term2Total: 0, grandTotal: 90, maxGrandTotal: 100, percentage: 90 },
    ])
    expect(overall.totalObtained).toBe(170)
    expect(overall.totalMax).toBe(200)
    expect(overall.percentage).toBe(85)
    expect(resolveGrade(overall.percentage, RULES)).toBe('A2')
  })

  it('is zero-safe with no subjects', () => {
    const overall = calcOverallResult([])
    expect(overall.totalMax).toBe(0)
    expect(overall.percentage).toBe(0)
  })
})

describe('validateComponentMark', () => {
  it('allows blank (unentered) marks', () => {
    expect(validateComponentMark(null, 10)).toBeNull()
    expect(validateComponentMark(undefined, 10)).toBeNull()
  })
  it('rejects negative and over-max', () => {
    expect(validateComponentMark(-1, 10)).toMatch(/negative/i)
    expect(validateComponentMark(11, 10)).toMatch(/exceed/i)
  })
  it('accepts an in-range value', () => {
    expect(validateComponentMark(8, 10)).toBeNull()
  })
})

describe('parseMarkInput', () => {
  it('maps blank to undefined and parses numbers', () => {
    expect(parseMarkInput('')).toBeUndefined()
    expect(parseMarkInput('   ')).toBeUndefined()
    expect(parseMarkInput('7')).toBe(7)
    expect(parseMarkInput('7.5')).toBe(7.5)
    expect(parseMarkInput('abc')).toBeUndefined()
  })
})
