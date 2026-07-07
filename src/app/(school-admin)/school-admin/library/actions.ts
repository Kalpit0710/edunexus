'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type DbClient = Awaited<ReturnType<typeof getSupabase>>
type LibraryStudentQueryRow = Pick<
  Database['public']['Tables']['students']['Row'],
  'id' | 'full_name' | 'admission_number'
> & {
  classes: { name: string | null } | null
}
type LibraryBookQueryRow = Pick<
  Database['public']['Tables']['library_books']['Row'],
  'id' | 'title' | 'author' | 'isbn' | 'category' | 'shelf_location' | 'copies_total' | 'copies_available'
>
type LibraryLoanQueryRow = Pick<
  Database['public']['Tables']['book_loans']['Row'],
  'id' | 'book_id' | 'student_id' | 'issued_date' | 'due_date' | 'returned_date' | 'status' | 'fine_amount'
> & {
  library_books: { title: string | null } | null
  students: { full_name: string | null; admission_number: string | null } | null
}

export interface BookRow {
  id: string
  title: string
  author: string | null
  isbn: string | null
  category: string | null
  shelfLocation: string | null
  copiesTotal: number
  copiesAvailable: number
}

export interface LoanRow {
  id: string
  bookId: string
  bookTitle: string
  studentId: string
  studentName: string
  admissionNumber: string | null
  issuedDate: string
  dueDate: string
  returnedDate: string | null
  status: 'issued' | 'returned' | 'lost'
  fineAmount: number
}

export interface StudentOption {
  id: string
  name: string
  admissionNumber: string | null
  className: string | null
}

export interface LibraryData {
  books: BookRow[]
  loans: LoanRow[]
  students: StudentOption[]
}

export interface BookInput {
  schoolId: string
  title: string
  author: string | null
  isbn: string | null
  category: string | null
  shelfLocation: string | null
  copiesTotal: number
}

function normalizeLoanStatus(value: string): LoanRow['status'] {
  if (value === 'issued' || value === 'returned' || value === 'lost') return value
  return 'issued'
}

async function getActiveStudents(
  db: DbClient,
  schoolId: string,
): Promise<StudentOption[]> {
  const { data } = await db
    .from('students')
    .select('id, full_name, admission_number, classes ( name )')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .limit(2000)
  return ((data ?? []) as LibraryStudentQueryRow[]).map((s) => ({
    id: s.id,
    name: s.full_name,
    admissionNumber: s.admission_number,
    className: s.classes?.name ?? null,
  }))
}

export async function getLibraryData(schoolId: string): Promise<LibraryData> {
  const supabase = await getSupabase()
  const db = supabase

  const [{ data: books }, { data: loans }, students] = await Promise.all([
    db
      .from('library_books')
      .select('id, title, author, isbn, category, shelf_location, copies_total, copies_available')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('title', { ascending: true }),
    db
      .from('book_loans')
      .select('id, book_id, student_id, issued_date, due_date, returned_date, status, fine_amount, library_books ( title ), students ( full_name, admission_number )')
      .eq('school_id', schoolId)
      .order('issued_date', { ascending: false })
      .limit(500),
    getActiveStudents(db, schoolId),
  ])

  return {
    books: ((books ?? []) as LibraryBookQueryRow[]).map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      category: b.category,
      shelfLocation: b.shelf_location,
      copiesTotal: b.copies_total,
      copiesAvailable: b.copies_available,
    })),
    loans: ((loans ?? []) as LibraryLoanQueryRow[]).map((l) => ({
      id: l.id,
      bookId: l.book_id,
      bookTitle: l.library_books?.title ?? '—',
      studentId: l.student_id,
      studentName: l.students?.full_name ?? '—',
      admissionNumber: l.students?.admission_number ?? null,
      issuedDate: l.issued_date,
      dueDate: l.due_date,
      returnedDate: l.returned_date,
      status: normalizeLoanStatus(l.status),
      fineAmount: Number(l.fine_amount),
    })),
    students,
  }
}

function assertBook(input: BookInput): void {
  if (!input.title.trim()) throw new Error('Title is required.')
  if (!Number.isFinite(input.copiesTotal) || input.copiesTotal < 0) {
    throw new Error('Copies must be zero or more.')
  }
}

export async function createBook(input: BookInput): Promise<void> {
  assertBook(input)
  const supabase = await getSupabase()
  const db = supabase
  const { error } = await db.from('library_books').insert({
    school_id: input.schoolId,
    title: input.title.trim(),
    author: input.author?.trim() || null,
    isbn: input.isbn?.trim() || null,
    category: input.category?.trim() || null,
    shelf_location: input.shelfLocation?.trim() || null,
    copies_total: input.copiesTotal,
    copies_available: input.copiesTotal,
  })
  if (error) throw new Error(error.message)
}

/**
 * Updates catalogue fields. When the total changes, the available count is
 * shifted by the same delta so the books currently on loan stay accounted for
 * (clamped to the [0, total] range by the DB check constraint).
 */
export async function updateBook(id: string, input: BookInput): Promise<void> {
  assertBook(input)
  const supabase = await getSupabase()
  const db = supabase

  const { data: current } = await db
    .from('library_books')
    .select('copies_total, copies_available')
    .eq('id', id)
    .eq('school_id', input.schoolId)
    .maybeSingle()
  if (!current) throw new Error('Book not found.')

  const onLoan = current.copies_total - current.copies_available
  if (input.copiesTotal < onLoan) {
    throw new Error(`${onLoan} cop${onLoan === 1 ? 'y is' : 'ies are'} on loan — total cannot be below that.`)
  }
  const nextAvailable = input.copiesTotal - onLoan

  const { error } = await db
    .from('library_books')
    .update({
      title: input.title.trim(),
      author: input.author?.trim() || null,
      isbn: input.isbn?.trim() || null,
      category: input.category?.trim() || null,
      shelf_location: input.shelfLocation?.trim() || null,
      copies_total: input.copiesTotal,
      copies_available: nextAvailable,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', input.schoolId)
  if (error) throw new Error(error.message)
}

export async function deleteBook(schoolId: string, id: string): Promise<void> {
  const supabase = await getSupabase()
  const db = supabase

  const { data: outstanding } = await db
    .from('book_loans')
    .select('id')
    .eq('school_id', schoolId)
    .eq('book_id', id)
    .eq('status', 'issued')
    .limit(1)
  if ((outstanding ?? []).length > 0) {
    throw new Error('This book still has copies on loan. Collect them before removing it.')
  }

  const { error } = await db
    .from('library_books')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}

export async function issueBook(input: {
  schoolId: string
  bookId: string
  studentId: string
  dueDate: string
}): Promise<void> {
  if (!input.bookId) throw new Error('Select a book.')
  if (!input.studentId) throw new Error('Select a student.')
  if (!input.dueDate) throw new Error('A due date is required.')
  const supabase = await getSupabase()
  const db = supabase
  const { error } = await db.rpc('issue_book', {
    p_school_id: input.schoolId,
    p_book_id: input.bookId,
    p_student_id: input.studentId,
    p_due_date: input.dueDate,
  })
  if (error) throw new Error(error.message)
}

export async function returnBook(input: {
  loanId: string
  returnedDate: string
  fine: number
  lost: boolean
}): Promise<void> {
  const supabase = await getSupabase()
  const db = supabase
  const { error } = await db.rpc('return_book', {
    p_loan_id: input.loanId,
    p_returned_date: (input.returnedDate || null) as unknown as string,
    p_fine: input.fine,
    p_lost: input.lost,
  })
  if (error) throw new Error(error.message)
}
