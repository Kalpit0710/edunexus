'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { FEATURES, FEATURE_LABEL, type Feature } from '@/lib/plan-features'
import {
  PERMISSIONS,
  CONFIGURABLE_ROLES,
  ROLE_LABEL,
  defaultAllows,
  type ConfigurableRole,
} from '@/lib/permissions'
import {
  getRolePermissionOverrides,
  setRolePermission,
  updateDisabledFeatures,
  type RolePermissionOverride,
} from '../access-actions'

// Dashboard + settings are always available, so they can't be switched off.
const TOGGLEABLE_FEATURES = FEATURES.filter((f) => f !== 'dashboard' && f !== 'settings')

export function AccessTab() {
  const { school, setSchool } = useAuthStore()
  const sid = school?.id
  const disabled = useMemo(() => school?.disabled_features ?? [], [school?.disabled_features])

  const [overrides, setOverrides] = useState<RolePermissionOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!sid) return
    setLoading(true)
    try {
      setOverrides(await getRolePermissionOverrides(sid))
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sid])

  useEffect(() => {
    if (sid) load()
  }, [load, sid])

  async function toggleFeature(feature: Feature, enabled: boolean) {
    if (!sid || !school) return
    const next = enabled ? disabled.filter((f) => f !== feature) : Array.from(new Set([...disabled, feature]))
    setBusy(true)
    try {
      await updateDisabledFeatures(sid, next)
      setSchool({ ...school, disabled_features: next })
      toast.success(`${FEATURE_LABEL[feature]} ${enabled ? 'enabled' : 'disabled'}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function isAllowed(role: ConfigurableRole, permission: string): boolean {
    const o = overrides.find((x) => x.role === role && x.permission === permission)
    return o ? o.allowed : defaultAllows(role, permission)
  }

  async function togglePermission(role: ConfigurableRole, permission: string, allowed: boolean) {
    if (!sid) return
    setBusy(true)
    try {
      await setRolePermission(sid, role, permission, allowed)
      setOverrides((prev) => {
        const rest = prev.filter((x) => !(x.role === role && x.permission === permission))
        return [...rest, { role, permission, allowed }]
      })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="py-8 text-sm text-muted-foreground">Loading access settings…</div>

  // Group permissions by module for the matrix.
  const groups = PERMISSIONS.reduce<Record<string, typeof PERMISSIONS>>((acc, p) => {
    ;(acc[p.module] ??= []).push(p)
    return acc
  }, {})

  return (
    <div className="space-y-10">
      {/* Module visibility */}
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-medium">Module Visibility</h3>
          <p className="text-sm text-muted-foreground">
            Switch modules off for your whole school. Disabled modules disappear from the menu for everyone.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TOGGLEABLE_FEATURES.map((f) => {
            const enabled = !disabled.includes(f)
            return (
              <label
                key={f}
                className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
              >
                <span>{FEATURE_LABEL[f]}</span>
                <Switch checked={enabled} disabled={busy} onCheckedChange={(v) => toggleFeature(f, v)} />
              </label>
            )
          })}
        </div>
      </section>

      {/* Role permission matrix */}
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-medium">Role Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Fine-tune what each role can do. Changes apply the next time the user signs in.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2.5">Capability</th>
                {CONFIGURABLE_ROLES.map((r) => (
                  <th key={r} className="px-3 py-2.5 text-center">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([module, perms]) => (
                <FragmentGroup key={module} module={module}>
                  {perms.map((p) => (
                    <tr key={p.key} className="border-t">
                      <td className="px-3 py-2 text-foreground">{p.label}</td>
                      {CONFIGURABLE_ROLES.map((r) => (
                        <td key={r} className="px-3 py-2 text-center">
                          <Switch
                            checked={isAllowed(r, p.key)}
                            disabled={busy || r === 'school_admin'}
                            onCheckedChange={(v) => togglePermission(r, p.key, v)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </FragmentGroup>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          School Admin retains full access and can&apos;t be restricted here.
        </p>
      </section>
    </div>
  )
}

function FragmentGroup({ module, children }: { module: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={1 + CONFIGURABLE_ROLES.length} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {module}
        </td>
      </tr>
      {children}
    </>
  )
}
