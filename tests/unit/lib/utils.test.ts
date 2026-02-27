import { describe, it, expect } from 'vitest'
import { cn, formatCurrency, getInitials, truncate, slugify } from '@/lib/utils'

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'excluded', 'included')).toBe('base included')
  })

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})

describe('formatCurrency()', () => {
  it('formats as Indian Rupee', () => {
    const result = formatCurrency(1500)
    expect(result).toContain('1,500')
    expect(result).toContain('₹')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toContain('0')
  })
})

describe('getInitials()', () => {
  it('returns initials of first two words', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('handles single name', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('handles three names', () => {
    expect(getInitials('John Michael Doe')).toBe('JM')
  })
})

describe('truncate()', () => {
  it('truncates long text', () => {
    const long = 'a'.repeat(60)
    const result = truncate(long, 50)
    expect(result).toHaveLength(53) // 50 + '...'
    expect(result).toEndWith('...')
  })

  it('does not truncate short text', () => {
    expect(truncate('short', 50)).toBe('short')
  })
})

describe('slugify()', () => {
  it('converts to slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('handles special characters', () => {
    expect(slugify('Class 10-A!')).toBe('class-10-a')
  })
})
