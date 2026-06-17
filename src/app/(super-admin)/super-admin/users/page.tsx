'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Power, KeyRound, Users as UsersIcon, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TableSkeleton } from '@/components/loaders/page-loaders'
import { getAllUsers, setUserActive, resetUserPassword, startImpersonation, type PlatformUserRow } from '../actions'
import { getInitials, getErrorMessage } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  teacher: 'Teacher',
  manager: 'Manager',
  cashier: 'Cashier',
  parent: 'Parent',
}

export default function PlatformUsersPage() {
  const router = useRouter()
  const resetAuth = useAuthStore((s) => s.reset)
  const [users, setUsers] = useState<PlatformUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [schoolFilter, setSchoolFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)

  // Reset-password dialog state
  const [resetTarget, setResetTarget] = useState<PlatformUserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  async function load() {
    try {
      setUsers(await getAllUsers())
    } catch (e) {
      toast.error('Failed to load users: ' + getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const schools = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((u) => {
      if (u.school_id && u.school_name) map.set(u.school_id, u.school_name)
    })
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [users])

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (schoolFilter !== 'all') {
        if (schoolFilter === 'platform' ? u.school_id !== null : u.school_id !== schoolFilter) return false
      }
      if (!search) return true
      const term = search.toLowerCase()
      return (
        u.full_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.school_name ?? '').toLowerCase().includes(term)
      )
    })
  }, [users, roleFilter, schoolFilter, search])

  async function handleToggleActive(u: PlatformUserRow) {
    if (u.role === 'super_admin') {
      toast.error('Super admins cannot be deactivated here.')
      return
    }
    setBusyId(u.id)
    try {
      await setUserActive(u.id, !u.is_active)
      toast.success(u.is_active ? 'User deactivated' : 'User activated')
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReset() {
    if (!resetTarget || newPassword.length < 8) return
    setResetting(true)
    try {
      await resetUserPassword(resetTarget.auth_user_id, newPassword)
      toast.success(`Password reset for ${resetTarget.full_name}`)
      setResetTarget(null)
      setNewPassword('')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setResetting(false)
    }
  }

  async function handleImpersonate(u: PlatformUserRow) {
    if (u.role === 'super_admin') {
      toast.error('Super admins cannot be impersonated.')
      return
    }
    if (!confirm(`Start a 30-minute audited impersonation session as ${u.full_name}? Your super-admin session will be restored when you exit.`)) return
    setImpersonatingId(u.id)
    try {
      const dest = await startImpersonation(u.id)
      toast.success(`Now viewing as ${u.full_name}`)
      resetAuth()
      router.push(dest as never)
      router.refresh()
    } catch (e) {
      toast.error(getErrorMessage(e))
      setImpersonatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Users</h2>
        <p className="text-muted-foreground">All staff and admins across every school.</p>
      </div>

      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex max-w-sm flex-1 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, school..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="School" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  <SelectItem value="platform">Platform (no school)</SelectItem>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={8} columns={5} aria-label="Loading users" />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <UsersIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No users match your filters.</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">School</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(u.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{u.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{ROLE_LABEL[u.role] ?? u.role}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {u.school_name ? `${u.school_name}` : '— Platform —'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            u.is_active
                              ? 'border-green-500/20 bg-green-500/15 text-green-400'
                              : 'border-zinc-500/20 bg-zinc-500/15 text-zinc-400'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {u.role !== 'super_admin' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Impersonate (view as)"
                              onClick={() => handleImpersonate(u)}
                              disabled={impersonatingId === u.id}
                              className="h-8 w-8 text-muted-foreground hover:text-amber-400 disabled:opacity-50"
                            >
                              {impersonatingId === u.id ? <Spinner size="sm" /> : <UserCog className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reset password"
                            onClick={() => { setResetTarget(u); setNewPassword('') }}
                            className="h-8 w-8 text-muted-foreground hover:text-blue-400"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {u.role !== 'super_admin' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                              onClick={() => handleToggleActive(u)}
                              disabled={busyId === u.id}
                              className={`h-8 w-8 disabled:opacity-50 ${
                                u.is_active
                                  ? 'text-muted-foreground hover:text-red-500'
                                  : 'text-muted-foreground hover:text-green-600'
                              }`}
                            >
                              {busyId === u.id ? <Spinner size="sm" /> : <Power className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPassword('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {resetTarget?.full_name} ({resetTarget?.email}). Share it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>New password (min 8 chars)</Label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Temporary password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPassword('') }}>Cancel</Button>
            <Button onClick={handleReset} disabled={newPassword.length < 8 || resetting}>
              {resetting && <Spinner size="sm" className="mr-2 border-primary-foreground" />}
              {resetting ? 'Resetting…' : 'Reset password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
