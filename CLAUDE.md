# Global Claude Instructions

## Stack

All projects are built with:
- **Next.js** (App Router) + **TypeScript** — strict, no any, no @ts-ignore
- **tRPC** — for all client-server communication
- **Zustand** — for shared/cross-component/persistent state
- **React Hook Form** + **Zod** — for all forms and client-side validation
- **Tailwind CSS** — for all styling


## Gates

Detailed patterns and standards live in `~/.claude/gates/`. Before writing any code, always read:

1. `~/.claude/gates/coding-standards.md`
2. `~/.claude/gates/frontend-patterns.md`
3. `~/.claude/gates/backend-patterns.md`
4. `~/.claude/gates/security-patterns.md`

Do this even if the `/implement-code` skill is not explicitly invoked. The `/implement-code` and `/review-code` skills provide additional structure but the gates apply to all code written in every session.

## General

- Be concise — no filler, no preamble, no trailing summaries
- Don't add features, comments, error handling, or abstractions beyond what was asked
