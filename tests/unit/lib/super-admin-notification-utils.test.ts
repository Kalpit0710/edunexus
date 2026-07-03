import { describe, expect, it } from 'vitest'
import { buildDispatchTargets, estimatePreviewRecipientCount, scopeLabel } from '@/lib/super-admin-notification-utils'

describe('super-admin notification dispatch targets', () => {
  it('expands global everyone into student + teacher broadcasts per school', () => {
    const rows = buildDispatchTargets({
      scope: 'global_everyone',
      availableSchoolIds: ['s1', 's2'],
      targetSchoolId: null,
      targetClassId: null,
    })
    expect(rows).toHaveLength(4)
    expect(rows.filter((r) => r.audience === 'all_students')).toHaveLength(2)
    expect(rows.filter((r) => r.audience === 'all_teachers')).toHaveLength(2)
  })

  it('builds one class-targeted row for class_students', () => {
    const rows = buildDispatchTargets({
      scope: 'class_students',
      availableSchoolIds: ['s1'],
      targetSchoolId: 's1',
      targetClassId: 'c1',
    })
    expect(rows).toEqual([{ schoolId: 's1', audience: 'class_students', targetClassId: 'c1' }])
  })

  it('throws when class_students misses class', () => {
    expect(() =>
      buildDispatchTargets({
        scope: 'class_students',
        availableSchoolIds: ['s1'],
        targetSchoolId: 's1',
        targetClassId: null,
      }),
    ).toThrow(/class/i)
  })

  it('returns stable scope labels', () => {
    expect(scopeLabel('global_everyone')).toBe('Everyone (all schools)')
    expect(scopeLabel('class_students')).toBe('Students of one class')
  })

  it('estimates preview counts when inputs are valid', () => {
    const preview = estimatePreviewRecipientCount({
      scope: 'school_everyone',
      availableSchoolIds: ['s1', 's2'],
      targetSchoolId: 's1',
      targetClassId: null,
    })
    expect(preview.ready).toBe(true)
    expect(preview.schoolsAffected).toBe(1)
    expect(preview.classesAffected).toBe(0)
    expect(preview.deliveryRows).toBe(2)
  })

  it('marks preview as not ready for incomplete class scope input', () => {
    const preview = estimatePreviewRecipientCount({
      scope: 'class_students',
      availableSchoolIds: ['s1'],
      targetSchoolId: 's1',
      targetClassId: null,
    })
    expect(preview.ready).toBe(false)
    expect(preview.deliveryRows).toBe(0)
  })
})
