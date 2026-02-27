# EduNexus — API Design

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27  
> **API Provider:** Supabase PostgREST + Edge Functions

---

## Overview

EduNexus does not maintain a traditional REST API. All data access goes through:
1. **Supabase PostgREST** — auto-generated REST API from PostgreSQL schema
2. **Supabase RPC** — PostgreSQL functions called via `supabase.rpc()`
3. **Edge Functions** — Deno-based compute for PDF, email, cron jobs

All APIs are authenticated via JWT. All data is filtered by RLS automatically.

---

## Supabase Client Initialization

### Browser Client (Client Components)
```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Server Client (Server Components / API Routes)
```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
}
```

---

## Students API

### List Students
```typescript
// GET /rest/v1/students (via Supabase client)
const { data, count, error } = await supabase
  .from('students')
  .select(`
    id, first_name, last_name, admission_number, status, photo_url,
    sections!inner(name, classes!inner(name)),
    parents(first_name, last_name, phone, is_primary)
  `, { count: 'exact' })
  .is('deleted_at', null)
  .eq('status', filters.status ?? 'active')
  .ilike('first_name', filters.search ? `%${filters.search}%` : '%')
  .order('first_name', { ascending: true })
  .range(offset, offset + limit - 1)
```

### Create Student
```typescript
const { data, error } = await supabase
  .from('students')
  .insert({
    school_id: session.school_id,
    section_id: formData.section_id,
    first_name: formData.first_name,
    last_name: formData.last_name,
    admission_number: formData.admission_number,
    date_of_birth: formData.date_of_birth,
    gender: formData.gender,
    admission_date: new Date().toISOString().split('T')[0],
  })
  .select()
  .single()
```

### Bulk Import Students
```typescript
// Validate first, then upsert
const { data, error } = await supabase
  .from('students')
  .upsert(validatedStudents, {
    onConflict: 'school_id,admission_number',  // update if exists
    ignoreDuplicates: false,
  })
```

---

## Attendance API

### Mark Attendance (Single or Bulk)
```typescript
// Upsert — one record per student per day
const records = students.map(student => ({
  school_id: schoolId,
  student_id: student.id,
  section_id: sectionId,
  date: selectedDate,
  status: attendanceMap[student.id],
  marked_by: userId,
}))

const { error } = await supabase
  .from('attendance')
  .upsert(records, {
    onConflict: 'school_id,student_id,date',
  })
```

### Get Monthly Attendance Summary
```typescript
// Uses a PostgreSQL function for efficiency
const { data, error } = await supabase.rpc('get_attendance_summary', {
  p_school_id: schoolId,
  p_section_id: sectionId,
  p_month: '2025-03',
})
// Returns: student_id, student_name, present_days, absent_days, percentage
```

---

## Fee API

### Get Student Fee Status
```typescript
const { data, error } = await supabase
  .from('fee_installments')
  .select(`
    id, installment_no, due_date, total_amount, paid_amount, late_fee, discount, status,
    fee_structures(name, frequency, fee_heads(name, type, amount))
  `)
  .eq('student_id', studentId)
  .order('due_date', { ascending: true })
```

### Collect Fee (via RPC — atomic)
```typescript
const { data: paymentId, error } = await supabase.rpc('collect_fee', {
  p_school_id: schoolId,
  p_student_id: studentId,
  p_installment_id: installmentId,
  p_amount: amount,
  p_payment_mode: paymentMode,  // 'cash' | 'upi' | 'card'
  p_collected_by: userId,
  p_reference_no: referenceNumber ?? null,
  p_notes: notes ?? null,
})
// Returns: payment UUID → use to trigger PDF generation
```

### Generate Receipt PDF (Edge Function)
```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pdf`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'fee_receipt',
      payment_id: paymentId,
    }),
  }
)
const { url } = await response.json()  // signed URL to PDF
```

---

## Examination API

### Create Exam
```typescript
const { data: exam, error } = await supabase
  .from('exams')
  .insert({
    school_id: schoolId,
    class_id: formData.class_id,
    name: formData.name,
    academic_year: currentAcademicYear,
    start_date: formData.start_date,
    end_date: formData.end_date,
    status: 'draft',
  })
  .select()
  .single()

// Then add subjects
const examSubjects = formData.subjects.map(s => ({
  school_id: schoolId,
  exam_id: exam.id,
  subject_id: s.subject_id,
  exam_date: s.date,
  max_marks: s.max_marks,
  pass_marks: s.pass_marks,
}))

await supabase.from('exam_subjects').insert(examSubjects)
```

