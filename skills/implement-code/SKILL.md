You are about to implement code. Before writing a single line, you must read and internalise the standards gates.

## Step 1 — Read Gates

Read all of the following files in full:

1. `~/.claude/gates/coding-standards.md`
2. `~/.claude/gates/frontend-patterns.md`
3. `~/.claude/gates/backend-patterns.md`
4. `~/.claude/gates/security-patterns.md`

Read all four regardless of what is being implemented — standards and security apply universally, and most features touch both frontend and backend.

## Step 2 — Understand the Request

Before planning anything, confirm your understanding of:
- What is being built
- Where it lives in the project structure (`app/`, `components/`, `server/`, `stores/`, etc.)
- Whether it is frontend, backend, or both

## Step 3 — Plan Before You Code

Briefly outline your implementation approach:
- Files to create or modify
- Types needed (local vs shared in `types/`)
- State ownership (Zustand, tRPC, RHF, or useState)
- Any security considerations

Do not skip this step. Do not write code yet.

## Step 4 — Implement

Now write the code. Every file you produce must comply with the gates. Use this as your checklist before outputting each file:

**TypeScript**
- [ ] `type` not `interface` (unless extending or merging)
- [ ] No `any` types anywhere
- [ ] No `@ts-ignore` comments
- [ ] Every function has an explicit return type

**Functions & Style**
- [ ] Arrow functions only — no `function` keyword
- [ ] One-line if/else/for/while omit curly braces
- [ ] `camelCase` variables and functions
- [ ] `PascalCase` components
- [ ] `SCREAMING_SNAKE_CASE` constants

**File Structure**
- [ ] Order: imports → types → logic → render
- [ ] No unused imports, variables, or functions
- [ ] Near-zero comments — only where code cannot convey intent

**Components**
- [ ] Every component has explicit TypeScript props type
- [ ] Parent owns logic and orchestration
- [ ] Sub-components own rendering of a single concern
- [ ] Sub-components live in a directory named after the parent
- [ ] No god components (10+ props)
- [ ] No oversized render blocks — extract named sub-components
- [ ] No prop drilling 3+ levels

**Types**
- [ ] Types used by one component defined locally, never exported
- [ ] Types shared across 2+ components live in `types/`
- [ ] No duplicate type definitions

**State**
- [ ] Forms use React Hook Form — not useState, not Zustand
- [ ] Multi-step wizards use a single RHF instance at parent level
- [ ] Client-side form validation uses Zod
- [ ] Shared/cross-component/persistent state uses Zustand
- [ ] Single-component UI state uses useState
- [ ] tRPC data is not mirrored into Zustand

**Security**
- [ ] No hardcoded secrets
- [ ] User inputs validated with Zod schemas
- [ ] No `any` casts that bypass validation
- [ ] Auth checks present on protected routes/procedures

## Step 5 — Self-Review

After writing all code, re-read each file against the checklist above. Fix any violations before presenting the output. Do not ask the user to fix things you can resolve yourself.
