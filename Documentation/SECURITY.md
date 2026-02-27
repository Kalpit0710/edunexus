# EduNexus — Security Model

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27  
> **Audience:** Developers, AI Assistants, Security Reviewers

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication](#authentication)
3. [Authorization — RBAC Matrix](#authorization--rbac-matrix)
4. [Row-Level Security (RLS)](#row-level-security-rls)
5. [JWT Design](#jwt-design)
6. [Session Management](#session-management)
7. [API Security](#api-security)
8. [Data Security](#data-security)
9. [File Security](#file-security)
10. [Audit Logging](#audit-logging)
11. [Compliance](#compliance)
12. [Security Testing Checklist](#security-testing-checklist)

---

## Security Overview

EduNexus uses a **defense-in-depth** approach:

```
Layer 1: HTTPS / TLS (transport)
Layer 2: Supabase Auth JWT (authentication)
Layer 3: Middleware route protection (Next.js)
Layer 4: PostgreSQL RLS (database row isolation)
Layer 5: Role-based application logic (UI + API)
Layer 6: Audit logging (accountability)
```

Every layer is independent. Bypassing one layer does not compromise the system.

---

## Authentication

### Providers
| Provider | Supported | Notes |
|----------|-----------|-------|
| Email + Password | ✅ | Supabase Auth, bcrypt hashed |
| Google OAuth | ✅ | Maps to existing user record by email |
| Phone / OTP | 🔲 Phase 3 | |
| SAML / SSO | 🔲 Future | For enterprise schools |

### Password Policy
- Minimum 8 characters
- At least 1 uppercase, 1 lowercase, 1 number
- Password reset via email link (valid 1 hour)
- Passwords never stored in application layer (Supabase Auth handles all)

### Failed Login Handling
- 5 failed attempts → 15-minute account lockout (Supabase built-in rate limiting)
- Super Admin receives alert after 10 failed attempts across any school

---

## Authorization — RBAC Matrix

Legend: ✅ Full Access | 👁 Read Only | 🔒 Own data only | ❌ No Access | ⚙️ Configurable

### Module Access by Role

| Module/Action | Super Admin | School Admin | Teacher | Manager | Parent |
|---------------|-------------|--------------|---------|---------|--------|
| **School Management** | ✅ | ✅ own school | ❌ | ❌ | ❌ |
| **User Management** | ✅ | ✅ own school | ❌ | ❌ | ❌ |
| **Student — View** | ✅ | ✅ | 👁 own classes | 👁 | 🔒 own child |
| **Student — Create/Edit** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Student — Delete** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Teacher — CRUD** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Attendance — Mark** | ✅ | ✅ | ✅ own classes | ❌ | ❌ |
| **Attendance — View** | ✅ | ✅ | ✅ own classes | 👁 | 🔒 own child |
| **Attendance — Edit** | ✅ | ✅ | ⚙️ (configurable) | ❌ | ❌ |
| **Exams — Create** | ✅ | ✅ | ⚙️ per school config | ❌ | ❌ |
| **Marks — Enter** | ✅ | ✅ | ✅ own subjects | ❌ | ❌ |
| **Results — Publish** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Results — View** | ✅ | ✅ | ✅ own classes | 👁 | 🔒 own child ⚙️ |
| **Fee Structure — Setup** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Fee — Collect (POS)** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Fee — View History** | ✅ | ✅ | ❌ | ✅ | 🔒 own child |
| **Fee — Refund** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Fee — Discounts** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Inventory — CRUD** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Inventory — POS Sales** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Announcements — Create** | ✅ | ✅ | ✅ own classes | ❌ | ❌ |
| **Announcements — View** | ✅ | ✅ | ✅ | 👁 | 👁 own school |
| **Reports — Financial** | ✅ | ✅ | ❌ | ✅ (limited) | ❌ |
| **Reports — Academic** | ✅ | ✅ | ✅ own classes | ❌ | 🔒 own child |
| **Audit Logs** | ✅ | ✅ own school | ❌ | ❌ | ❌ |
| **All Schools Analytics** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Subscription Management** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Row-Level Security (RLS)

### Critical Rule
> **RLS is the last line of defense for data isolation. It must never be disabled on production tables. All application-level access control is secondary to RLS.**

### RLS Testing Matrix

Each table must be tested for:

```
1. School A admin CANNOT read School B data          → test_rls_school_isolation
2. Teacher CANNOT read other teacher's private data  → test_rls_teacher_scope
3. Parent CANNOT read another child's data           → test_rls_parent_child_scope
4. Unauthenticated request returns 0 rows            → test_rls_unauthenticated
5. Service role CAN bypass RLS (for Edge Fn)         → test_rls_service_role
```

### How to Test RLS

```typescript
// tests/security/rls.test.ts
import { createClient } from '@supabase/supabase-js'

describe('RLS: student table isolation', () => {
  it('school A admin cannot see school B students', async () => {
    const schoolAClient = createClient(URL, ANON_KEY)
    // Sign in as School A admin
    await schoolAClient.auth.signInWithPassword({
      email: 'admin@schoola.test',
      password: 'testpass',
    })

    const { data } = await schoolAClient.from('students').select('*')
    
    // Should only return School A students
    expect(data?.every(s => s.school_id === SCHOOL_A_ID)).toBe(true)
  })
  
  it('unauthenticated request returns empty', async () => {
    const anonClient = createClient(URL, ANON_KEY)
    const { data } = await anonClient.from('students').select('*')
    expect(data).toHaveLength(0)
  })
})
```

---

## JWT Design

### Token Claims Structure

```json
{
  "iss": "https://project.supabase.co/auth/v1",
  "sub": "user-uuid",
  "email": "teacher@school.com",
  "role": "teacher",
  "school_id": "school-uuid",
  "iat": 1740000000,
  "exp": 1740003600,
  "aud": "authenticated",
  
  // Custom claims (injected by Auth hook):
  "app_role": "teacher",
  "app_school_id": "school-uuid"
}
```

### JWT → RLS Bridge

```sql
-- Extract custom claims in RLS policies
CREATE OR REPLACE FUNCTION auth.school_id() RETURNS UUID AS $$
  SELECT (auth.jwt() ->> 'app_school_id')::UUID
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.app_role() RETURNS TEXT AS $$
  SELECT auth.jwt() ->> 'app_role'
$$ LANGUAGE sql STABLE;

-- Use in policy:
CREATE POLICY "school_isolation" ON students
  USING (school_id = auth.school_id());
```

---

## Session Management

| Setting | Value | Notes |
|---------|-------|-------|
| JWT expiry | 1 hour | Short-lived for security |
| Refresh token expiry | 30 days | For "remember me" |
| Inactivity timeout | 8 hours | Configurable per school |
| Cookie type | httpOnly, Secure, SameSite=Strict | No JS access |
| Session storage | Database (Supabase) | Not localStorage |

### Middleware Protection

```typescript
// src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const { data: { session } } = await supabase.auth.getSession()
  
  // Protect all /school-admin/* routes
  if (req.nextUrl.pathname.startsWith('/school-admin')) {
    if (!session || session.user.app_metadata.role !== 'school_admin') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }
  
  // Protect /teacher/* routes
  if (req.nextUrl.pathname.startsWith('/teacher')) {
    if (!session || session.user.app_metadata.role !== 'teacher') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }
  
  return res
}
```

---

## API Security

### Edge Function Security

```typescript
// All Edge Functions validate the calling user
Deno.serve(async (req) => {
  // 1. Verify JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401 })
  
  // 2. Check role
  const userRole = user.app_metadata?.role
  if (!['school_admin', 'manager'].includes(userRole)) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // 3. Proceed with operation...
})
```

### Rate Limiting
- Login endpoint: 5 attempts per 15 minutes per IP
- PDF generation: 20 per minute per school
- Excel upload: 5 per minute per user
- Implemented via Edge Function + Supabase (Phase 2)

---

## Data Security

| Aspect | Implementation |
|--------|---------------|
| Passwords | Never in application — Supabase Auth handles |
| Database at rest | AES-256 encryption (Supabase managed) |
| Sensitive fields | Phone numbers, payment references — stored as-is (not encrypted beyond DB encryption) |
| File storage | Private buckets with signed URLs (1-hour expiry) |
| Excel uploads | Auto-deleted after 24 hours |
| Payment data | No card data stored — mode (Cash/UPI) and reference only |
| PII exposure | Parents only see their own child's data |

---

## File Security

### Signed URL Pattern

```typescript
// Generate signed URL (1 hour expiry)
const { data } = await supabase.storage
  .from('fee-receipts')
  .createSignedUrl(`${schoolId}/receipts/${paymentId}.pdf`, 3600)

// Never expose permanent URLs for private buckets
// Always generate signed URLs per request
```

### Storage Policy Example

```sql
-- Only school members can access their school's files
CREATE POLICY "school_storage_access"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fee-receipts'
  AND (storage.foldername(name))[1] = auth.school_id()::TEXT
);
```

---

## Audit Logging

### What Gets Logged

| Action | Logged Fields |
|--------|--------------|
| Student created | user_id, student_id, timestamp |
| Student edited | user_id, old_data, new_data, timestamp |
| Fee collected | user_id, student_id, amount, mode, timestamp |
| Fee refunded | user_id, payment_id, reason, timestamp |
| Login | user_id, ip_address, timestamp |
| Exam result published | user_id, exam_id, timestamp |
| User role changed | who changed, old role, new role |
| School suspended | super_admin_id, school_id, reason |

### Audit Log Retention
- Minimum: 2 years
- Stored in `audit_logs` table (append-only — no UPDATE/DELETE in RLS)

---

## Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| GDPR | 🟡 Ready structure | Data isolation, deletion capability |
| Data portability | 🟡 Phase 3 | Export all student data |
| Parental consent | 🔲 Phase 3 | Explicit consent for parent portal |
| SSL/TLS | ✅ | Vercel + Supabase enforce HTTPS |
| Password requirements | ✅ | Supabase Auth handles |
| Right to erasure | 🟡 Phase 3 | Soft delete now, hard delete on request |

---

## Security Testing Checklist

### Pre-Deployment (Every Phase)

- [ ] All RLS tests pass (see `tests/security/rls.test.ts`)
- [ ] No `.env` file committed to Git
- [ ] Service role key never exposed to client bundle
- [ ] All API routes require valid JWT
- [ ] Cross-school data access: returns empty / unauthorized
- [ ] SQL injection: parameterized queries throughout (Supabase SDK)
- [ ] XSS: React/Next.js escapes by default; check dangerouslySetInnerHTML usage
- [ ] CSRF: handled by SameSite cookies
- [ ] Signed URL used for all private file access
- [ ] No PII in URL parameters or query strings
- [ ] Rate limiting tested for auth endpoints
