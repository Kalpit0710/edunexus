export const ANNOUNCEMENT_AUDIENCES = ['class_students', 'all_students', 'all_teachers'] as const

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number]

export function isAnnouncementAudience(value: string): value is AnnouncementAudience {
  return (ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(value)
}

export function normalizeAnnouncementAudience(value: string | null | undefined): AnnouncementAudience {
  if (value && isAnnouncementAudience(value)) return value
  return 'class_students'
}

export function requiresClassTarget(audience: AnnouncementAudience): boolean {
  return audience === 'class_students'
}

/** Parent portal visibility: only student-targeted announcements are visible. */
export function parentCanSeeAnnouncement(audience: string | null | undefined, targetClassId: string | null, childClassId: string | null): boolean {
  const normalized = normalizeAnnouncementAudience(audience)
  if (normalized === 'all_students') return true
  if (normalized !== 'class_students') return false
  if (!targetClassId || !childClassId) return false
  return targetClassId === childClassId
}

export function audienceLabel(audience: string | null | undefined): string {
  const normalized = normalizeAnnouncementAudience(audience)
  if (normalized === 'all_students') return 'All Students'
  if (normalized === 'all_teachers') return 'All Teachers'
  return 'Class Students'
}
