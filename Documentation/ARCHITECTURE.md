# EduNexus — Technical Architecture

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27  
> **Audience:** Developers, AI Assistants, Technical Reviewers

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Model](#architecture-model)
3. [High-Level Architecture Diagram](#high-level-architecture-diagram)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture (Supabase)](#backend-architecture-supabase)
6. [Multi-Tenant Design](#multi-tenant-design)
7. [Authentication & Session Flow](#authentication--session-flow)
8. [Data Flow Diagrams](#data-flow-diagrams)
9. [Edge Functions Design](#edge-functions-design)
10. [File Storage Architecture](#file-storage-architecture)
11. [Email & Notifications](#email--notifications)
12. [Scalability Plan](#scalability-plan)
13. [Performance Optimizations](#performance-optimizations)
14. [Backup & Recovery](#backup--recovery)
15. [Architecture Decision Records (ADRs)](#architecture-decision-records-adrs)

---

## System Overview

EduNexus follows a **BaaS (Backend-as-a-Service) + SSR Frontend** architecture:

- **Next.js** renders pages server-side (SSR/ISR) for performance and SEO
- **Supabase** handles database, auth, storage, and realtime
- **Edge Functions** (Deno) handle compute-heavy, scheduled, and secure operations
- All school data is **logically isolated** via PostgreSQL Row-Level Security (RLS)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│   Browser (Next.js SSR) + PWA Shell + Future React Native       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / JWT
┌──────────────────────────▼──────────────────────────────────────┐
│                   SUPABASE AUTH GATEWAY                         │
│        JWT Token Validation + Role Resolution                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────────────┐
          │                │                        │
┌─────────▼───────┐ ┌──────▼──────┐ ┌─────────────▼──────────┐
│  PostgreSQL DB  │ │  Supabase   │ │   Supabase Storage     │
│  (RLS Enabled)  │ │  Edge Fns   │ │   (Logos, PDFs, Photos)│
│  PostgREST API  │ │  (Deno)     │ └────────────────────────┘
└─────────────────┘ └──────┬──────┘
                           │
                  ┌────────▼────────┐
                  │  Email Service  │
                  │  (SMTP/Resend)  │
                  └─────────────────┘
```

---

## Architecture Model

### Multi-Tenant SaaS (Shared Infrastructure, Isolated Data)

EduNexus uses the **shared schema with tenant discriminator** pattern:

- All schools share the **same PostgreSQL database and tables**
- Every table includes a `school_id UUID` column
- **Row-Level Security (RLS)** policies enforce that each school only sees its own data
- Each school gets:
  - Unique subdomain (optional Phase 3): `schoolname.edunexus.app`
  - Custom branding (logo, theme color)
  - Independent configuration (fee schedules, grading rules, academic year)

### Why Shared Schema over Separate DBs?
| Factor | Shared Schema | Separate DB per School |
|--------|--------------|----------------------|
| Cost at scale | ✅ Low | ❌ High |
| Maintenance | ✅ Single migration | ❌ N migrations |
| Cross-school analytics | ✅ Easy | ❌ Complex |
| Isolation | ✅ RLS enforced | ✅ Physical |
| Complexity | Medium | High |

→ **Decision:** Shared schema with RLS. Revisit at 500+ schools.

---

## High-Level Architecture Diagram

```
Users
 ├── Super Admin
 ├── School Admin
 ├── Teacher
 ├── Manager / Cashier
 └── Parent
       │
       │  HTTPS
       ▼
┌─────────────────────────────────────────────┐
│            Next.js 14 Frontend              │
│  ┌────────────────────────────────────────┐ │
│  │   App Router (src/app/)                │ │
│  │   ┌──────────┐ ┌───────────────────┐   │ │
│  │   │  Pages   │ │  Server Components│   │ │
│  │   │  /login  │ │  (data fetching)  │   │ │
│  │   │  /admin  │ └───────────────────┘   │ │
│  │   │  /teacher│ ┌───────────────────┐   │ │
│  │   │  /parent │ │  Client Components│   │ │
│  │   └──────────┘ │  (interactivity)  │   │ │
│  │                └───────────────────┘   │ │
│  │   ┌─────────────────────────────────┐  │ │
│  │   │  Supabase Client (anon/service) │  │ │
│  │   └─────────────────────────────────┘  │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
       │
       │  PostgREST / Edge Functions
       ▼
┌─────────────────────────────────────────────┐
│              Supabase Platform              │
│                                             │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │  Auth        │    │  PostgreSQL DB    │  │
│  │  (JWT+OAuth) │    │  ┌─────────────┐  │  │
│  └──────────────┘    │  │ RLS Policies│  │  │
│                      │  └─────────────┘  │  │
│  ┌──────────────┐    │  ┌─────────────┐  │  │
│  │  Storage     │    │  │  Functions  │  │  │
│  │  (S3-like)   │    │  │  (SQL Fns)  │  │  │
│  └──────────────┘    │  └─────────────┘  │  │
│                      └───────────────────┘  │
│  ┌──────────────────────────────────────┐   │
│  │  Edge Functions (Deno Runtime)       │   │
│  │  - PDF generation                    │   │
│  │  - Email dispatch                    │   │
│  │  - Cron jobs (late fees)             │   │
│  │  - Bulk validation                   │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│          External Services                   │
│  Resend (Email)  |  Vercel (Hosting)         │
└──────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Directory Structure

```
edunexus/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth group (login, reset)
│   │   │   ├── login/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (super-admin)/            # Super Admin panel
│   │   │   └── dashboard/page.tsx
│   │   ├── (school-admin)/           # School Admin panel
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── students/page.tsx
│   │   │   ├── teachers/page.tsx
│   │   │   ├── fees/page.tsx
│   │   │   ├── attendance/page.tsx
│   │   │   ├── exams/page.tsx
│   │   │   ├── inventory/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (teacher)/
│   │   ├── (manager)/
│   │   ├── (parent)/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                       # shadcn/ui base components
│   │   ├── shared/                   # Shared across roles
│   │   │   ├── Sidebar.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── ConfirmModal.tsx
│   │   │   └── ExcelUpload.tsx
│   │   └── modules/                  # Module-specific components
│   │       ├── students/
│   │       ├── fees/
│   │       ├── attendance/
│   │       └── ...
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server-side client
│   │   │   └── middleware.ts         # Session refresh
│   │   ├── utils.ts
│   │   ├── constants.ts
│   │   └── validations/              # Zod schemas
│   ├── hooks/                        # Custom React hooks
│   ├── stores/                       # Zustand stores
│   ├── types/                        # TypeScript types (generated + custom)
│   └── styles/
│       └── globals.css
├── supabase/
│   ├── migrations/                   # SQL migration files
│   ├── functions/                    # Edge Functions
│   │   ├── generate-pdf/
│   │   ├── send-email/
│   │   └── process-late-fees/
│   └── seed/                         # Seed data for development
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                          # Playwright tests
└── docs/                             # Links back to Documentation/
```

### State Management Strategy

| Type | Solution | Use Case |
|------|----------|---------|
| Server state | React Query (TanStack) | All Supabase data fetching |
| Global UI state | Zustand | Auth context, school context, sidebar |
| Form state | React Hook Form + Zod | All forms |
| UI Animation State | Framer Motion | Page transitions, complex micro-interactions, layout animations |
| URL state | Next.js searchParams | Filters, pagination |

### Data Fetching Pattern

```typescript
// Server Component (preferred for initial load)
// src/app/(school-admin)/students/page.tsx
import { createServerClient } from '@/lib/supabase/server'

export default async function StudentsPage() {
  const supabase = createServerClient()
  const { data: students } = await supabase
    .from('students')
    .select('*, classes(*), parents(*)')
    .order('created_at', { ascending: false })

  return <StudentTable initialData={students} />
}
```

```typescript
// Client Component (for interactivity / mutations)
// src/components/modules/students/StudentTable.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'

export function StudentTable({ initialData }) {
  const supabase = createBrowserClient()
  const { data } = useQuery({
    queryKey: ['students'],
    queryFn: () => supabase.from('students').select('*'),
    initialData,
  })
  // ...
}
```

---

## Backend Architecture (Supabase)

### Supabase Services Used

| Service | Usage |
|---------|-------|
| **PostgreSQL** | Primary database, all business data |
| **PostgREST** | Auto-generated REST API from schema |
| **Supabase Auth** | JWT auth, Google OAuth, role metadata |
| **Realtime** | Live attendance updates, notifications (Phase 2) |
| **Storage** | Logos, student photos, PDFs, Excel uploads |
| **Edge Functions** | Compute tasks: PDF, email, cron, validation |

### Database Function Pattern

All business logic that requires atomicity lives in **PostgreSQL functions** (not application code):

```sql
-- Example: collect_fee function ensures payment + ledger entry are atomic
CREATE OR REPLACE FUNCTION collect_fee(
  p_student_id UUID,
  p_amount DECIMAL,
  p_payment_mode TEXT,
  p_fee_items JSONB
)
RETURNS UUID  -- returns payment_id
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  -- Insert payment record
  INSERT INTO payments (...) VALUES (...) RETURNING id INTO v_payment_id;
  
  -- Update fee installment status
  UPDATE fee_installments SET status = 'paid' WHERE ...;
  
  -- Insert audit log
  INSERT INTO audit_logs (...) VALUES (...);
  
  RETURN v_payment_id;
END;
$$;
```

---

## Multi-Tenant Design

### Tenant Isolation via RLS

Every table follows this pattern:

```sql
-- 1. Column added to every tenant-scoped table
ALTER TABLE students ADD COLUMN school_id UUID NOT NULL REFERENCES schools(id);

-- 2. RLS enabled
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 3. Policy: users only see rows for their school
CREATE POLICY "school_isolation" ON students
  FOR ALL
  USING (school_id = auth.jwt() ->> 'school_id')::uuid);
```

### JWT Claims Extension

```sql
-- Custom claim added at login via Auth hook
-- This puts school_id and role into every JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  claims JSONB;
  user_role TEXT;
  user_school_id UUID;
BEGIN
  SELECT role, school_id INTO user_role, user_school_id
  FROM public.users WHERE id = (event->>'user_id')::UUID;
  
  claims := event->'claims';
  claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  claims := jsonb_set(claims, '{school_id}', to_jsonb(user_school_id::text));
  
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

### Tenant Context in Application

```typescript
// src/stores/schoolStore.ts
interface SchoolStore {
  schoolId: string
  schoolName: string
  logo: string
  theme: SchoolTheme
  role: UserRole
}
```

---

## Authentication & Session Flow

```
1. User visits /login
2. Enters email + password (or clicks Google)
3. Supabase Auth validates credentials
4. Auth hook fires → injects {role, school_id} into JWT claims
5. JWT stored in httpOnly cookie (Next.js middleware manages)
6. Middleware checks JWT on every request:
   - Valid → allow through to role-specific layout
   - Expired → refresh via Supabase session refresh
   - Invalid → redirect to /login
7. Role-based UI rendered (Super Admin / School Admin / Teacher / Manager / Parent)
```

### Session Expiry
- JWT expiry: **1 hour**
- Refresh token: **30 days**
- Auto-refresh handled by Supabase client SDK
- Inactivity timeout: **8 hours** (configurable per school)

---

## Data Flow Diagrams

### Fee Collection Flow

```
Manager selects student
      ↓
Fetch student fee structure (Supabase query with RLS)
      ↓
Display fee breakdown (tuition, transport, late fees, discounts)
      ↓
Manager enters payment mode (Cash / UPI / Card)
      ↓
POST to collect_fee() PostgreSQL function
      ↓
Atomic transaction:
  ├── INSERT payments record
  ├── UPDATE fee_installments (mark paid)
  ├── INSERT audit_log entry
  └── RETURN payment_id
      ↓
Trigger Edge Function: generate-pdf
      ↓
PDF receipt stored in Supabase Storage
      ↓
Signed URL returned → Download / Print
      ↓
Optional: send email receipt via Resend
```

### Attendance Flow

```
Teacher opens class attendance view
      ↓
Load students for class/section/date
      ↓
Mark each student: Present / Absent / Late
      ↓
Bulk UPSERT to attendance table
      ↓
Realtime update → Admin dashboard attendance count
      ↓
Evening cron job (Edge Function):
  ├── Find all absent students
  ├── Fetch parent email
  └── Send absence notification via Resend
```

---

## Edge Functions Design

Edge Functions run on Deno and are deployed via `supabase functions deploy`.

| Function | Trigger | Purpose |
|----------|---------|---------|
| `generate-pdf` | HTTP POST | Generate fee receipts, report cards |
| `send-email` | HTTP POST | Dispatch emails via Resend |
| `process-late-fees` | Cron (daily 1 AM) | Apply late fee charges automatically |
| `validate-excel` | HTTP POST | Validate bulk upload files |
| `fee-reminder` | Cron (configurable) | Send fee due reminder emails |

### Edge Function Structure

```
supabase/functions/
├── generate-pdf/
│   ├── index.ts          # Handler
│   ├── templates/
│   │   ├── receipt.html  # Receipt template
│   │   └── report-card.html
│   └── deno.json
├── send-email/
│   └── index.ts
└── process-late-fees/
    └── index.ts
```

---

## File Storage Architecture

### Storage Buckets

| Bucket | Privacy | Contents | Access |
|--------|---------|----------|--------|
| `school-logos` | Public | School branding logos | Anyone |
| `student-photos` | Private | Student profile photos | Authenticated (same school) |
| `report-cards` | Private | Generated PDF report cards | Student's parent + admin |
| `fee-receipts` | Private | Generated fee receipt PDFs | Payer + admin |
| `excel-uploads` | Private | Bulk upload temp files | Admin only (auto-deleted after 24h) |

### File Naming Convention

```
{school_id}/{entity}/{entity_id}/{filename}_{timestamp}.{ext}

Examples:
  abc123/students/stud456/photo_2025.jpg
  abc123/receipts/pay789/receipt_20250315_143022.pdf
  abc123/report-cards/stud456/2024-2025_term1.pdf
```

---

## Email & Notifications

### Email Provider: Resend

All emails sent via `send-email` Edge Function:

```typescript
// supabase/functions/send-email/index.ts
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

// Email types
type EmailType = 
  | 'fee_receipt'
  | 'fee_reminder' 
  | 'attendance_alert'
  | 'exam_notification'
  | 'result_published'
  | 'announcement'
```

### Notification Events

| Event | Recipient | Trigger |
|-------|-----------|---------|
| Student absent | Parent | Daily cron, post attendance |
| Fee due reminder | Parent | Cron (configurable per school) |
| Fee receipt | Parent | After payment |
| Exam announced | Parent + Student | Teacher creates exam |
| Results published | Parent | Admin publishes results |
| General announcement | Class / school | Teacher / Admin creates |

---

## Scalability Plan

### Phase 1 (MVP — Up to 20 schools)
- Single Supabase project instance
- Vercel hobby/pro plan
- All on shared infra

### Phase 2 (Growth — 20–100 schools)
- Enable Supabase **read replicas** for reporting queries
- Add **Redis caching** (Upstash) for frequent reads (school config, class lists)
- Enable **Vercel Edge Caching** for public assets
- Add background job queue for heavy operations

### Phase 3 (Scale — 100+ schools)
- Evaluate **Supabase Pro** with connection pooling (PgBouncer)
- Separate billing/financial microservice
- CDN for all static assets
- Horizontal scaling of Edge Functions
- Dedicated Supabase project per region (EU/India/etc.)

---

## Performance Optimizations

### Database Level
```sql
-- Indexes on all multi-tenant queries
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_attendance_school_date ON attendance(school_id, date);
CREATE INDEX idx_payments_school_student ON payments(school_id, student_id);

-- Materialized views for heavy reports
CREATE MATERIALIZED VIEW mv_school_fee_summary AS
SELECT school_id, 
       SUM(amount) as total_collected,
       COUNT(DISTINCT student_id) as students_paid
FROM payments
WHERE status = 'completed'
GROUP BY school_id;

-- Refresh strategy: on payment insert, or scheduled every 15 min
```

### Frontend Level
- React Query with `staleTime: 5 * 60 * 1000` (5 min) for stable data
- Pagination everywhere (default 20–50 rows)
- Debounced search (300ms delay)
- Next.js `loading.tsx` for skeleton states
- Image optimization via Next.js Image component

---

## Backup & Recovery

| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Supabase automatic backup | Daily | 7 days (Pro: 30) | Supabase managed |
| Point-in-time recovery | Continuous | 7 days | Supabase Pro |
| Manual backup | Weekly | 90 days | SQL dump to S3 |
| Restore testing | Quarterly | — | Restore to staging |

---

## Architecture Decision Records (ADRs)

### ADR-001: Supabase as BaaS over custom Express backend
- **Decision:** Use Supabase
- **Reason:** RLS built-in, auth ready, storage included, reduces backend code by ~70%
- **Trade-off:** Less flexibility for complex business logic → mitigated with PostgreSQL functions

### ADR-002: Next.js App Router over Pages Router
- **Decision:** App Router (Next.js 14+)
- **Reason:** Server Components reduce client bundle, better data fetching patterns
- **Trade-off:** Newer paradigm, more complex mental model

### ADR-003: Shared DB schema over per-tenant DB
- **Decision:** Shared schema with RLS
- **Reason:** Cost-efficient, single migration path, easier analytics
- **Trade-off:** Requires rigorous RLS testing; reviewed at 500+ schools

### ADR-004: Tailwind + shadcn/ui + Framer Motion for styling
- **Decision:** Tailwind CSS + shadcn/ui + framer-motion
- **Reason:** Accessible, customizable, fast prototyping, modern and soft aesthetics, dynamic micro-interactions
- **Trade-off:** Verbose class names and extra bundle size → mitigated with consistent component library and dynamic imports where necessary

### ADR-005: PDF generation server-side via Edge Functions
- **Decision:** Server-side PDF (not client-side jsPDF)
- **Reason:** Consistent output, school branding, secure data handling
- **Trade-off:** Latency → mitigated with async generation + stored result
