---
name: "EduNexus Sync Context"
description: "Regenerate Documentation/AI_CONTEXT_SNAPSHOT.md so the model context reflects the latest code, docs, tests, and git state."
agent: "edunexus-engineer"
argument-hint: "Optional focus area (for example: exams module or inventory module)"
---
Refresh project context now.

Steps:
1. Run `pnpm ai:sync-context`.
2. Open `Documentation/AI_CONTEXT_SNAPSHOT.md` and verify generation timestamp and key sections updated.
3. If a focus area was provided by the user, ensure that area is mentioned in the snapshot notes.
4. Report what changed in the snapshot.
