/**
 * Milestone 1.5 — Student management utility tests
 */
import { describe, it, expect } from 'vitest'
import {
  generateAdmissionNumber,
  validateStudentRequiredFields,
  isValidStudentAge,
  buildStudentFullName,
  parseExcelRow,
  type ExcelStudentRow,
} from '@/lib/student-utils'

// ── Admission Number Generation ──────────────────────────────────────────────

describe('generateAdmissionNumber() (M1.5)', () => {
  it('generates a correctly formatted admission number', () => {
    expect(generateAdmissionNumber('RPS', 2026, 1)).toBe('RPS-2026-0001')
  })

  it('zero-pads sequence to 4 digits', () => {
    expect(generateAdmissionNumber('ABC', 2026, 42)).toBe('ABC-2026-0042')
  })

  it('handles sequence of 1000', () => {
    expect(generateAdmissionNumber('XYZ', 2025, 1000)).toBe('XYZ-2025-1000')
  })

  it('uppercases the school code', () => {
    const result = generateAdmissionNumber('rps', 2026, 1)
    expect(result.startsWith('RPS')).toBe(true)
  })
})

// ── Required Field Validation ────────────────────────────────────────────────

describe('validateStudentRequiredFields() (M1.5)', () => {
  const valid = {
    first_name: 'Alice',
    date_of_birth: '2015-06-10',
    gender: 'female',
    admission_number: 'RPS-2026-0001',
    class_id: 'class-uuid',
    date_of_joining: '2026-01-01',
  }

  it('returns empty array for valid data', () => {
    expect(validateStudentRequiredFields(valid)).toHaveLength(0)
  })

  it('flags missing first_name', () => {
    const errors = validateStudentRequiredFields({ ...valid, first_name: '' })
    expect(errors).toContain('first_name is required')
  })

  it('flags missing date_of_birth', () => {
    const errors = validateStudentRequiredFields({ ...valid, date_of_birth: '' })
    expect(errors).toContain('date_of_birth is required')
  })

  it('flags missing gender', () => {
    const errors = validateStudentRequiredFields({ ...valid, gender: '' })
    expect(errors).toContain('gender is required')
  })

  it('flags missing admission_number', () => {
    const errors = validateStudentRequiredFields({ ...valid, admission_number: '   ' })
    expect(errors).toContain('admission_number is required')
  })

  it('flags missing class_id', () => {
    const errors = validateStudentRequiredFields({ ...valid, class_id: '' })
    expect(errors).toContain('class_id is required')
  })

  it('flags missing date_of_joining', () => {
    const errors = validateStudentRequiredFields({ ...valid, date_of_joining: '' })
    expect(errors).toContain('date_of_joining is required')
  })

  it('returns multiple errors at once', () => {
    const errors = validateStudentRequiredFields({
      ...valid,
      first_name: '',
      gender: '',
    })
    expect(errors.length).toBe(2)
  })
})

// ── Age Validation ───────────────────────────────────────────────────────────

describe('isValidStudentAge() (M1.5)', () => {
  it('returns true for a student born >3 years ago', () => {
    // A child born 10 years ago
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 10)
    expect(isValidStudentAge(dob.toISOString().split('T')[0]!)).toBe(true)
  })

  it('returns false for a student born 1 year ago', () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 1)
    expect(isValidStudentAge(dob.toISOString().split('T')[0]!)).toBe(false)
  })

  it('returns false for an invalid date string', () => {
    expect(isValidStudentAge('not-a-date')).toBe(false)
  })
})

// ── Full Name Builder ────────────────────────────────────────────────────────

describe('buildStudentFullName() (M1.5)', () => {
  it('builds full name with all parts', () => {
    expect(buildStudentFullName('Alice', 'Mary', 'Smith')).toBe('Alice Mary Smith')
  })

  it('skips null/empty middle name', () => {
    expect(buildStudentFullName('Alice', null, 'Smith')).toBe('Alice Smith')
  })

  it('skips null/empty last name', () => {
    expect(buildStudentFullName('Alice', null, null)).toBe('Alice')
  })

  it('skips whitespace-only parts', () => {
    expect(buildStudentFullName('Alice', '  ', 'Smith')).toBe('Alice Smith')
  })
})

// ── Excel Row Parser ─────────────────────────────────────────────────────────

describe('parseExcelRow() (M1.5 — bulk import)', () => {
  const row: ExcelStudentRow = {
    'First Name': 'Bob',
    'Middle Name': 'James',
    'Last Name': 'Taylor',
    Gender: 'Male',
    'Date of Birth': '2014-05-20',
    'Admission No': 'SCH-2026-0002',
    'Roll No': '12',
    'Date of Joining': '2026-01-15',
    'Class ID': 'cls-uuid',
    'Section ID': 'sec-uuid',
    'Parent Name': 'James Taylor',
    'Parent Contact': '9876543210',
    'Parent Email': 'james@example.com',
    Address: '123 School Lane',
    'Blood Group': 'B+',
    'Medical Conditions': '',
  }

  it('maps all fields correctly', () => {
    const parsed = parseExcelRow(row, 'school-1')
    expect(parsed.first_name).toBe('Bob')
    expect(parsed.last_name).toBe('Taylor')
    expect(parsed.gender).toBe('male')   // lowercased
    expect(parsed.school_id).toBe('school-1')
    expect(parsed.admission_number).toBe('SCH-2026-0002')
    expect(parsed.blood_group).toBe('B+')
    expect(parsed.status).toBe('active')
  })

  it('sets empty medical_conditions to null', () => {
    const parsed = parseExcelRow(row, 'school-1')
    expect(parsed.medical_conditions).toBeNull()
  })

  it('preserves optional section_id', () => {
    const parsed = parseExcelRow(row, 'school-1')
    expect(parsed.section_id).toBe('sec-uuid')
  })

  it('sets missing optional fields to null', () => {
    const minRow: ExcelStudentRow = {
      'First Name': 'Alice',
      Gender: 'female',
      'Date of Birth': '2015-01-01',
      'Admission No': 'SCH-0001',
      'Date of Joining': '2026-01-01',
      'Class ID': 'cls-1',
    }
    const parsed = parseExcelRow(minRow, 'school-1')
    expect(parsed.middle_name).toBeNull()
    expect(parsed.parent_email).toBeNull()
    expect(parsed.section_id).toBeNull()
  })
})
