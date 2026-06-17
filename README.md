# EduNexus

> **Connecting Every Layer of School Management.**

EduNexus is a **multi-tenant, web-based School Management System (SaaS)** that digitizes every operational, academic, and financial workflow of a school — from a single, secure, role-based platform.

Built with **Next.js 15**, **React 19**, **TypeScript**, **Supabase (PostgreSQL + RLS)**, and **Tailwind CSS / shadcn/ui**.

---

## ✨ Features

- 🏫 **Multi-tenant** — every school is logically isolated via PostgreSQL Row-Level Security (RLS)
- 👥 **Role-based access** — Super Admin, School Admin, Teacher, Manager/Cashier, and Parent portals
- 🎓 **Student & Teacher management** — admissions, profiles, staff records
- 🗓️ **Attendance** — daily marking, class views, monthly reports, Excel import
- 📝 **Academics & Examinations** — exams, subjects, mark entry, grading, result publishing
- 💰 **Fees & Billing (POS)** — fee collection, pending tracking, payment history, receipts
- 📦 **Bookstore & Inventory** — stock management and point-of-sale (Manager role)
- 📊 **Reports & Analytics** — dashboards and insights
- 🛡️ **Super Admin platform** — school provisioning, subscriptions, audited impersonation, plan pricing, global audit log
- 💳 **Subscription tiers** — Basic / Standard / Premium plans gate which modules a school can access
- 📧 **Transactional email** — fee reminders, receipts, exam notifications (React Email + Resend)

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Auth | Supabase Auth (JWT, role-based) |
| Data / State | TanStack Query · Zustand |
| UI | Tailwind CSS · shadcn/ui (Radix) · lucide-react · Framer Motion |
| Forms / Validation | React Hook Form · Zod |
| Email | React Email · Resend |
| Charts / Sheets | Recharts · SheetJS (xlsx) |
| Testing | Vitest · Testing Library · Playwright |

---

## 👤 User Roles

```
EduNexus
├── Super Admin   → Manages all schools, subscriptions, pricing, audit, impersonation
├── School Admin  → Full school control (students, teachers, attendance, exams, fees, reports, settings)
├── Teacher       → Attendance and exams
├── Manager       → Bookstore inventory & point of sale
└── Parent        → Child progress, attendance, fees, results
```

## 💳 Subscription Plans

Module access is gated by each school's subscription plan (configurable by the Super Admin):

| Plan | Unlocked modules |
|---|---|
| **Basic** | Students, Attendance (+ Dashboard & Settings) |
| **Standard** | Basic **+** Teachers, Fees & Billing, Exams |
| **Premium** | Standard **+** Reports & Analytics, Communication, Inventory, Parent Portal |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** (recommended)
- A **Supabase** project (URL, anon key, service-role key)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Optional: transactional email
RESEND_API_KEY=your-resend-key
```

### 3. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📜 Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` / `pnpm lint:fix` | Lint (and auto-fix) |
| `pnpm type-check` | TypeScript type checking |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:coverage` | Unit tests with coverage |
| `pnpm test:e2e` | End-to-end tests (Playwright) |
| `pnpm db:types` | Generate Supabase TypeScript types |
| `pnpm ai:sync-context` | Refresh the AI context snapshot |

---

## 🗂️ Project Structure

```
src/
├── app/                  # Next.js App Router (route groups per role)
│   ├── (super-admin)/    # Platform admin portal
│   ├── (school-admin)/   # School admin portal
│   ├── (teacher)/        # Teacher portal
│   ├── (manager)/        # Inventory / POS portal
│   ├── (parent)/         # Parent portal
│   ├── (auth)/           # Login & account flows
│   └── api/              # Route handlers
├── components/           # UI, modules, shared, loaders
├── lib/                  # Domain logic (per module), Supabase clients, utils
├── hooks/                # Reusable React hooks
├── stores/               # Zustand stores
├── emails/               # React Email templates
└── types/                # Shared & generated DB types
supabase/
├── migrations/           # SQL migrations
└── functions/            # Edge Functions
tests/                    # unit · integration · e2e
Documentation/            # Architecture, modules, phases, and design docs
```

---

## 🔒 Security & Architecture Notes

- Tenant isolation is enforced with **Row-Level Security** — never disabled in migrations or runtime SQL.
- Tables use **UUID** primary keys; critical entities avoid hard deletes.
- Service-role keys are **server-only** and never exposed to the client.
- Business-critical flows favor atomic PostgreSQL functions / RPCs.

---

## 🧪 Testing

```bash
pnpm test          # unit
pnpm test:coverage # unit + coverage
pnpm test:e2e      # Playwright end-to-end
```

---

## 📚 Documentation

Detailed design docs live in [`Documentation/`](Documentation/):

- [Architecture](Documentation/ARCHITECTURE.md)
- [Database Schema](Documentation/DATABASE_SCHEMA.md)
- [API Design](Documentation/API_DESIGN.md)
- [Security](Documentation/SECURITY.md)
- [UI/UX Guidelines](Documentation/UI_UX_GUIDELINES.md)
- [Testing Strategy](Documentation/TESTING_STRATEGY.md)
- [Development Plan](Documentation/DEVELOPMENT_PLAN.md) · [Progress](Documentation/PROGRESS.md)
- [Module specs](Documentation/modules/) · [Phases](Documentation/phases/)

---

## 📄 License

Private / proprietary. All rights reserved.
