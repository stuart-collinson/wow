## Which gates apply

Paths are relative to the gate root.

- Every task: coding-standards.md, security-patterns.md
- Frontend task: also frontend-patterns.md and tanstack-query.md
- Backend task (tRPC procedures, server code): also backend-patterns.md
- Touches both: all five

tanstack-query owns server state on the frontend — the per-domain `hooks/`
layout, query keys, stale times, mutations, invalidation, prefetch. Apply it
whenever a frontend task touches server data.

Heavier security audits can be delegated to the `security-reviewer` agent.
