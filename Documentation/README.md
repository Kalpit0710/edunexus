# EduNexus
## "Connecting Every Layer of School Management."

> **Version:** 1.0.0-planning  
> **Status:** Pre-development — Documentation & Planning Phase  
> **Last Updated:** 2026-02-27  
> **Owner:** EduNexus Team

---

## Table of Contents

1. [What is EduNexus?](#what-is-edunexus)
2. [Core Philosophy](#core-philosophy)
3. [Technology Stack](#technology-stack)
4. [User Roles at a Glance](#user-roles-at-a-glance)
5. [Module Overview](#module-overview)
6. [Phased Implementation Summary](#phased-implementation-summary)
7. [Documentation Index](#documentation-index)
8. [Getting Started (Dev Setup)](#getting-started-dev-setup)
9. [For AI Assistants](#for-ai-assistants)
10. [Project Status](#project-status)

---

## What is EduNexus?

EduNexus is a **multi-tenant, web-based, end-to-end School Management System (SMS)** built as a SaaS product. It is designed to digitize and streamline every operational, academic, and financial workflow within a school — all from a single unified platform.

It covers:
- Academic management (classes, attendance, exams, results)
- Financial & fee management with Point-of-Sale (POS) capabilities
- Teacher & performance management
- Parent engagement & transparency portal
- Inventory & bookstore management
- Reports, dashboards & analytics
- Secure role-based access control (RBAC)

EduNexus is **not** just a fee system. It is **not** just an ERP. It is a **complete digital operating system for schools**.

---

## Core Philosophy

| Principle | Description |
|-----------|-------------|
| **Security First** | Every piece of data is school-isolated via Row-Level Security |
| **Non-Tech Friendly** | Designed for principals, teachers, and parents — not developers |
| **Minimal UI** | Clean, guided, large-button interfaces with no clutter |
| **Multi-Tenant** | Each school is logically isolated but shares the same infrastructure |
| **Future-Ready** | Architecture designed for PWA → Mobile App expansion |
| **Scalable** | Built to support 100+ schools from day one |

---

## Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| **Frontend** | Next.js 14+ (React) | SSR, file-based routing, excellent DX |
| **Backend** | Supabase (PostgreSQL + Edge Functions) | Batteries-included BaaS, RLS built-in |
| **Auth** | Supabase Auth (Email/Password + Google OAuth) | Secure JWT, easy role mapping |
| **Database** | PostgreSQL (via Supabase) | Relational, battle-tested, RLS support |
| **Storage** | Supabase Storage | File uploads, PDFs, logos, photos |
| **Email** | SMTP / Resend | Fee reminders, notifications |
| **PDF Generation** | Edge Functions (server-side) | Receipts, report cards |
| **Deployment** | Vercel (Frontend) + Supabase Cloud (Backend) | Managed, auto-scaling |
| **Styling** | Tailwind CSS + shadcn/ui | Fast, consistent, accessible UI |
| **State Management** | Zustand / React Query | Lightweight, server-state friendly |
| **Testing** | Vitest + Playwright + Supabase local | Unit + E2E coverage |

---

## User Roles at a Glance

```
EduNexus
├── Super Admin          → Manages all schools, subscriptions, global audit
├── School Admin         → Full school control (principal / manager)
│   ├── Teachers         → Attendance, marks, announcements
│   ├── Managers         → POS, fee collection, inventory
│   └── Parents          → Read-only: attendance, results, fee, timetable
```

Full permissions matrix: see [SECURITY.md](./SECURITY.md)

---

## Module Overview

| # | Module | Key Features |
|---|--------|-------------|
| 1 | School Configuration | Branding, academic year, grading, policy |
| 2 | Student Management | CRUD, bulk upload, ID generation, admission |
| 3 | Teacher Management | CRUD, class assignment, performance tracking |
| 4 | Attendance | Daily marking, bulk, parent alerts, reports |
| 5 | Academics & Exams | Exam creation, marks entry, report cards, grading |
| 6 | Fee & Billing (POS) | Fee structures, installments, receipts, refunds |
| 7 | Bookstore & Inventory | Stock management, POS billing, low-stock alerts |
| 8 | Communication | Announcements, email notifications, reminders |
| 9 | Dashboard & Reports | Role-specific dashboards, analytics, exports |
| 10 | Parent Portal | Attendance, results, fees, timetable |

Detailed specs: [`modules/`](./modules/)

---

## Phased Implementation Summary

| Phase | Duration | Focus | Goal |
|-------|----------|-------|------|
| **Phase 1 — MVP** | 3 months | Core operations | 5 schools onboarded |
| **Phase 2 — Advanced** | 2 months | Exams, POS, analytics | Fully operational ERP |
| **Phase 3 — Scale** | 2 months | AI, automation, PWA | Smart, self-managing |
| **Phase 4 — Mobile** | TBD | React Native apps | Full mobile expansion |

Full breakdown: see [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | This file — project overview |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture, data flow, scalability |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | All tables, columns, relationships, RLS policies |
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | Phased plan with tasks, milestones, acceptance criteria |
| [API_DESIGN.md](./API_DESIGN.md) | API patterns, Supabase query conventions, Edge Functions |
| [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md) | Design system, wireframes, component library |
| [SECURITY.md](./SECURITY.md) | RBAC, RLS policies, auth flow, compliance |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | Unit, integration, E2E, database testing |
| [AI_COLLABORATION_GUIDE.md](./AI_COLLABORATION_GUIDE.md) | **Read this first if you are an AI assistant** |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Git workflow, PR process, code standards |
| [EXTENSIONS.md](./EXTENSIONS.md) | Recommended VS Code extensions |
| [modules/](./modules/) | Per-module feature specs |
| [phases/](./phases/) | Per-phase detailed task breakdowns |

---

## Getting Started (Dev Setup)

> Full setup guide in [CONTRIBUTING.md](./CONTRIBUTING.md). Quick summary below.

### Prerequisites
- Node.js 20+
- pnpm 8+
- Supabase CLI
- Docker Desktop (for local Supabase)
- Git

### Initial Setup
```bash
# Clone the repo
git clone https://github.com/your-org/edunexus.git
cd edunexus

# Install dependencies
pnpm install

# Start local Supabase
supabase start

# Copy environment variables
cp .env.example .env.local

# Run migrations
supabase db push

# Start development server
pnpm dev
```

---

## For AI Assistants

> If you are an AI assistant (GitHub Copilot, Claude, GPT, etc.) helping with this project, **read [`AI_COLLABORATION_GUIDE.md`](./AI_COLLABORATION_GUIDE.md) first**. It contains:
> - Project context summary
> - Architecture decisions and rationale
> - Coding conventions
> - What NOT to change without discussion
> - Module ownership map
> - Testing requirements

---

## Project Status

| Item | Status |
|------|--------|
| Documentation | ✅ Complete |
| Database Schema Design | ✅ Complete |
| Phase 1 Task Breakdown | ✅ Complete |
| Repository Setup | 🔲 Pending |
| Phase 1 Development | 🔲 Pending |
| Phase 2 Development | 🔲 Pending |
| Phase 3 Development | 🔲 Pending |
| Phase 4 (Mobile) | 🔲 Future |

---

*EduNexus — Built for schools. Designed for people. Scaled for the future.*
