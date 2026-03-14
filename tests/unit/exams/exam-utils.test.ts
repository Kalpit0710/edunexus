import { describe, expect, it } from 'vitest'
import {
  calculatePercentage,
  canEnterMarks,
  resolveGradeFromRules,
  validateMarksEntry,
  type GradingRule,
} from '@/lib/exam-utils'

describe('canEnterMarks() (Phase 2.1)', () => {
  it('allows marks entry in published/ongoing status', () => {
    expect(canEnterMarks('published')).toBe(true)
    expect(canEnterMarks('ongoing')).toBe(true)
  })

  it('disallows marks entry in draft/completed/locked status', () => {
    expect(canEnterMarks('draft')).toBe(false)
    expect(canEnterMarks('completed')).toBe(false)
    expect(canEnterMarks('locked')).toBe(false)
  })
})

describe('calculatePercentage() (Phase 2.1)', () => {
  it('calculates percentage with 2-decimal precision', () => {
    expect(calculatePercentage(45, 50)).toBe(90)
    expect(calculatePercentage(67, 80)).toBe(83.75)
  })

  it('returns 0 when max marks is invalid', () => {
    expect(calculatePercentage(45, 0)).toBe(0)
    expect(calculatePercentage(45, -10)).toBe(0)
  })

  it('clamps percentage between 0 and 100', () => {
    expect(calculatePercentage(120, 100)).toBe(100)
    expect(calculatePercentage(-10, 100)).toBe(0)
  })
})

describe('resolveGradeFromRules() (Phase 2.1)', () => {
  const rules: GradingRule[] = [
    { min_marks: 90, max_marks: 100, grade_name: 'A+' },
    { min_marks: 75, max_marks: 89.99, grade_name: 'A' },
    { min_marks: 60, max_marks: 74.99, grade_name: 'B' },
    { min_marks: 40, max_marks: 59.99, grade_name: 'C' },
    { min_marks: 0, max_marks: 39.99, grade_name: 'F' },
  ]

  it('returns matching grade for boundary values', () => {
    expect(resolveGradeFromRules(90, rules)).toBe('A+')
    expect(resolveGradeFromRules(75, rules)).toBe('A')
    expect(resolveGradeFromRules(60, rules)).toBe('B')
    expect(resolveGradeFromRules(40, rules)).toBe('C')
  })

  it('returns null when no rules match', () => {
    expect(resolveGradeFromRules(110, rules)).toBeNull()
    expect(resolveGradeFromRules(20, [])).toBeNull()
  })
})

describe('validateMarksEntry() (Phase 2.1)', () => {
  it('accepts valid non-absent marks', () => {
    expect(
      validateMarksEntry({
        marksObtained: 72,
        isAbsent: false,
        maxMarks: 100,
      })
    ).toHaveLength(0)
  })

  it('accepts absent with null marks', () => {
    expect(
      validateMarksEntry({
        marksObtained: null,
        isAbsent: true,
        maxMarks: 100,
      })
    ).toHaveLength(0)
  })

  it('rejects absent with non-null marks', () => {
    expect(
      validateMarksEntry({
        marksObtained: 20,
        isAbsent: true,
        maxMarks: 100,
      })
    ).toContain('Absent students must not have marks.')
  })

  it('rejects missing marks for non-absent student', () => {
    expect(
      validateMarksEntry({
        marksObtained: null,
        isAbsent: false,
        maxMarks: 100,
      })
    ).toContain('Marks are required for non-absent students.')
  })

  it('rejects marks outside allowed range', () => {
    expect(
      validateMarksEntry({
        marksObtained: -1,
        isAbsent: false,
        maxMarks: 100,
      })
    ).toContain('Marks cannot be negative.')

    expect(
      validateMarksEntry({
        marksObtained: 101,
        isAbsent: false,
        maxMarks: 100,
      })
    ).toContain('Marks cannot exceed maximum marks.')
  })
})
