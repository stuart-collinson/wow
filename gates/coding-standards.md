# Coding Standards & Best Practices

Universal coding standards for Next.js / TypeScript projects. The principles are language-agnostic; the examples are TypeScript because that's the stack. Anything tied to React, Next.js, or a specific layer of the stack lives in `frontend-patterns.md` or `backend-patterns.md`, not here.

## Core Principles

These four principles override every specific rule below. When a guideline conflicts with one of them, the principle wins.

### Readability First

Code is read far more often than it is written. The reader is the audience, not the writer.

Optimise for the next person — often you, in six months — understanding the code at a glance. Clear names, obvious structure, and self-documenting code beat clever one-liners and saved keystrokes every time. If a reader has to stop and think about what a piece of code is doing, the code is wrong, not the reader.

### KISS — Keep It Simple

The simplest solution that solves the actual problem is almost always the right one.

Don't reach for advanced patterns, layers of abstraction, or clever idioms when a straightforward approach works. Complexity must justify itself; simplicity is the default. The hallmark of a senior engineer is recognising when *not* to add structure. A flat sequence of named steps usually reads better than a deeply abstracted pipeline.

### DRY — Don't Repeat Yourself

The smell is duplication of *meaning*, not duplication of characters.

- If two places encode the same business rule and would have to change together, extract it.
- If two places happen to look similar today but represent different concepts that may evolve independently, leave them alone.

Premature DRY — extracting a shared helper out of three superficially similar shapes — creates more friction than it removes. Wait until the duplication is real and stable before consolidating.

### YAGNI — You Aren't Gonna Need It

Build only what the current task requires.

No speculative features, no "we might need this later" hooks, no configuration knobs for cases that haven't appeared. Adding code is cheap; maintaining and reading unused code is expensive. Every parameter, branch, and abstraction is something the next reader has to understand. When a future need arrives, the time to design for it is *then*, when its real shape is known.

## Naming Conventions

```typescript
// Variables — camelCase
const marketSearchQuery = 'election'
const isUserAuthenticated = true

// Functions — camelCase arrow functions, verb-led
const fetchMarketData = async (marketId: string): Promise<Market> => { }
const calculateSimilarity = (a: number[], b: number[]): number => { }
const isValidEmail = (email: string): boolean => { }

// Components — PascalCase
const MarketCard = ({ market }: Props) => { }

// Hooks — camelCase, must start with `use`
const useMarketFilters = () => { }

// Constants — SCREAMING_SNAKE_CASE
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500
const API_BASE_URL = '/api/v1'

// Types — PascalCase
type Market = { id: string; name: string }

// Booleans read as questions: isReady, hasPermission, canEdit, shouldRetry

// FAIL: Wrong casing
const MarketSearchQuery = 'election'   // variable, not component
const fetchmarketdata = async () => { } // camelCase required
const maxRetries = 3                   // constant must be SCREAMING_SNAKE_CASE
```

Don't encode the type in the name (`userArray`, `userObj`, `strName`) — the type system already conveys it. `users`, not `userArray`.

### Callback parameters and selectors are never single letters

```typescript
// PASS
markets.filter((market) => market.isActive)
useMarketStore((state) => state.selectedId)

// FAIL
markets.filter((m) => m.isActive)
useMarketStore((s) => s.selectedId)
```

