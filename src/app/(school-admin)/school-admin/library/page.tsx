'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import {
  getLibraryData,
  createBook,
  updateBook,
  deleteBook,
  issueBook,
  returnBook,
  type LibraryData,
  type BookRow,
  type LoanRow,
  type StudentOption,
} from './actions'
import { schoolToday, localDateISO } from '@/lib/date-utils'
import { getErrorMessage } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { BookMarked, Plus, Pencil, Trash2, BookUp, BookDown, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return localDateISO(d)
}

export default function LibraryPage() {
  const { school } = useAuthStore()
  const schoolId = school?.id ?? ''
  const [data, setData] = useState<LibraryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      setData(await getLibraryData(schoolId))
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading library…" className="mt-20" />
  if (error) return <DataLoadError message={error} onRetry={load} />
  if (!data) return null

  const outstanding = data.loans.filter((l) => l.status === 'issued').length

  return (
    <div className="px-6 py-6 space-y-5 max-w-5xl">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400">
          <BookMarked className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Library</h1>
          <p className="text-sm text-zinc-500">
            {data.books.length} title{data.books.length === 1 ? '' : 's'} · {outstanding} on loan
          </p>
        </div>
      </header>

      <Tabs defaultValue="loans">
        <TabsList>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="books">Catalogue</TabsTrigger>
        </TabsList>
        <TabsContent value="loans" className="mt-4">
          <LoansTab schoolId={schoolId} data={data} onChanged={load} />
        </TabsContent>
        <TabsContent value="books" className="mt-4">
          <BooksTab schoolId={schoolId} books={data.books} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Loans ───────────────────────────────────────────────────

function LoansTab({
  schoolId,
  data,
  onChanged,
}: {
  schoolId: string
  data: LibraryData
  onChanged: () => void
}) {
  const today = schoolToday()
  const [showReturned, setShowReturned] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [returnTarget, setReturnTarget] = useState<LoanRow | null>(null)

  const visible = data.loans.filter((l) => (showReturned ? l.status !== 'issued' : l.status === 'issued'))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Switch checked={showReturned} onCheckedChange={setShowReturned} id="show-returned" />
          <Label htmlFor="show-returned">Show closed loans</Label>
        </div>
        <Button size="sm" onClick={() => setIssuing(true)} disabled={data.books.length === 0 || data.students.length === 0}>
          <BookUp className="mr-1.5 h-4 w-4" /> Issue book
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-zinc-500">
          {showReturned ? 'No closed loans yet.' : 'No books are currently on loan.'}
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((l) => {
            const overdue = l.status === 'issued' && l.dueDate < today
            return (
              <Card key={l.id} className={`flex items-center gap-3 p-3 ${overdue ? 'border-amber-500/30' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{l.bookTitle}</p>
                  <p className="text-xs text-zinc-500">
                    {l.studentName}
                    {l.admissionNumber ? ` · ${l.admissionNumber}` : ''} · Due{' '}
                    {new Date(l.dueDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
                {l.status === 'issued' ? (
                  <>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> Overdue
                      </span>
                    )}
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReturnTarget(l)}>
                      <BookDown className="h-3.5 w-3.5" /> Return
                    </Button>
                  </>
                ) : (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      l.status === 'lost' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    {l.status === 'lost' ? 'Lost' : 'Returned'}
                    {l.fineAmount > 0 ? ` · ₹${l.fineAmount}` : ''}
                  </span>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {issuing && (
        <IssueDialog
          schoolId={schoolId}
          books={data.books.filter((b) => b.copiesAvailable > 0)}
          students={data.students}
          onClose={() => setIssuing(false)}
          onIssued={() => {
            setIssuing(false)
            onChanged()
          }}
        />
      )}

      {returnTarget && (
        <ReturnDialog
          loan={returnTarget}
          onClose={() => setReturnTarget(null)}
          onReturned={() => {
            setReturnTarget(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function IssueDialog({
  schoolId,
  books,
  students,
  onClose,
  onIssued,
}: {
  schoolId: string
  books: BookRow[]
  students: StudentOption[]
  onClose: () => void
  onIssued: () => void
}) {
  const [bookId, setBookId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [dueDate, setDueDate] = useState(addDays(schoolToday(), 14))
  const [saving, setSaving] = useState(false)

  async function handleIssue() {
    setSaving(true)
    try {
      await issueBook({ schoolId, bookId, studentId, dueDate })
      toast.success('Book issued')
      onIssued()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue a book</DialogTitle>
        </DialogHeader>
        {books.length === 0 ? (
          <p className="text-sm text-amber-400/80">No books have available copies right now.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Book</Label>
              <Select value={bookId} onValueChange={setBookId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a book" />
                </SelectTrigger>
                <SelectContent>
                  {books.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title} ({b.copiesAvailable} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.className ? ` · ${s.className}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <DateInput value={dueDate} min={schoolToday()} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleIssue} disabled={saving || !bookId || !studentId}>
            {saving ? 'Issuing…' : 'Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReturnDialog({
  loan,
  onClose,
  onReturned,
}: {
  loan: LoanRow
  onClose: () => void
  onReturned: () => void
}) {
  const today = schoolToday()
  const overdueDays = Math.max(0, Math.round((new Date(today).getTime() - new Date(loan.dueDate).getTime()) / 86400000))
  const [returnedDate, setReturnedDate] = useState(today)
  const [fine, setFine] = useState(0)
  const [lost, setLost] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleReturn() {
    setSaving(true)
    try {
      await returnBook({ loanId: loan.id, returnedDate, fine: Number(fine) || 0, lost })
      toast.success(lost ? 'Marked as lost' : 'Book returned')
      onReturned()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return “{loan.bookTitle}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {overdueDays > 0 && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              {overdueDays} day{overdueDays === 1 ? '' : 's'} overdue — apply a fine if your policy requires it.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Return date</Label>
            <DateInput value={returnedDate} onChange={(e) => setReturnedDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fine (₹)</Label>
            <Input type="number" min={0} value={fine} onChange={(e) => setFine(Number(e.target.value))} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
            <div>
              <p className="text-sm text-white">Mark as lost</p>
              <p className="text-xs text-zinc-500">The copy is removed from the catalogue total.</p>
            </div>
            <Switch checked={lost} onCheckedChange={setLost} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleReturn} disabled={saving}>
            {saving ? 'Saving…' : lost ? 'Mark lost' : 'Confirm return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Catalogue ───────────────────────────────────────────────

function BooksTab({
  schoolId,
  books,
  onChanged,
}: {
  schoolId: string
  books: BookRow[]
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<BookRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BookRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return books
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author ?? '').toLowerCase().includes(q) ||
        (b.isbn ?? '').toLowerCase().includes(q),
    )
  }, [books, search])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBook(schoolId, deleteTarget.id)
      toast.success('Book removed')
      setDeleteTarget(null)
      onChanged()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search title, author or ISBN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add book
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-12 text-center text-sm text-zinc-500">
          {books.length === 0 ? 'No books in the catalogue yet.' : 'No books match your search.'}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <Card key={b.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{b.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {[b.author, b.isbn ? `ISBN ${b.isbn}` : null, b.shelfLocation].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  b.copiesAvailable === 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}
              >
                {b.copiesAvailable}/{b.copiesTotal} available
              </span>
              <Button variant="ghost" size="icon" onClick={() => setEditing(b)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(b)}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <BookDialog
          schoolId={schoolId}
          book={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            onChanged()
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove book?"
        description={`"${deleteTarget?.title}" will be removed from the catalogue.`}
        confirmLabel="Remove"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function BookDialog({
  schoolId,
  book,
  onClose,
  onSaved,
}: {
  schoolId: string
  book: BookRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(book?.title ?? '')
  const [author, setAuthor] = useState(book?.author ?? '')
  const [isbn, setIsbn] = useState(book?.isbn ?? '')
  const [category, setCategory] = useState(book?.category ?? '')
  const [shelf, setShelf] = useState(book?.shelfLocation ?? '')
  const [copies, setCopies] = useState(book?.copiesTotal ?? 1)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const input = {
        schoolId,
        title,
        author: author || null,
        isbn: isbn || null,
        category: category || null,
        shelfLocation: shelf || null,
        copiesTotal: Number(copies) || 0,
      }
      if (book) await updateBook(book.id, input)
      else await createBook(input)
      toast.success(book ? 'Book updated' : 'Book added')
      onSaved()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{book ? 'Edit book' : 'Add book'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Author</Label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ISBN</Label>
              <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Fiction" />
            </div>
            <div className="space-y-1.5">
              <Label>Shelf</Label>
              <Input value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="e.g. A-3" />
            </div>
            <div className="space-y-1.5">
              <Label>Total copies</Label>
              <Input type="number" min={0} value={copies} onChange={(e) => setCopies(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
