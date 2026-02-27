import type { User } from '@supabase/supabase-js'
import type { Role } from '@/lib/constants'

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser extends User {
  user_metadata: {
    role: Role
    school_id?: string
    full_name?: string
    avatar_url?: string
  }
}

// ─── School ──────────────────────────────────────────────────────────────────

export interface School {
  id: string
  name: string
  code: string
  logo_url?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  theme_color?: string | null
  academic_year_start_month: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  school_id: string
  auth_user_id: string
  full_name: string
  email: string
  phone?: string | null
  role: Role
  avatar_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Student ─────────────────────────────────────────────────────────────────

export interface Student {
  id: string
  school_id: string
  admission_number: string
  full_name: string
  date_of_birth?: string | null
  gender?: 'male' | 'female' | 'other' | null
  blood_group?: string | null
  photo_url?: string | null
  class_id?: string | null
  section_id?: string | null
  roll_number?: string | null
  admission_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Class / Section ─────────────────────────────────────────────────────────

export interface Class {
  id: string
  school_id: string
  name: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface Section {
  id: string
  school_id: string
  class_id: string
  name: string
  capacity?: number | null
  is_active: boolean
  created_at: string
}

// ─── Teacher ─────────────────────────────────────────────────────────────────

export interface Teacher {
  id: string
  school_id: string
  user_profile_id: string
  employee_id?: string | null
  qualification?: string | null
  specialization?: string | null
  join_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string
  school_id: string
  student_id: string
  class_id: string
  section_id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday'
  remarks?: string | null
  marked_by: string
  created_at: string
}

// ─── Fee ─────────────────────────────────────────────────────────────────────

export interface FeePayment {
  id: string
  school_id: string
  student_id: string
  receipt_number: string
  total_amount: number
  paid_amount: number
  payment_mode: 'cash' | 'cheque' | 'upi' | 'neft' | 'card' | 'online'
  payment_date: string
  collected_by: string
  remarks?: string | null
  created_at: string
}

// ─── UI ──────────────────────────────────────────────────────────────────────

export interface SelectOption<T = string> {
  label: string
  value: T
  description?: string
  disabled?: boolean
}

export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export interface TableFilter {
  search?: string
  [key: string]: unknown
}
