/**
 * Pure utility functions for Teacher management (Milestone 1.6).
 */

/** Validate the required fields before creating a teacher */
export interface TeacherCreateFields {
  full_name: string
  email: string
  password: string
  join_date: string
}

export function validateTeacherCreateFields(fields: TeacherCreateFields): string[] {
  const errors: string[] = []
  if (!fields.full_name?.trim()) errors.push('full_name is required')
  if (!fields.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errors.push('valid email is required')
  if (!fields.password || fields.password.length < 8)
    errors.push('password must be at least 8 characters')
  if (!fields.join_date) errors.push('join_date is required')
  return errors
}

/** Build the display label for a teacher assignment row */
export interface AssignmentSummary {
  className: string
  sectionName: string
  subjectName?: string | null
  isClassTeacher: boolean
}

export function buildAssignmentLabel(a: AssignmentSummary): string {
  const base = `${a.className} — ${a.sectionName}`
  const sub = a.subjectName ? ` (${a.subjectName})` : ''
  const ct = a.isClassTeacher ? ' [Class Teacher]' : ''
  return base + sub + ct
}

/** Returns a placeholder teacher employee ID based on school code + sequence */
export function generateEmployeeId(schoolCode: string, sequence: number): string {
  return `${schoolCode.toUpperCase()}-EMP-${String(sequence).padStart(3, '0')}`
}

/** Filter teachers by search term across name, email, empId, specialization */
export interface TeacherFilterable {
  fullName: string
  email: string
  employeeId?: string | null
  specialization?: string | null
}

export function matchesTeacherSearch(t: TeacherFilterable, search: string): boolean {
  if (!search.trim()) return true
  const term = search.toLowerCase()
  return (
    t.fullName.toLowerCase().includes(term) ||
    t.email.toLowerCase().includes(term) ||
    (t.employeeId?.toLowerCase().includes(term) ?? false) ||
    (t.specialization?.toLowerCase().includes(term) ?? false)
  )
}
