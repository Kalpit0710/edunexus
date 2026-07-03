import type { AnnouncementAudience } from '@/lib/announcement-utils'

export const SUPER_ADMIN_NOTIFICATION_SCOPES = [
  'global_everyone',
  'global_students',
  'global_teachers',
  'school_everyone',
  'school_students',
  'school_teachers',
  'class_students',
] as const

export type SuperAdminNotificationScope = (typeof SUPER_ADMIN_NOTIFICATION_SCOPES)[number]

export interface SuperAdminDispatchTarget {
  schoolId: string
  audience: AnnouncementAudience
  targetClassId: string | null
}

export interface BuildDispatchTargetsInput {
  scope: SuperAdminNotificationScope
  availableSchoolIds: string[]
  targetSchoolId: string | null
  targetClassId: string | null
}

export function buildDispatchTargets(input: BuildDispatchTargetsInput): SuperAdminDispatchTarget[] {
  const schoolIds = [...new Set(input.availableSchoolIds)]
  if (schoolIds.length === 0) throw new Error('No active schools found.')

  const requireSchool = (): string => {
    if (!input.targetSchoolId) throw new Error('Please select a school.')
    if (!schoolIds.includes(input.targetSchoolId)) throw new Error('Selected school is not available.')
    return input.targetSchoolId
  }

  switch (input.scope) {
    case 'global_everyone':
      return schoolIds.flatMap((schoolId) => [
        { schoolId, audience: 'all_students' as const, targetClassId: null },
        { schoolId, audience: 'all_teachers' as const, targetClassId: null },
      ])
    case 'global_students':
      return schoolIds.map((schoolId) => ({ schoolId, audience: 'all_students' as const, targetClassId: null }))
    case 'global_teachers':
      return schoolIds.map((schoolId) => ({ schoolId, audience: 'all_teachers' as const, targetClassId: null }))
    case 'school_everyone': {
      const schoolId = requireSchool()
      return [
        { schoolId, audience: 'all_students' as const, targetClassId: null },
        { schoolId, audience: 'all_teachers' as const, targetClassId: null },
      ]
    }
    case 'school_students': {
      const schoolId = requireSchool()
      return [{ schoolId, audience: 'all_students' as const, targetClassId: null }]
    }
    case 'school_teachers': {
      const schoolId = requireSchool()
      return [{ schoolId, audience: 'all_teachers' as const, targetClassId: null }]
    }
    case 'class_students': {
      const schoolId = requireSchool()
      if (!input.targetClassId) throw new Error('Please select a class.')
      return [{ schoolId, audience: 'class_students' as const, targetClassId: input.targetClassId }]
    }
    default:
      throw new Error('Unsupported scope.')
  }
}

export function scopeLabel(scope: SuperAdminNotificationScope): string {
  switch (scope) {
    case 'global_everyone':
      return 'Everyone (all schools)'
    case 'global_students':
      return 'All students (all schools)'
    case 'global_teachers':
      return 'All teachers (all schools)'
    case 'school_everyone':
      return 'Everyone in one school'
    case 'school_students':
      return 'All students in one school'
    case 'school_teachers':
      return 'All teachers in one school'
    case 'class_students':
      return 'Students of one class'
    default:
      return 'Unknown'
  }
}

export interface PreviewRecipientCount {
  schoolsAffected: number
  classesAffected: number
  deliveryRows: number
  ready: boolean
}

export function estimatePreviewRecipientCount(input: BuildDispatchTargetsInput): PreviewRecipientCount {
  try {
    const targets = buildDispatchTargets(input)
    const schoolIds = new Set(targets.map((t) => t.schoolId))
    const classTargets = targets.filter((t) => t.targetClassId)
    const classKeys = new Set(classTargets.map((t) => `${t.schoolId}:${t.targetClassId}`))

    return {
      schoolsAffected: schoolIds.size,
      classesAffected: classKeys.size,
      deliveryRows: targets.length,
      ready: true,
    }
  } catch {
    return {
      schoolsAffected: 0,
      classesAffected: 0,
      deliveryRows: 0,
      ready: false,
    }
  }
}
