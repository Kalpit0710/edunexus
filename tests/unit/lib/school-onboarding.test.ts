import { describe, it, expect } from 'vitest'
import {
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN,
  normalizeSchoolCode,
  normalizeEmail,
  computeTrialEndsAt,
  schoolRegisterSchema,
} from '@/lib/school-onboarding'

describe('school-onboarding helpers', () => {
  describe('normalizeSchoolCode', () => {
    it('trims and uppercases', () => {
      expect(normalizeSchoolCode('  spring-field_1 ')).toBe('SPRING-FIELD_1')
    })
  })

  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  Admin@School.EDU ')).toBe('admin@school.edu')
    })
  })

  describe('computeTrialEndsAt', () => {
    it('adds the trial duration to now', () => {
      const now = new Date('2026-01-01T00:00:00.000Z')
      const end = computeTrialEndsAt(now)
      expect(end).toBe('2026-01-15T00:00:00.000Z')
    })

    it('produces a future timestamp with the default now', () => {
      const end = new Date(computeTrialEndsAt())
      expect(end.getTime()).toBeGreaterThan(Date.now())
    })

    it('provisions premium so the whole product is trialable', () => {
      expect(TRIAL_PLAN).toBe('premium')
      expect(TRIAL_DURATION_DAYS).toBe(14)
    })
  })

  describe('schoolRegisterSchema', () => {
    const valid = {
      schoolName: 'Springfield High',
      schoolCode: 'SPRINGFIELD',
      schoolEmail: 'office@springfield.edu',
      schoolPhone: '+91 98765 43210',
      city: 'Mumbai',
      state: 'Maharashtra',
      adminFullName: 'Jane Doe',
      adminEmail: 'jane@springfield.edu',
      password: 'Passw0rd',
      confirmPassword: 'Passw0rd',
    }

    it('accepts a valid payload', () => {
      expect(schoolRegisterSchema.safeParse(valid).success).toBe(true)
    })

    it('allows optional school fields to be empty strings', () => {
      const result = schoolRegisterSchema.safeParse({
        ...valid,
        schoolEmail: '',
        schoolPhone: '',
        city: '',
        state: '',
      })
      expect(result.success).toBe(true)
    })

    it('rejects a mismatched confirm password', () => {
      const result = schoolRegisterSchema.safeParse({ ...valid, confirmPassword: 'Different1' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/do not match/i)
      }
    })

    it('rejects a weak password', () => {
      const result = schoolRegisterSchema.safeParse({
        ...valid,
        password: 'alllower',
        confirmPassword: 'alllower',
      })
      expect(result.success).toBe(false)
    })

    it('rejects a school code with invalid characters', () => {
      const result = schoolRegisterSchema.safeParse({ ...valid, schoolCode: 'has space!' })
      expect(result.success).toBe(false)
    })

    it('rejects an invalid admin email', () => {
      const result = schoolRegisterSchema.safeParse({ ...valid, adminEmail: 'not-an-email' })
      expect(result.success).toBe(false)
    })

    it('rejects a too-short school name', () => {
      const result = schoolRegisterSchema.safeParse({ ...valid, schoolName: 'A' })
      expect(result.success).toBe(false)
    })
  })
})
