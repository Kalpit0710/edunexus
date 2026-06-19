// Pure helpers for year-end promotion (Tier 1 · F1.3).
//
// Kept dependency-free so the default class→class mapping is unit-testable
// without a DB. The server action + RPC do the actual atomic write.

export interface PromotionClass {
  id: string
  name: string
  display_order: number
}

export interface PromotionMapping {
  /** Source class id. */
  fromClassId: string
  /** Target class id, or null to graduate (final class). */
  toClassId: string | null
}

/**
 * Build the default promotion mapping: every class moves to the next class by
 * ascending `display_order`; the highest class graduates (`toClassId = null`).
 * Classes are not mutated; ties on `display_order` fall back to `name`.
 */
export function computeDefaultPromotionMapping(classes: PromotionClass[]): PromotionMapping[] {
  const ordered = [...classes].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name),
  )
  return ordered.map((cls, i) => ({
    fromClassId: cls.id,
    toClassId: i < ordered.length - 1 ? ordered[i + 1]!.id : null,
  }))
}

/**
 * Validate a promotion mapping before sending it to the RPC:
 *  - every `fromClassId` must be a known class,
 *  - every non-null `toClassId` must be a known class,
 *  - a class cannot promote into itself,
 *  - no two mappings may share the same `fromClassId`.
 * Returns an error message, or null when valid.
 */
export function validatePromotionMapping(
  mappings: PromotionMapping[],
  classes: PromotionClass[],
): string | null {
  if (mappings.length === 0) return 'No classes to promote.'
  const ids = new Set(classes.map((c) => c.id))
  const seen = new Set<string>()
  for (const m of mappings) {
    if (!ids.has(m.fromClassId)) return 'Mapping references an unknown source class.'
    if (seen.has(m.fromClassId)) return 'A class appears more than once in the mapping.'
    seen.add(m.fromClassId)
    if (m.toClassId !== null) {
      if (!ids.has(m.toClassId)) return 'Mapping references an unknown target class.'
      if (m.toClassId === m.fromClassId) return 'A class cannot be promoted into itself.'
    }
  }
  return null
}
