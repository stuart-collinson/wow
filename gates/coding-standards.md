# Coding Standards & Best Practices

Universal coding standards for Next.js / TypeScript projects.

## Core Principles

1. **Readability First** — Code is read more than written. Clear names, self-documenting code, near-zero comments.
2. **KISS** — Simplest solution that works. No premature optimisation. Easy to understand > clever.
3. **DRY** — Extract common logic. No copy-paste programming.
4. **YAGNI** — Don't build features before they're needed. Add complexity only when required.

## Naming Conventions

```typescript
// Variables — camelCase
const marketSearchQuery = 'election'
const isUserAuthenticated = true

// Functions — camelCase arrow functions
const fetchMarketData = async (marketId: string): Promise<Market> => { }
const calculateSimilarity = (a: number[], b: number[]): number => { }
const isValidEmail = (email: string): boolean => { }

// Components — PascalCase
const MarketCard = ({ market }: MarketCardProps): JSX.Element => { }

// Constants — SCREAMING_SNAKE_CASE
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500
const API_BASE_URL = '/api/v1'

// FAIL: Wrong casing
const MarketSearchQuery = 'election'   // variable, not component
const fetchmarketdata = async () => { } // camelCase required
const maxRetries = 3                   // constant must be SCREAMING_SNAKE_CASE
```

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

// FAIL: interface (only acceptable when extending or declaration merging is genuinely required)
interface Market {
  id: string
}
```

### Strict TypeScript — No Escape Hatches

```typescript
// FAIL: any type
const getMarket = (id: any): Promise<any> => { }

// FAIL: @ts-ignore
// @ts-ignore
const result = riskyOperation()

// FAIL: Implicit any
const process = (data) => data.map(item => item.id)

// PASS: Explicit types everywhere
const getMarket = (id: string): Promise<Market> => { }
const processItems = (data: Item[]): string[] => data.map(item => item.id)
```

### Explicit Return Types on All Functions

```typescript
// FAIL: Missing return type
const formatDate = (date: Date) => date.toISOString()
const useMarkets = () => {
  const [markets, setMarkets] = useState<Market[]>([])
  return { markets }
}

// PASS
const formatDate = (date: Date): string => date.toISOString()
const useMarkets = (): { markets: Market[] } => {
  const [markets, setMarkets] = useState<Market[]>([])
  return { markets }
}
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
export default function Page() { }  // FAIL — use arrow function
```

## Control Flow — Omit Curly Braces for One-Liners

```typescript
// PASS: One-line if/else without braces
if (!user) return null
if (!user) return
if (isLoading) return <Spinner />

if (count > MAX_RETRIES) throw new Error('Max retries exceeded')
else retryRequest()

// PASS: Multi-line still needs braces
if (!user) {
  logMissingUser()
  return null
}

// FAIL: Unnecessary braces on one-liners
if (!user) {
  return null
}
```

## Immutability

```typescript
// PASS: Spread operator
const updatedUser = { ...user, name: 'New Name' }
const updatedArray = [...items, newItem]

// FAIL: Direct mutation
user.name = 'New Name'
items.push(newItem)
```

## Async / Await

```typescript
// PASS: Parallel execution
const [users, markets, stats] = await Promise.all([fetchUsers(), fetchMarkets(), fetchStats()])

// FAIL: Sequential when not needed
const users = await fetchUsers()
const markets = await fetchMarkets()
const stats = await fetchStats()
```

## File Structure

Every file follows this order: **imports → types → logic → render**

```typescript
// 1. IMPORTS
import { useState, useCallback } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { MarketRow } from './MarketList/MarketRow'

// 2. TYPES (local — not exported if used only here)
type Props = {
  marketId: string
  onSelect: (id: string) => void
}

// 3. LOGIC (hooks, handlers, derived state)
const useMarketSelection = (marketId: string) => {
  // ...
}

// 4. RENDER (component)
const MarketList = ({ marketId, onSelect }: Props): JSX.Element => {
  // ...
}

export default MarketList
```

## Comments — Near Zero

```typescript
// PASS: Only for genuinely complex logic where code cannot convey intent
// Exponential backoff prevents thundering herd during API outages
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)

// FAIL: Stating the obvious
// Increment counter
count++

// FAIL: Section labels (extract a named component or function instead)
// --- Header ---
// --- Body ---
// --- Footer ---
```

## Whitespace

- One blank line between type declarations
- One blank line between functions
- One blank line between logical blocks within a function
- No trailing blank lines at end of file

## Code Smell Detection

### Deep Nesting → Early Returns

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

### Magic Numbers → Named Constants

```typescript
// FAIL
if (retryCount > 3) { }
setTimeout(callback, 500)

// PASS
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500
if (retryCount > MAX_RETRIES) { }
setTimeout(callback, DEBOUNCE_DELAY_MS)
```

### Unused Code

- No unused imports
- No unused variables
- No unused functions
- No dead code paths

## Input Validation

```typescript
// PASS: Zod schema validation
const createMarketSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  endDate: z.string().datetime(),
  categories: z.array(z.string()).min(1)
})

type CreateMarketInput = z.infer<typeof createMarketSchema>

const handleCreate = async (input: unknown): Promise<void> => {
  const validated = createMarketSchema.parse(input)
  await createMarket(validated)
}
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

## Testing (AAA Pattern)

```typescript
// PASS: Descriptive test names, AAA structure
test('returns empty array when no markets match query', () => {
  const input = 'nonexistent'
  const result = filterMarkets(allMarkets, input)
  expect(result).toEqual([])
})

// FAIL: Vague names
test('works', () => { })
test('test markets', () => { })
```

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
│   └── globals.css             # Tailwind directives (@tailwind base/components/utilities)
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
│   ├── utils/                  # Helper functions
│   └── constants/              # App-wide constants (SCREAMING_SNAKE_CASE)
├── types/                      # Shared TypeScript types (used by 2+ components)
└── styles/                     # Additional global styles (if needed beyond globals.css)
```

Root-level config files (not in src/):
```
tailwind.config.ts              # Tailwind config + content paths
postcss.config.js               # PostCSS (required by Tailwind)
```

## File Naming

components/Button.tsx          # PascalCase for components
hooks/useAuth.ts              # camelCase with 'use' prefix
lib/formatDate.ts             # camelCase for utilities
types/market.types.ts         # camelCase with .types suffix