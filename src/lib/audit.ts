'use server'

import { createClient } from '@supabase/supabase-js'

/**
 * Best-effort platform audit logging. Writes a row to `audit_logs` using the
 * service-role client. Failures are swallowed (logged to console) so that an
 * audit write never breaks the primary operation it is recording.
 */
export interface AuditEntry {
  schoolId?: string | null
  actorId?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  entityLabel?: string | null
  metadata?: Record<string, unknown> | null
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await admin.from('audit_logs').insert({
      school_id: entry.schoolId ?? null,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      metadata: entry.metadata ?? null,
    })

    if (error) console.warn('[audit] failed to write entry:', error.message)
  } catch (e) {
    console.warn('[audit] unexpected error writing entry:', e)
  }
}
