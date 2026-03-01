/**
 * Milestone 1.6 — Teacher management utility tests
 */
import { describe, it, expect } from 'vitest'
import {
  validateTeacherCreateFields,
  buildAssignmentLabel,
  generateEmployeeId,
  matchesTeacherSearch,
} from '@/lib/teacher-utils'

// ── Create field validation ───────────────────────────────────────────────────

describe('validateTeacherCreateFields() (M1.6)', () => {
  const valid = {
    full_name: 'Priya Sharma',
    email: 'priya@school.in',
    password: 'Secret1234',
    join_date: '2026-01-01',
  }

  it('returns empty array for valid data', () => {
    expect(validateTeacherCreateFields(valid)).toHaveLength(0)
  })

  it('flags missing full_name', () => {
    const errors = validateTeacherCreateFields({ ...valid, full_name: '' })
    expect(errors).toContain('full_name is required')
  })

  it('flags invalid email — missing @', () => {
    const errors = validateTeacherCreateFields({ ...valid, email: 'notanemail' })
    expect(errors).toContain('valid email is required')
  })

  it('flags invalid email — empty string', () => {
    const errors = validateTeacherCreateFields({ ...valid, email: '' })
    expect(errors).toContain('valid email is required')
  })

  it('flags password shorter than 8 chars', () => {
    const errors = validateTeacherCreateFields({ ...valid, password: 'short' })
    expect(errors).toContain('password must be at least 8 characters')
  })

  it('flags missing join_date', () => {
    const errors = validateTeacherCreateFields({ ...valid, join_date: '' })
    expect(errors).toContain('join_date is required')
  })

  it('returns multiple errors simultaneously', () => {
    const errors = validateTeacherCreateFields({
      full_name: '',
      email: 'bad',
      password: 'abc',
      join_date: '',
    })
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })
})

// ── Assignment label builder ──────────────────────────────────────────────────

describe('buildAssignmentLabel() (M1.6)', () => {
  it('builds label without subject', () => {
    const label = buildAssignmentLabel({
      className: 'Class 10',
      sectionName: 'A',
      subjectName: null,
      isClassTeacher: false,
    })
    expect(label).toBe('Class 10 — A')
  })

  it('includes subject name when provided', () => {
    const label = buildAssignmentLabel({
      className: 'Class 10',
      sectionName: 'A',
      subjectName: 'Mathematics',
      isClassTeacher: false,
    })
    expect(label).toBe('Class 10 — A (Mathematics)')
  })

  it('appends class teacher tag when is_class_teacher=true', () => {
    const label = buildAssignmentLabel({
      className: 'Class 5',
      sectionName: 'B',
      subjectName: null,
      isClassTeacher: true,
    })
    expect(label).toContain('[Class Teacher]')
  })

  it('includes subject and class teacher tag together', () => {
    const label = buildAssignmentLabel({
      className: 'Class 8',
      sectionName: 'C',
      subjectName: 'Science',
      isClassTeacher: true,
    })
    expect(label).toBe('Class 8 — C (Science) [Class Teacher]')
  })
})

// ── Employee ID generation ────────────────────────────────────────────────────

describe('generateEmployeeId() (M1.6)', () => {
  it('generates formatted employee ID', () => {
    expect(generateEmployeeId('RPS', 1)).toBe('RPS-EMP-001')
  })

  it('zero-pads to 3 digits', () => {
    expect(generateEmployeeId('ABC', 25)).toBe('ABC-EMP-025')
  })

  it('uppercases school code', () => {
    expect(generateEmployeeId('rps', 5)).toBe('RPS-EMP-005')
  })

  it('handles sequence >= 100', () => {
    expect(generateEmployeeId('XYZ', 100)).toBe('XYZ-EMP-100')
  })
})

// ── Teacher search filter ─────────────────────────────────────────────────────

describe('matchesTeacherSearch() (M1.6)', () => {
  const teacher = {
    fullName: 'Ravi Kumar',
    email: 'ravi@school.in',
    employeeId: 'SCH-EMP-007',
    specialization: 'Mathematics',
  }

  it('returns true when search is empty', () => {
    expect(matchesTeacherSearch(teacher, '')).toBe(true)
  })

  it('matches on full name (case-insensitive)', () => {
    expect(matchesTeacherSearch(teacher, 'ravi')).toBe(true)
    expect(matchesTeacherSearch(teacher, 'KUMAR')).toBe(true)
  })

  it('matches on email', () => {
    expect(matchesTeacherSearch(teacher, 'ravi@school')).toBe(true)
  })

  it('matches on employee ID', () => {
    expect(matchesTeacherSearch(teacher, 'EMP-007')).toBe(true)
  })

  it('matches on specialization', () => {
    expect(matchesTeacherSearch(teacher, 'math')).toBe(true)
  })

  it('returns false when no field matches', () => {
    expect(matchesTeacherSearch(teacher, 'english')).toBe(false)
  })

  it('handles null employeeId and specialization gracefully', () => {
    const t = { fullName: 'Ali', email: 'ali@x.com', employeeId: null, specialization: null }
    expect(matchesTeacherSearch(t, 'ali')).toBe(true)
    expect(matchesTeacherSearch(t, 'math')).toBe(false)
  })
})
