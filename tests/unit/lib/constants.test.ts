/**
 * Milestone 1.1 / 1.2 — Project setup constants & role definitions
 */
import { describe, it, expect } from 'vitest'
import {
  APP_NAME,
  APP_VERSION,
  ROLES,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  ATTENDANCE_STATUS,
  PAYMENT_MODES,
  MAX_UPLOAD_SIZE_MB,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_EXCEL_TYPES,
  GENDER_OPTIONS,
  BLOOD_GROUP_OPTIONS,
} from '@/lib/constants'

// ── M1.1 Project Setup ───────────────────────────────────────────────────────

describe('APP constants (M1.1)', () => {
  it('has correct app name', () => {
    expect(APP_NAME).toBe('EduNexus')
  })

  it('has a valid semver version string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

// ── M1.2 / M1.3 Role definitions ────────────────────────────────────────────

describe('ROLES (M1.2 / M1.3)', () => {
  it('defines all six roles', () => {
    const defined = Object.values(ROLES)
    expect(defined).toContain('super_admin')
    expect(defined).toContain('school_admin')
    expect(defined).toContain('teacher')
    expect(defined).toContain('manager')
    expect(defined).toContain('cashier')
    expect(defined).toContain('parent')
    expect(defined).toHaveLength(6)
  })

  it('role values are lowercase snake_case strings', () => {
    Object.values(ROLES).forEach((r) => {
      expect(r).toMatch(/^[a-z_]+$/)
    })
  })
})

// ── M1.5 Pagination ──────────────────────────────────────────────────────────

describe('Pagination constants (M1.5)', () => {
  it('default page size is 20', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20)
  })

  it('page size options include default', () => {
    expect(PAGE_SIZE_OPTIONS).toContain(DEFAULT_PAGE_SIZE)
  })

  it('page size options are sorted ascending', () => {
    const sorted = [...PAGE_SIZE_OPTIONS].sort((a, b) => a - b)
    expect(PAGE_SIZE_OPTIONS).toEqual(sorted)
  })
})

// ── M1.7 Attendance ──────────────────────────────────────────────────────────

describe('ATTENDANCE_STATUS constants (M1.7)', () => {
  it('defines all required statuses', () => {
    const statuses = Object.values(ATTENDANCE_STATUS)
    expect(statuses).toContain('present')
    expect(statuses).toContain('absent')
    expect(statuses).toContain('late')
    expect(statuses).toContain('half_day')
    expect(statuses).toContain('holiday')
  })
})

// ── M1.8 Payment modes ───────────────────────────────────────────────────────

describe('PAYMENT_MODES constants (M1.8)', () => {
  it('defines all payment modes', () => {
    const modes = Object.values(PAYMENT_MODES)
    expect(modes).toContain('cash')
    expect(modes).toContain('upi')
    expect(modes).toContain('cheque')
    expect(modes).toContain('neft')
    expect(modes).toContain('card')
    expect(modes).toContain('online')
  })
})

// ── M1.5 / M1.6 File upload limits ──────────────────────────────────────────

describe('File upload constants (M1.5)', () => {
  it('max upload is 5 MB', () => {
    expect(MAX_UPLOAD_SIZE_MB).toBe(5)
  })

  it('accepts common image types', () => {
    expect(ACCEPTED_IMAGE_TYPES).toContain('image/jpeg')
    expect(ACCEPTED_IMAGE_TYPES).toContain('image/png')
    expect(ACCEPTED_IMAGE_TYPES).toContain('image/webp')
  })

  it('accepts xlsx format', () => {
    expect(ACCEPTED_EXCEL_TYPES).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })
})

// ── M1.5 Student form options ────────────────────────────────────────────────

describe('GENDER_OPTIONS (M1.5)', () => {
  it('has male, female, other', () => {
    const values = GENDER_OPTIONS.map((g) => g.value)
    expect(values).toContain('male')
    expect(values).toContain('female')
    expect(values).toContain('other')
  })

  it('each option has label and value', () => {
    GENDER_OPTIONS.forEach((opt) => {
      expect(opt).toHaveProperty('label')
      expect(opt).toHaveProperty('value')
      expect(opt.label.length).toBeGreaterThan(0)
    })
  })
})

describe('BLOOD_GROUP_OPTIONS (M1.5)', () => {
  it('includes ABO+Rh combinations', () => {
    expect(BLOOD_GROUP_OPTIONS).toContain('A+')
    expect(BLOOD_GROUP_OPTIONS).toContain('O-')
    expect(BLOOD_GROUP_OPTIONS).toContain('AB+')
    expect(BLOOD_GROUP_OPTIONS).toHaveLength(8)
  })
})
