# EduNexus Copilot Workspace Instructions

Use these instructions for every coding task in this repository.

## Mission
- Build, test, and improve EduNexus as a secure multi-tenant school management SaaS.
- Preserve tenant isolation, role boundaries, and production safety.
- Keep implementation aligned with project documentation and current phase goals.

## Primary Knowledge Sources
Before substantial implementation work, read these in order and use them as source of truth:
1. `Documentation/AI_COLLABORATION_GUIDE.md`
2. `Documentation/PROGRESS.md`
3. `Documentation/DEVELOPMENT_PLAN.md`
4. `Documentation/ARCHITECTURE.md`
5. `Documentation/TESTING_STRATEGY.md`
6. `Documentation/API_DESIGN.md`
7. `Documentation/UI_UX_GUIDELINES.md`
8. `Documentation/SECURITY.md`
9. `Documentation/DATABASE_SCHEMA.md`
10. `Documentation/AI_CONTEXT_SNAPSHOT.md` (generated context digest)

## Current Project Reality
- This repository is in active development, not pure planning.
- Progress currently indicates:
  - Phase 1 setup/config/student work marked complete.
  - Phase 2.1 and 2.2 backend foundation complete.
  - Phase 2 UI and formal Phase 1 exit gate still pending.
- If docs conflict, treat `Documentation/PROGRESS.md` plus runnable code/tests as highest confidence for current state, then update docs where needed.

## Non-Negotiable Architecture Rules
- Never break multi-tenant isolation: tenant tables require `school_id` and RLS.
- Never disable RLS in migrations or runtime SQL.
- Use UUID primary keys, not serial IDs.
- Avoid hard delete for critical entities (students, teachers, payments).
- Do not expose service role keys in client code.
- Prefer atomic RPC/PostgreSQL function flows for critical business transactions.

## Implementation Workflow
For feature, fix, refactor, and enhancement tasks:
1. Confirm relevant phase/milestone impact from `Documentation/PROGRESS.md` and `Documentation/DEVELOPMENT_PLAN.md`.
2. Reuse existing patterns in `src/lib`, `src/components/modules`, `src/app`, and `supabase/migrations`.
3. Keep logic layered:
   - UI in `src/app` and `src/components`
   - Data/query/mutation logic in `src/lib/{module}`
   - DB business-critical operations in RPC/functions/migrations
4. Add or update tests in `tests/unit`, `tests/integration`, `tests/e2e`, and security tests when RLS/policies change.
5. Run verification commands before concluding work.
6. Update documentation when behavior, schema, API, or workflow changes.
7. Refresh project context snapshot by running `pnpm ai:sync-context`.

## Build, Test, and Validation Commands
Use the scripts from `package.json` as canonical runnable commands:
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm lint:fix`
- `pnpm type-check`
- `pnpm test`
- `pnpm test:coverage`
- `pnpm test:e2e`
- `pnpm ai:sync-context`

If documentation mentions commands that do not exist in `package.json`, prefer `package.json` and propose a docs correction.

## Coding Conventions
- TypeScript strict mode, no `any` unless unavoidable and justified.
- Use Zod for external input validation.
- Prefer server components for initial data load and client components only when needed.
- Always implement loading, error, and empty states for data UIs.
- Keep naming/style consistent with existing codebase patterns.

## Change Hygiene
- Make focused, minimal changes.
- Do not reformat unrelated files.
- Do not alter generated shadcn base components unless required.
- Do not modify architecture invariants without explicit discussion.

## Context Freshness Requirement
- After significant code edits, migration changes, or test additions, regenerate `Documentation/AI_CONTEXT_SNAPSHOT.md` using `pnpm ai:sync-context`.
- Include that snapshot update in related commits so future model sessions have up-to-date project context.
