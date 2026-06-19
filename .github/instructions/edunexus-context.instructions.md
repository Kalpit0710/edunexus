---
description: "Use when implementing EduNexus features, bug fixes, refactors, migrations, tests, or docs updates. Enforces deep project context, phase-aware execution, and context refresh behavior."
name: "EduNexus Deep Context Instruction"
applyTo: "src/**, supabase/**, tests/**, scripts/**, Documentation/**, package.json, playwright.config.ts, vitest.config.ts"
---
# EduNexus Deep Context Instruction

## Read Context Before Coding
For non-trivial work, gather context from these files in this exact order:
1. `Documentation/AI_COLLABORATION_GUIDE.md`
2. `Documentation/PROGRESS.md`
3. `Documentation/DEVELOPMENT_PLAN.md`
4. `Documentation/ARCHITECTURE.md`
5. `Documentation/TESTING_STRATEGY.md`
6. `Documentation/API_DESIGN.md`
7. `Documentation/SECURITY.md`
8. `Documentation/DATABASE_SCHEMA.md`
9. `Documentation/UI_UX_GUIDELINES.md`
10. `Documentation/AI_CONTEXT_SNAPSHOT.md`

## Known Current State (Baseline)
Use this baseline unless code/docs show newer facts. `Documentation/PROGRESS.md` is the authoritative source of truth:
- **Phase 1 COMPLETE** (setup, config, students, teachers, attendance, fee basics, dashboards) — exit gate signed off 2026-06-16.
- **Phase 2 COMPLETE** (examinations, inventory/POS, email notifications, parent portal, advanced analytics) — UI included, exit gate signed off 2026-06-16.
- **QA Audit & Hardening Plan Parts 1–5 DONE**; Part 6 (online payment gateway, SMS/WhatsApp, mobile/PWA) is deferred but **seam-ready** (`src/lib/payments`, `src/lib/notifications`, webhook stub at `src/app/api/payments/webhook`).
- Full test suite is green (217 passing at last check) — always re-verify with `pnpm test`.

## Delivery Rules
- Keep tenant isolation first: preserve `school_id` and RLS guarantees.
- Use UUID keys and soft-delete patterns for key entities.
- Keep business-critical transactional logic in SQL/RPC or server-side atomic units.
- Keep UI, data-access, and domain logic separated by existing project structure.
- Reuse established patterns in `src/lib/{module}` and `src/components/modules/{module}`.

## Testing and Verification Rules
- Always run checks proportional to change scope.
- Preferred command order:
  1. `pnpm type-check`
  2. `pnpm lint`
  3. `pnpm test`
  4. `pnpm test:e2e` (for user-flow changes)
  5. `pnpm build` (for release-level confidence)
- If command names in docs conflict with `package.json`, treat `package.json` as canonical and update docs accordingly.

## Build, Test, Enhance Mode
When asked to improve or enhance the project:
1. Identify module and phase impact.
2. Implement smallest safe change that matches roadmap goals.
3. Add or update tests.
4. Validate with project scripts.
5. Update documentation and progress notes where applicable.

## Context Refresh Requirement
After meaningful code, migration, or documentation changes:
- Run `pnpm ai:sync-context`.
- Ensure `Documentation/AI_CONTEXT_SNAPSHOT.md` reflects latest status.
- If hook execution is unavailable in the running environment, run the command manually before finishing.
