import { z } from 'zod'
import type { SubscriptionPlan } from '@/lib/subscription'

/**
 * Self-serve school onboarding (F1.4).
 *
 * Pure, framework-free helpers shared by the public signup API route and its
 * unit tests. Keep all provisioning constants and input validation here so the
 * commercial trial policy has a single source of truth.
 */

/** Length of the self-serve free trial, in days. */
export const TRIAL_DURATION_DAYS = 14

/**
 * Plan a self-serve school is provisioned on during its trial. Premium so
 * prospects can evaluate every feature before the trial converts or expires.
 */
export const TRIAL_PLAN: SubscriptionPlan = 'premium'

/** School code: alphanumeric (plus dash/underscore), normalized to uppercase. */
export function normalizeSchoolCode(value: string): string {
  return value.trim().toUpperCase()
}

/** Normalize an email for storage/compare (trim + lowercase). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** ISO timestamp for when a trial started `now` should expire. */
export function computeTrialEndsAt(now: Date = new Date()): string {
  const end = new Date(now.getTime())
  end.setUTCDate(end.getUTCDate() + TRIAL_DURATION_DAYS)
  return end.toISOString()
}

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
    'Password must include uppercase, lowercase, and a number'
  )

/**
 * Validation for the public school-registration payload. Mirrored on the client
 * for inline feedback so a valid client submission is never rejected server-side.
 */
export const schoolRegisterSchema = z
  .object({
    schoolName: z.string().trim().min(2, 'School name is required').max(120, 'School name is too long'),
    schoolCode: z
      .string()
      .trim()
      .min(2, 'School code must be at least 2 characters')
      .max(20, 'School code is too long')
      .regex(/^[A-Za-z0-9_-]+$/, 'Use only letters, numbers, dashes, or underscores'),
    schoolEmail: z.string().trim().email('Enter a valid school email').optional().or(z.literal('')),
    schoolPhone: z.string().trim().max(30, 'Phone number is too long').optional().or(z.literal('')),
    city: z.string().trim().max(80, 'City is too long').optional().or(z.literal('')),
    state: z.string().trim().max(80, 'State is too long').optional().or(z.literal('')),
    adminFullName: z.string().trim().min(2, 'Your name is required').max(120, 'Name is too long'),
    adminEmail: z.string().trim().email('Enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Re-enter your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type SchoolRegisterInput = z.infer<typeof schoolRegisterSchema>
