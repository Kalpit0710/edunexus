/**
 * Pure utility functions for Student management (Milestone 1.5).
 * These are side-effect-free helpers suitable for unit testing.
 */

/** Auto-generate an admission number from a school code, year and sequence */
export function generateAdmissionNumber(
  schoolCode: string,
  year: number,
  sequence: number
): string {
  const paddedSeq = String(sequence).padStart(4, '0')
  return `${schoolCode.toUpperCase()}-${year}-${paddedSeq}`
}

/** Validate student basic required fields before DB insert */
export interface StudentBasicFields {
  first_name: string
  date_of_birth: string
  gender: string
  admission_number: string
  class_id: string
  date_of_joining: string
}

export function validateStudentRequiredFields(fields: StudentBasicFields): string[] {
  const errors: string[] = []
  if (!fields.first_name?.trim()) errors.push('first_name is required')
  if (!fields.date_of_birth) errors.push('date_of_birth is required')
  if (!fields.gender) errors.push('gender is required')
  if (!fields.admission_number?.trim()) errors.push('admission_number is required')
  if (!fields.class_id) errors.push('class_id is required')
  if (!fields.date_of_joining) errors.push('date_of_joining is required')
  return errors
}

/** Validates that a birthdate makes the student at least 3 years old */
export function isValidStudentAge(dateOfBirth: string): boolean {
  const dob = new Date(dateOfBirth)
  if (isNaN(dob.getTime())) return false
  const today = new Date()
  const age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  const adjustedAge = m < 0 || (m === 0 && today.getDate() < dob.getDate()) ? age - 1 : age
  return adjustedAge >= 3
}

/** Returns "Full Name" from student fields */
export function buildStudentFullName(
  firstName: string,
  middleName?: string | null,
  lastName?: string | null
): string {
  return [firstName, middleName, lastName]
    .filter((p) => p && p.trim().length > 0)
    .join(' ')
    .trim()
}

/** Parse a raw Excel row into a student insert payload (column names from the export template) */
export interface ExcelStudentRow {
  'First Name': string
  'Middle Name'?: string
  'Last Name'?: string
  Gender: string
  'Date of Birth': string
  'Admission No': string
  'Roll No'?: string
  'Date of Joining': string
  'Class ID': string
  'Section ID'?: string
  'Parent Name'?: string
  'Parent Contact'?: string
  'Parent Email'?: string
  Address?: string
  'Blood Group'?: string
  'Medical Conditions'?: string
}

export function parseExcelRow(row: ExcelStudentRow, schoolId: string) {
  return {
    school_id: schoolId,
    first_name: String(row['First Name'] ?? '').trim(),
    middle_name: String(row['Middle Name'] ?? '').trim() || null,
    last_name: String(row['Last Name'] ?? '').trim() || null,
    gender: String(row['Gender'] ?? '').toLowerCase().trim(),
    date_of_birth: String(row['Date of Birth'] ?? '').trim(),
    admission_number: String(row['Admission No'] ?? '').trim(),
    roll_number: String(row['Roll No'] ?? '').trim() || null,
    date_of_joining: String(row['Date of Joining'] ?? '').trim(),
    class_id: String(row['Class ID'] ?? '').trim(),
    section_id: String(row['Section ID'] ?? '').trim() || null,
    parent_name: String(row['Parent Name'] ?? '').trim() || null,
    parent_contact: String(row['Parent Contact'] ?? '').trim() || null,
    parent_email: String(row['Parent Email'] ?? '').trim() || null,
    address: String(row['Address'] ?? '').trim() || null,
    blood_group: String(row['Blood Group'] ?? '').trim() || null,
    medical_conditions: String(row['Medical Conditions'] ?? '').trim() || null,
    status: 'active',
  }
}
