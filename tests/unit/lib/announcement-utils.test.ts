import { describe, it, expect } from 'vitest'
import {
  audienceLabel,
  isAnnouncementAudience,
  normalizeAnnouncementAudience,
  parentCanSeeAnnouncement,
  requiresClassTarget,
} from '@/lib/announcement-utils'

describe('announcement audience helpers', () => {
  it('accepts only supported audiences', () => {
    expect(isAnnouncementAudience('class_students')).toBe(true)
    expect(isAnnouncementAudience('all_students')).toBe(true)
    expect(isAnnouncementAudience('all_teachers')).toBe(true)
    expect(isAnnouncementAudience('all')).toBe(false)
  })

  it('normalizes unknown audience values safely', () => {
    expect(normalizeAnnouncementAudience('all_students')).toBe('all_students')
    expect(normalizeAnnouncementAudience('unknown')).toBe('class_students')
    expect(normalizeAnnouncementAudience(null)).toBe('class_students')
  })

  it('flags class-targeted announcements correctly', () => {
    expect(requiresClassTarget('class_students')).toBe(true)
    expect(requiresClassTarget('all_students')).toBe(false)
  })

  it('filters parent-visible announcements', () => {
    expect(parentCanSeeAnnouncement('all_students', null, 'class-a')).toBe(true)
    expect(parentCanSeeAnnouncement('all_teachers', null, 'class-a')).toBe(false)
    expect(parentCanSeeAnnouncement('class_students', 'class-a', 'class-a')).toBe(true)
    expect(parentCanSeeAnnouncement('class_students', 'class-b', 'class-a')).toBe(false)
  })

  it('renders stable audience labels', () => {
    expect(audienceLabel('class_students')).toBe('Class Students')
    expect(audienceLabel('all_students')).toBe('All Students')
    expect(audienceLabel('all_teachers')).toBe('All Teachers')
  })
})