This is an absolute rule for parameters you name. Library APIs that mandate a specific name (Zustand's `set`/`get`) are API surface, not shortcuts.

## TypeScript

### Always Use `type`, Not `interface`

```typescript
// PASS: type keyword
type Market = {
  id: string
  name: string
  status: 'active' | 'resolved' | 'closed'
  createdAt: Date
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

// FAIL: interface (only acceptable when extending a class or declaration merging is genuinely required)
interface Market {
  id: string
}
```

### No `any`, No `@ts-ignore`

```typescript
// FAIL: any type
const getMarket = (id: any): Promise<any> => { }

// FAIL: @ts-ignore
// @ts-ignore
const result = riskyOperation()

// FAIL: Implicit any
const process = (data) => data.map(item => item.id)

// PASS: explicit types; `unknown` is the escape valve for genuinely-unknown input
const getMarket = (id: string): Promise<Market> => { }
const handle = (input: unknown): Result => {
  const parsed = inputSchema.parse(input)
  return process(parsed)
}
```

`unknown` forces narrowing before use — that's the point. `any` switches type-checking off and is never the answer.

### Explicit Return Types — But Only When They Document Something

Annotate the return type when it tells the reader something the body doesn't make obvious — a hook's shape, a utility's value, a non-trivial union. Skip `: JSX.Element`, `: void`, `: Promise<void>`; they restate what the reader can already see and add noise.

```typescript
// PASS — the annotation documents the value
const formatDate = (date: Date): string => date.toISOString()
const useMarkets = (): { markets: Market[]; isLoading: boolean } => { }

// PASS — nothing to document, so no annotation
const MarketCard = ({ market }: Props) => <div>{market.name}</div>
const handleClick = () => setOpen(true)

// FAIL — clutter annotations that restate the obvious
const MarketCard = ({ market }: Props): JSX.Element => <div>{market.name}</div>
const handleClick = (): void => setOpen(true)
const formatDate = (date: Date) => date.toISOString()  // FAIL — value-returning util with no annotation
```

## Functions — Arrow Functions Always

```typescript
// PASS: Arrow functions
const fetchData = async (url: string): Promise<unknown> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  return response.json()
}

const isActive = (status: string): boolean => status === 'active'

// FAIL: function keyword — never use this
function fetchData(url: string) { }
async function loadMarkets() { }
export default function Page() { }  // FAIL — use an arrow function assigned to a const
```

Exception: methods inside a `class` definition use method syntax, not arrow functions. Classes are rare on the frontend; almost everything is a function.

## Control Flow — Guard Clauses

Reverse conditions and exit early. Strip braces from one-line branches.

```typescript
// PASS: one-line guards without braces
if (!user) return null
if (!user.isAdmin) return <Unauthorized />
if (isLoading) return <Spinner />

if (count > MAX_RETRIES) throw new Error('Max retries exceeded')
else retryRequest()

// PASS: multi-line still needs braces
if (!user) {
  logMissingUser()
  return null
}

// FAIL: unnecessary braces on a one-liner
if (!user) {
  return null
}
```

Three or more levels of nesting is the smell — flatten with guards.

```typescript
// FAIL
if (user) {
  if (user.isAdmin) {
    if (market) {
      // do something
    }
  }
}

// PASS
if (!user) return
if (!user.isAdmin) return
if (!market) return
// do something
```

## Immutability

Treat all data as immutable. Build new values; never mutate inputs.

```typescript
// PASS: spread / map / filter return new values
const updatedUser = { ...user, name: 'New Name' }
const appended = [...items, newItem]
const without = items.filter((item) => item.id !== removedId)
const sorted = [...markets].sort((first, second) => second.volume - first.volume)

// FAIL: direct mutation
user.name = 'New Name'
items.push(newItem)
markets.sort(...)   // sorts in place — dangerous when `markets` is React state or a prop
```

This matters most with React state, props, or Zustand store values — mutation skips React's change detection and produces ghost bugs.

## Async / Await

Run independent calls in parallel.

```typescript
// PASS: parallel execution
const [users, markets, stats] = await Promise.all([fetchUsers(), fetchMarkets(), fetchStats()])

// FAIL: serial round trips when nothing depends on the previous result
const users = await fetchUsers()
const markets = await fetchMarkets()
const stats = await fetchStats()
```

Sequential `await` is correct only when each call genuinely depends on the previous one. Reach for `Promise.allSettled` when partial failure should still let the rest proceed.

## File Structure

Every file reads top to bottom: **imports → types → constants → logic → render**.

All type declarations — regardless of how many — are grouped immediately after imports, before any logic. Never scatter types through the file.

```typescript
// 1. IMPORTS
import { useState, useCallback } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import MarketRow from '@/components/MarketList/MarketRow'

// 2. TYPES — all together, immediately after imports
type Props = {
  marketId: string
  onSelect: (id: string) => void
}

type SortDirection = 'asc' | 'desc'

// 3. CONSTANTS (file-scoped magic values)
const POLL_INTERVAL_MS = 5_000

// 4. LOGIC (hooks, handlers, derived state)
const useMarketSelection = (marketId: string) => { }

// 5. RENDER (the primary export)
const MarketList = ({ marketId, onSelect }: Props) => { }

export default MarketList
```

```typescript
// FAIL: types scattered through the file
import { useState } from 'react'

const MarketList = () => {
  type LocalState = { count: number }  // FAIL — types belong at the top
}

type Props = { id: string }  // FAIL — types must come before logic/render
```

## Visibility & Scoping

Every name sits at one of three scopes: **local-only**, **shared-within-app**, or **shared-across-app**. Pick the smallest scope that works. The two failure modes below — one in each direction — are the most common gate violations in generated code.

### Don't export what isn't used externally

If a type, constant, function, or component is only used in the file that defines it, **do not `export` it**. Every `export` is a contract with the rest of the codebase — adding one without an external consumer is dead surface area that confuses readers and blocks refactors.

```typescript
// FAIL — exported but only used inside this file
export const MARKET_PAGE_SIZE = 50
export type MarketRowProps = { market: Market }

const MarketList = () => { /* MARKET_PAGE_SIZE, MarketRowProps only used here */ }
export default MarketList

// PASS — local things stay local
const MARKET_PAGE_SIZE = 50
type MarketRowProps = { market: Market }

const MarketList = () => { }
export default MarketList
```

When something becomes used in a second file, *then* export it — not before.

### Don't keep shared things inline

The opposite mistake. The moment a type, constant, or helper is needed in a *second* file, extract it to its proper home — never duplicate, and never leave it exported from a component/route file when its real home is a shared module.

- Cross-file types → `types/<name>.types.ts`
- Cross-file constants → `lib/constants/`
- Reusable hooks → `hooks/`
- Pure utilities → `lib/`

```typescript
// FAIL — Market type defined in a .tsx component file, imported by three others
// components/MarketList.tsx
export type Market = { id: string; name: string }

// PASS — type lives in its purpose-named home
// types/market.types.ts
export type Market = { id: string; name: string }

// components/MarketList.tsx
import type { Market } from '@/types/market.types'
```

A thing used by N≥2 files lives somewhere both can import from cleanly, **not in one of the consumers**. Together these rules mean **`export` should be rare and intentional.**

## Magic Values → Named Constants

Any literal whose meaning isn't obvious from its position should be a named constant. Bare literals force the reader to guess and create silent drift when one of several copies isn't updated.

Common candidates: timeouts, delays, retry counts, page sizes, max lengths, status strings used in comparisons, URLs, paths, header keys, feature flags.

```typescript
// FAIL
if (retryCount > 3) { }
setTimeout(callback, 500)

// PASS — name captures intent, not value
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500
if (retryCount > MAX_RETRIES) { }
setTimeout(callback, DEBOUNCE_DELAY_MS)
```

Name for **intent** rather than value: `MAX_UPLOAD_BYTES`, not `FIVE_MB`. If the value changes later, the name should still describe what it represents.

## Comments — Few, Load-Bearing

**A good codebase has few comments, and the ones it does have are load-bearing.** Most comments are the trace of a missing abstraction, an unclear name, or a too-long function — those go away by fixing the code, not by writing prose. The exception is genuinely complex, subtle, or critical code: there a comment explaining the *why* is exactly what a future reader needs, and stripping it is worse than leaving it.

The bar to clear is: *would a careful reader miss this without the comment?* If yes, write it. The cases that meet the bar:

- A non-trivial constraint or invariant the type system can't enforce.
- The reasoning behind complex / critical / subtle code (concurrency, security boundaries, ordering requirements, financial or data-integrity logic).
- A workaround for an external bug, with a link or issue reference.
- A subtle performance choice backed by measurement.
- A deliberate rejection of an obvious alternative — to stop reviewers re-suggesting it.

```typescript
// PASS — the why is non-obvious and the code can't convey it
// Exponential backoff prevents a thundering herd during API outages
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
```

Everything else is the disposal list — don't write these, and delete them when you find them:

```typescript
// FAIL — every one of these is delete-on-sight

// Fetch the user from the database     ← states what the code does
const user = await fetchUser(id)

// === Helpers ===                       ← section label; extract a named function instead

// const old = doThingTheOldWay()        ← disabled code; version control remembers

// TODO: refactor later                  ← unowned promise; needs an owner + ticket or delete

/**
 * The MarketCard component.             ← boilerplate JSDoc restating the signature
 * @param market The market to render.
 */
```

If removing a comment would not confuse a future reader, it shouldn't be there. If removing it *would* — keep it.

## Whitespace

- One blank line between type declarations.
- One blank line between functions.
- One blank line between logical blocks within a function.
- Never two blank lines in a row.
- No trailing whitespace; no trailing blank lines at end of file.

Whitespace is structure. Use it deliberately.

## No Unused Code

The codebase contains only code that is currently in use.

- No unused imports.
- No unused variables, parameters, or fields.
- No unused functions or exports.
- No commented-out code.
- No dead branches that can never be reached.
- No "just in case" hooks for hypothetical future use.

If it isn't reached, delete it. Linters should enforce this; CI should fail when they don't.

## Error Handling

- **Fail loudly at boundaries.** Never silently swallow an error you don't understand. An empty `catch` is almost always a bug.
- **Handle or propagate.** Catch an error only when you can do something meaningful — recover, retry, fall back. Otherwise let it bubble up to a layer that can.
- **Don't use exceptions for ordinary control flow.** Errors are for unexpected conditions, not routine "this thing doesn't exist" cases.
- **Error messages are read by humans.** Include the context needed to diagnose: what was attempted, what input was involved, what the system expected.
- **Validate at trust boundaries** — user input, external APIs, route payloads. Trust internal calls; don't re-validate the same value at every layer.

## Input Validation — Zod

Every external input — anything from the user, the URL, or the network — is validated with Zod before use. Inferred types come from the schema, not declared separately.

```typescript
const createMarketSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  endDate: z.string().datetime(),
  categories: z.array(z.string()).min(1),
})

type CreateMarketInput = z.infer<typeof createMarketSchema>

// Throwing flow
const handleCreate = async (input: unknown) => {
  const validated = createMarketSchema.parse(input)
  await createMarket(validated)
}

// Non-throwing flow
const result = createMarketSchema.safeParse(input)
if (!result.success) {
  showErrors(result.error.flatten())
  return
}
await createMarket(result.data)
```

## API Response Format

```typescript
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}

// Success
return NextResponse.json({ success: true, data: markets })

// Error
return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
```

## Testing — AAA and Descriptive Names

Tests follow **Arrange / Act / Assert**, in that order, visually separated:

- **Arrange** — set up inputs and surrounding state.
- **Act** — invoke the behaviour under test, ideally in one line.
- **Assert** — verify the outcome.

Test names describe the behaviour and the conditions under which it holds — not the function being tested. A failing test name should tell the on-call engineer what broke without opening the file.

```typescript
// PASS — describes behaviour and condition
test('returns empty array when no markets match the query', () => {
  const input = 'nonexistent'
  const result = filterMarkets(allMarkets, input)
  expect(result).toEqual([])
})

// FAIL — vague names
test('works', () => { })
test('test markets', () => { })
```

## When Rules Conflict

When two rules disagree, fall back to **Readability First** — pick the version a future reader will understand fastest.

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts    # tRPC catch-all handler
│   ├── markets/                # Market pages
│   ├── (auth)/                 # Auth pages (route groups)
│   └── globals.css             # Tailwind directives
├── components/
│   ├── ui/                     # Generic UI components
│   │   └── Sidebar/            # Sub-components live in a dir named after the parent
│   │       ├── index.tsx       # Parent — owns logic and orchestration
│   │       ├── Header.tsx      # Sub-component — owns rendering of one concern
│   │       └── NavItem.tsx
│   ├── forms/                  # Form components (RHF + Zod)
│   └── layouts/                # Layout components
├── server/                     # tRPC backend
│   ├── routers/
│   │   ├── markets.ts          # Feature routers
│   │   └── index.ts            # Root router (merges all routers)
│   └── trpc.ts                 # createTRPCRouter, publicProcedure, protectedProcedure
├── stores/                     # Zustand stores
├── hooks/                      # Custom React hooks
├── lib/
│   ├── trpc.ts                 # tRPC client + provider
│   ├── env.ts                  # Typed, validated environment access (see frontend-patterns)
│   ├── utils/                  # Helper functions
│   └── constants/              # App-wide constants (SCREAMING_SNAKE_CASE)
├── types/                      # Shared TypeScript types (used by 2+ files)
└── styles/                     # Additional global styles
```

Root-level config (not in `src/`):
```
tailwind.config.ts              # Tailwind config + content paths
postcss.config.js               # PostCSS (required by Tailwind)
```

## File Naming

```
components/Button.tsx           # PascalCase for components
hooks/useAuth.ts                # camelCase with 'use' prefix
lib/formatDate.ts               # camelCase for utilities
types/market.types.ts           # camelCase with .types suffix
```