### Enter Marks (Bulk)
```typescript
// Upsert marks for entire class
const marksData = students.map(student => ({
  school_id: schoolId,
  exam_id: examId,
  exam_subject_id: examSubjectId,
  student_id: student.id,
  marks_obtained: marksInput[student.id] ?? null,
  is_absent: absentMap[student.id] ?? false,
  entered_by: userId,
  entered_at: new Date().toISOString(),
}))

await supabase
  .from('marks')
  .upsert(marksData, { onConflict: 'exam_subject_id,student_id' })
```

### Publish Results
```typescript
// Via RPC for atomic status change + notification trigger
await supabase.rpc('publish_exam_results', {
  p_exam_id: examId,
  p_notify_parents: true,
})
```

---

## Inventory API

### Add Stock
```typescript
// Use a transaction via RPC to update stock + log adjustment
await supabase.rpc('adjust_stock', {
  p_item_id: itemId,
  p_quantity: quantity,   // positive = add, negative = remove
  p_type: 'add',          // 'add' | 'remove' | 'adjustment'
  p_reason: reason,
  p_adjusted_by: userId,
})
```

### POS Sale
```typescript
await supabase.rpc('create_inventory_sale', {
  p_school_id: schoolId,
  p_student_id: studentId ?? null,
  p_items: JSON.stringify(cartItems),  // [{item_id, quantity, unit_price}]
  p_payment_mode: paymentMode,
  p_sold_by: userId,
})
// Returns: { sale_id, bill_number, total_amount }
```

---

## Edge Function Reference

### `generate-pdf`
```
POST /functions/v1/generate-pdf
Authorization: Bearer <JWT>

Request body:
{
  "type": "fee_receipt" | "report_card" | "inventory_bill",
  "payment_id": "uuid",         // for fee_receipt
  "student_id": "uuid",         // for report_card
  "exam_id": "uuid",            // for report_card
  "sale_id": "uuid"             // for inventory_bill
}

Response:
{
  "url": "signed-url",          // 1-hour signed URL to PDF
  "storage_path": "path/in/bucket"
}
```

### `send-email`
```
POST /functions/v1/send-email
Authorization: Bearer <service-role-only>

Request body:
{
  "type": "fee_reminder" | "attendance_alert" | "receipt" | "exam_notification",
  "to": "parent@email.com",
  "data": {}  // type-specific payload
}
```

### `process-late-fees`
```
POST /functions/v1/process-late-fees
Authorization: Bearer <service-role> (called by cron)

Request body:
{
  "school_id": "uuid"  // optional; if omitted, processes all active schools
}

Response:
{
  "processed_schools": 12,
  "updated_installments": 47
}
```

---

## Error Handling

### Standard Error Pattern

```typescript
// All API calls follow this pattern in the application layer
export async function fetchStudents(filters: StudentFilters) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (error) {
    // Log to monitoring (Phase 3: add Sentry/LogRocket)
    console.error('[fetchStudents]', error)
    
    // Return typed error for UI handling
    throw new ApiError(error.message, error.code)
  }
  
  return data
}
```

### Error Codes Reference

| Supabase Code | Meaning | UI Action |
|---------------|---------|-----------|
| `23505` | Unique constraint violation | "This record already exists" |
| `23503` | Foreign key violation | "Related record not found" |
| `42501` | RLS policy violation | Log user out + show "Access denied" |
| `PGRST116` | Row not found | "Record not found" |
| `PGRST301` | JWT invalid/expired | Redirect to login |

---

## Query Optimization Guidelines

1. **Always select specific columns** — avoid `select('*')` in production
2. **Use foreign table embedding** — `select('*, sections(name)')` over two queries
3. **Use `count: 'exact'` only when pagination UI needs total count**
4. **Use `head: true`** for existence checks (no data needed)
5. **Use RPC for multi-table writes** — ensures atomicity
6. **Cache stable data** — school config, class list, subject list with React Query `staleTime`

```typescript
// CORRECT: Efficient query
.select('id, first_name, last_name, sections(name)')

// WRONG: Over-fetching
.select('*')

// CORRECT: Existence check
const { count } = await supabase
  .from('students')
  .select('*', { head: true, count: 'exact' })
  .eq('admission_number', 'ADM-001')

// WRONG: Fetches data just to check existence
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('admission_number', 'ADM-001')
if (data?.length > 0) ...
```
