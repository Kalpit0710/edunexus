import { describe, expect, it } from 'vitest'
import {
  normalizeParentContact,
  normalizePhoneDigits,
  phonesMatch,
  selectBestSiblingParent,
} from '@/lib/student-parent-link'

describe('normalizeParentContact()', () => {
  it('trims input and normalizes email casing', () => {
    const result = normalizeParentContact({
      parent_name: '  Jane Doe  ',
      parent_email: '  JANE@EXAMPLE.COM ',
      parent_contact: '  +91 98765 43210 ',
    })

    expect(result.parentName).toBe('Jane Doe')
    expect(result.parentEmail).toBe('jane@example.com')
    expect(result.parentPhone).toBe('+91 98765 43210')
    expect(result.hasDetails).toBe(true)
  })

  it('returns hasDetails=false when all values are blank', () => {
    const result = normalizeParentContact({
      parent_name: '  ',
      parent_email: '',
      parent_contact: null,
    })

    expect(result.hasDetails).toBe(false)
  })
})

describe('phone matching helpers', () => {
  it('normalizes phone digits correctly', () => {
    expect(normalizePhoneDigits('+91 98765 43210')).toBe('919876543210')
  })

  it('matches equivalent local and international formats', () => {
    expect(phonesMatch('+91 98765 43210', '9876543210')).toBe(true)
  })

  it('does not match different numbers', () => {
    expect(phonesMatch('9876543210', '9123456780')).toBe(false)
  })
})

describe('selectBestSiblingParent()', () => {
  const candidates = [
    {
      auth_user_id: null,
      email: 'parent@example.com',
      phone: '9876543210',
      is_primary: true,
    },
    {
      auth_user_id: 'auth-user-1',
      email: 'parent@example.com',
      phone: '+91 98765 43210',
      is_primary: true,
    },
  ]

  it('prefers auth-linked parent rows when email and phone match', () => {
    const selected = selectBestSiblingParent(candidates, 'parent@example.com', '9876543210')
    expect(selected?.auth_user_id).toBe('auth-user-1')
  })

  it('returns null when email is missing', () => {
    const selected = selectBestSiblingParent(candidates, '', '9876543210')
    expect(selected).toBeNull()
  })

  it('returns null when phone does not match provided input', () => {
    const selected = selectBestSiblingParent(candidates, 'parent@example.com', '9000000000')
    expect(selected).toBeNull()
  })
})