---
name: "EduNexus Build Test Enhance"
description: "Use to implement a feature/fix or enhancement, then run build/test validation and refresh project context snapshot."
agent: "edunexus-engineer"
argument-hint: "Feature/fix/enhancement objective"
---
Implement the requested EduNexus objective using project conventions and documentation constraints.

Execution requirements:
1. Identify impacted phase/milestone from `Documentation/PROGRESS.md` and `Documentation/DEVELOPMENT_PLAN.md`.
2. Implement the change in the smallest safe scope.
3. Add or update tests for changed behavior.
4. Run relevant validation commands from `package.json`.
5. Update affected documentation files when behavior or architecture meaning changed.
6. Run `pnpm ai:sync-context` and include snapshot updates in the result.

Response format:
- Scope and phase impact
- Code changes
- Test/build results
- Documentation updates
- Context snapshot refresh result
