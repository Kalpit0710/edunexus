'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, ScrollText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/loaders/page-loaders'
import { getAuditLogs, type AuditLogRow } from '../actions'
import { getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

const ACTION_BADGE: Record<string, string> = {
  'school.created': 'bg-green-500/15 text-green-400 border-green-500/20',
  'school.updated': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'school.suspended': 'bg-red-500/15 text-red-400 border-red-500/20',
  'school.reactivated': 'bg-green-500/15 text-green-400 border-green-500/20',
  'user.activated': 'bg-green-500/15 text-green-400 border-green-500/20',
  'user.deactivated': 'bg-red-500/15 text-red-400 border-red-500/20',
  'user.password_reset': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'impersonation.started': 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  'impersonation.ended': 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20',
  'plan_price.updated': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
}

function formatAction(a: string) {
  return a.replace(/\./g, ' · ').replace(/_/g, ' ')
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  async function load() {
    setLoading(true)
    try {
      setLogs(await getAuditLogs())
    } catch (e) {
      toast.error('Failed to load audit log: ' + getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs])

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false
      if (!search) return true
      const term = search.toLowerCase()
      return (
        (l.actor_email ?? '').toLowerCase().includes(term) ||
        (l.entity_label ?? '').toLowerCase().includes(term) ||
        (l.school_name ?? '').toLowerCase().includes(term) ||
        l.action.toLowerCase().includes(term)
      )
    })
  }, [logs, actionFilter, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Audit Log</h2>
          <p className="text-muted-foreground">Platform-wide record of administrative actions.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex max-w-sm flex-1 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Search by actor, target, school, action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>{formatAction(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={8} columns={5} aria-label="Loading audit log" />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <ScrollText className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">
                {logs.length === 0 ? 'No audit entries yet.' : 'No entries match your filters.'}
              </h3>
              {logs.length === 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Administrative actions (creating, suspending, updating schools &amp; users) will appear here.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">When</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                    <th className="px-6 py-3 font-medium">Target</th>
                    <th className="px-6 py-3 font-medium">School</th>
                    <th className="px-6 py-3 font-medium">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                        {new Date(l.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${ACTION_BADGE[l.action] ?? 'border-zinc-500/20 bg-zinc-500/15 text-zinc-300'}`}>
                          {formatAction(l.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{l.entity_label ?? l.entity_type ?? '—'}</td>
                      <td className="px-6 py-4 text-muted-foreground">{l.school_name ?? '— Platform —'}</td>
                      <td className="px-6 py-4 text-muted-foreground">{l.actor_email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
