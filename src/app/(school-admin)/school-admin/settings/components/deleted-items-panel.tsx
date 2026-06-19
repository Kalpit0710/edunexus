'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDeletedConfigEntities } from '../actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RotateCcw, Trash } from 'lucide-react'
import { getErrorMessage } from '@/lib/utils'

type ConfigEntity = 'classes' | 'sections' | 'subjects' | 'academic_years' | 'grading_rules'

interface DeletedItemsPanelProps {
    /** Which configuration table to list soft-deleted rows for. */
    entity: ConfigEntity
    /** Heading shown above the list. */
    title?: string
    /** Entity-specific restore server action. */
    restoreAction: (id: string) => Promise<void>
    /** Bump this from the parent (e.g. after a delete) to reload the list. */
    refreshKey?: number
    /** Called after a successful restore so the parent can refresh its live list. */
    onRestored?: () => void
}

/**
 * Trash / restore panel for soft-deleted school-configuration rows.
 * Hidden entirely when there is nothing in the trash. Backs Chunk 1.2's
 * `getDeletedConfigEntities()` + `restore*` server actions.
 */
export function DeletedItemsPanel({
    entity,
    title = 'Recently deleted',
    restoreAction,
    refreshKey,
    onRestored,
}: DeletedItemsPanelProps) {
    const [items, setItems] = useState<{ id: string; label: string | null; deletedAt: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [restoringId, setRestoringId] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getDeletedConfigEntities(entity)
            setItems(data)
        } catch (e) {
            toast.error(getErrorMessage(e))
        } finally {
            setLoading(false)
        }
    }, [entity])

    useEffect(() => {
        load()
    }, [load, refreshKey])

    async function handleRestore(id: string) {
        setRestoringId(id)
        try {
            await restoreAction(id)
            toast.success('Item restored')
            await load()
            onRestored?.()
        } catch (e) {
            toast.error(getErrorMessage(e))
        } finally {
            setRestoringId(null)
        }
    }

    // Stay out of the way when the trash is empty (or still loading the first time).
    if (items.length === 0) return null

    return (
        <div className="rounded-md border border-dashed bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Trash className="h-4 w-4" /> {title} ({items.length})
            </div>
            <div className="space-y-2">
                {items.map(item => (
                    <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
                    >
                        <div className="min-w-0">
                            <span className="font-medium">{item.label || 'Untitled'}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                                deleted {new Date(item.deletedAt).toLocaleDateString()}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={loading || restoringId === item.id}
                            onClick={() => handleRestore(item.id)}
                        >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            {restoringId === item.id ? 'Restoring...' : 'Restore'}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
