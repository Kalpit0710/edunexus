export const APP_NAME = 'EduNexus'
export const APP_VERSION = '0.1.0'

// Roles
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  PARENT: 'parent',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

// Pagination
export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// Attendance
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  HALF_DAY: 'half_day',
  HOLIDAY: 'holiday',
} as const

// Fee
export const PAYMENT_MODES = {
  CASH: 'cash',
  CHEQUE: 'cheque',
  UPI: 'upi',
  NEFT: 'neft',
  CARD: 'card',
  ONLINE: 'online',
} as const

// Examinations (Phase 2.1)
export const EXAM_STATUSES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  LOCKED: 'locked',
} as const

// Inventory (Phase 2.2)
export const INVENTORY_CATEGORIES = {
  BOOK: 'book',
  STATIONERY: 'stationery',
  UNIFORM: 'uniform',
  SPORTS: 'sports',
  LAB: 'lab',
  OTHER: 'other',
} as const

export const STOCK_ADJUSTMENT_TYPES = {
  ADD: 'add',
  REMOVE: 'remove',
  ADJUSTMENT: 'adjustment',
} as const

// File upload limits
export const MAX_UPLOAD_SIZE_MB = 5
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const ACCEPTED_DOC_TYPES = ['application/pdf']
export const ACCEPTED_EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]

// Academic
export const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
]

export const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
