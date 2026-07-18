# Frontend Development Patterns

Patterns for the Next.js frontend stack: **Next.js (App Router) + React 19 + TypeScript + Zustand + tRPC + React Hook Form + Zod + Tailwind.** Next.js 15 ships React 19, so the codebase is on React 19 idioms throughout — `use()` for context, ref-as-prop instead of `forwardRef`, the `<Context value=…>` provider shorthand (see **React 19 Idioms** below). Reach for those, not their React 18 equivalents.

**Server state goes through tRPC's TanStack React Query integration.** The whole data layer — per-domain `hooks/<domain>/` structure, stale times, mutations, polling, pagination, and server-side prefetch — is owned by the `tanstack-query` gate. This file covers the rest of the frontend; read `tanstack-query` before fetching anything.

## Component Architecture

### Reuse Before Build

Before writing a new component, search for one that already does the job. Order of preference: an existing component in `components/` → a composition of existing components → only then build new. Bespoke components are a liability — justify why an existing piece won't work before adding one. The same applies to hooks and utilities: check `hooks/` and `lib/` first.

### One Component Per File

Every `.tsx` file defines exactly one component, with exactly one component-level `return (`. If you need sub-components, each one gets its own `.tsx` file inside a directory named after the parent. The parent's entry file is `index.tsx`.

```
// PASS: each component in its own file
Sidebar/
├── index.tsx     ← defines only Sidebar, imports NavItem
└── NavItem.tsx   ← defines only NavItem
```

```typescript
// FAIL: multiple components in one file
const NavItem = ({ label }: { label: string }) => <span>{label}</span>

const Sidebar = () => (
  <nav>
    <NavItem label="Home" />
  </nav>
)

export default Sidebar
```

### Parent Owns Logic — Sub-components Own Rendering

Parent components orchestrate data, state, and handlers. Sub-components are pure rendering of a single concern, and live in a directory named after the parent.

```
Sidebar/
├── index.tsx     ← owns all logic, composes sub-components
├── Header.tsx    ← renders the header section only
├── NavItem.tsx   ← renders a single nav item
└── Footer.tsx    ← renders the footer section only
```

```typescript
// PASS: Sidebar/index.tsx — logic owner
const Sidebar = () => {
  const user = useAuthStore((state) => state.user)
  const { navItems, activeItem, setActiveItem } = useSidebarStore()

  return (
    <aside>
      <Header user={user} />
      {navItems.map((item) => (
        <NavItem key={item.id} item={item} isActive={item.id === activeItem} onSelect={setActiveItem} />
      ))}
    </aside>
  )
}

export default Sidebar
```

```typescript
// PASS: Sidebar/NavItem.tsx — rendering concern only
type Props = {
  item: NavItem
  isActive: boolean
  onSelect: (id: string) => void
}

const NavItem = ({ item, isActive, onSelect }: Props) => (
  <button data-active={isActive} onClick={() => onSelect(item.id)}>
    {item.label}
  </button>
)

export default NavItem
```

### No God Components

If a component has 10+ props or orchestrates five different concerns, split it. Use stores or context for cross-cutting state instead of forwarding everything via props.

```typescript
// FAIL: 10+ props, controls all behaviour
const Dashboard = ({
  user, markets, isLoading, error, onRefresh, onSort, onFilter,
  selectedMarket, onSelect, showSidebar, onToggleSidebar,
}: DashboardProps) => { }

// PASS: split concerns; let children read from stores
const Dashboard = () => (
  <div>
    <MarketFilters />
    <MarketList />
  </div>
)

export default Dashboard
```

### If a Comment Labels a Section, It Should Be a Component

```typescript
// FAIL: comments as structure
const Page = () => (
  <div>
    {/* Header */}
    <div>...</div>
    {/* Stats */}
    <div>...</div>
    {/* Market Table */}
    <div>...</div>
  </div>
)

// PASS: named components
const Page = () => (
  <div>
    <PageHeader />
    <StatsBar />
    <MarketTable />
  </div>
)
```

## Imports

Group imports by source, top to bottom, with one blank line between groups:

1. Third-party packages — `react`, `zod`, `react-hook-form`, etc.
2. App-internal via the `@/` path alias.

Prefer the `@/` alias over deep relative paths so a reader can locate the source without tracing `../../`. Use `import type` for types-only imports — it strips at build time and makes the dependency footprint explicit.

```typescript
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { useMarketStore } from '@/stores/marketStore'
import { useTRPC } from '@/lib/trpc/client'
import type { Market } from '@/types/market.types'
```

## Type Scoping

Two categories — local or shared. The rule for where a type lives is determined by whether it needs to be exported:

- **Local type** — only used within this file. Define it in the file, never export it.
- **Exported type** — needed by any other file. It must live in a `.ts` file in `types/`. Never export a type from a `.tsx` component file.

```typescript
// PASS: local type in component — defined in the file, not exported
type Props = {
  marketId: string
  onSelect: (id: string) => void
}

// PASS: exported type — lives in types/market.types.ts, imported where needed
export type Market = {
  id: string
  name: string
  status: 'active' | 'resolved' | 'closed'
}

// FAIL: exporting a type from a .tsx component file
export type MarketCardProps = { ... }  // move to types/marketCard.types.ts
```

## No Prop Drilling

Three or more levels of pass-through is the threshold.

```typescript
// FAIL: drilling 3+ levels
const App = () => <Page user={user} />
const Page = ({ user }: { user: User }) => <Sidebar user={user} />
const Sidebar = ({ user }: { user: User }) => <Avatar user={user} />

// PASS: Zustand store — the leaf reads directly
const Avatar = () => {
  const user = useAuthStore((state) => state.user)
  return <img src={user.avatar} alt={user.name} />
}
```

For shared client state use a Zustand store. For genuinely cross-cutting concerns whose lifetime matches the app (auth, theme, current user), Context is also fine.

## State Management

Pick the smallest tool that fits the problem.

| State type | Tool |
|---|---|
| Server state / cache | tRPC + TanStack Query — owned by the `tanstack-query` gate |
| Form state | React Hook Form (single instance, even across wizard steps) |
| Shared / cross-component / persistent client state | Zustand |
| App-lifetime cross-cutting (auth, theme, current user) | React Context |
| Local state machine — 3+ related values that transition together | `useReducer` |
| Single-component UI state (toggle, hover, open/closed) | `useState` |

### Zustand for shared client state

Preferred for shared, cross-component, or persistent client state. Not for form state or single-component UI state. Consumers always use a selector — never destructure the whole store (it re-renders on every change).

```typescript
// stores/marketStore.ts
import { create } from 'zustand'

type MarketStore = {
  selectedId: string | null
  selectMarket: (id: string) => void
}

const useMarketStore = create<MarketStore>((set) => ({
  selectedId: null,
  selectMarket: (id) => set({ selectedId: id }),
}))

export default useMarketStore
```

```typescript
// Consuming — select only what you need
const selectedId = useMarketStore((state) => state.selectedId)  // PASS
const { selectedId } = useMarketStore()                          // FAIL — re-renders on every change
```

Use Zustand for **client-only** concerns: filters, selections, UI flags, derived view-state. Don't mirror server data into it — that lives in the tRPC cache (see below).

### `useReducer` for local state machines

Reach for `useReducer` over `useState` when a component has **3+ related state values that transition together**, or when the next state depends on the current state in non-trivial ways (uploads, multi-step flows, anything modelled as `idle | loading | success | error`). Reducers make transitions explicit, exhaustive, and testable. Don't reach for one just because there are two `useState` calls — independent values stay in `useState`.

Use a flat state object with a `status` field. Actions are a discriminated union so the reducer's `switch` is exhaustive.

```typescript
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

type UploadState = {
  status: UploadStatus
  progress: number
  url: string | null
  error: string | null
}

type UploadAction =
  | { type: 'start' }
  | { type: 'progress'; progress: number }
  | { type: 'success'; url: string }
  | { type: 'error'; message: string }
  | { type: 'reset' }

const initialUploadState: UploadState = { status: 'idle', progress: 0, url: null, error: null }

const uploadReducer = (state: UploadState, action: UploadAction): UploadState => {
  switch (action.type) {
    case 'start':    return { ...initialUploadState, status: 'uploading' }
    case 'progress': return { ...state, progress: action.progress }
    case 'success':  return { ...state, status: 'success', url: action.url }
    case 'error':    return { ...state, status: 'error', error: action.message }
    case 'reset':    return initialUploadState
  }
}

const AssetUpload = () => {
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState)
  // dispatch transitions; render based on state.status
}

export default AssetUpload
```

Keep the reducer co-located with its component. If it grows past ~50 lines or is consumed by multiple components, extract it to a hook in `hooks/`. Never mirror local state-machine state into Zustand — transient component state stays in the component.

## Forms — React Hook Form + Zod

RHF is the single source of truth for all form state. Never use Zustand or useState for form fields. Zod handles all validation via `zodResolver`.

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const createMarketSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().min(1).max(2000),
  endDate: z.string().datetime(),
})

type CreateMarketInput = z.infer<typeof createMarketSchema>

const CreateMarketForm = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateMarketInput>({
    resolver: zodResolver(createMarketSchema),
  })

  const onSubmit = async (data: CreateMarketInput) => {
    await createMarket(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} placeholder="Market name" />
      {errors.name && <span>{errors.name.message}</span>}
      <button type="submit" disabled={isSubmitting}>Create</button>
    </form>
  )
}

export default CreateMarketForm
```

### Multi-Step Wizards — Single RHF Instance at Parent

```typescript
// PASS: one form instance at the wizard root, steps consume via FormProvider / useFormContext
const CreateMarketWizard = () => {
  const form = useForm<CreateMarketInput>({ resolver: zodResolver(createMarketSchema) })
  const [step, setStep] = useState(0)

  return (
    <FormProvider {...form}>
      {step === 0 && <StepDetails />}
      {step === 1 && <StepDates />}
      {step === 2 && <StepReview onSubmit={form.handleSubmit(onSubmit)} />}
    </FormProvider>
  )
}

// Steps consume via useFormContext — no per-step form instances
const StepDetails = () => {
  const { register } = useFormContext<CreateMarketInput>()
  return <input {...register('name')} />
}

// FAIL: separate useForm in each step — splits form state across steps
const StepDetails = () => {
  const form = useForm()
}
```

## tRPC Data Fetching

Prefer tRPC over raw fetch — it *is* your TanStack Query layer. Use the **modern TanStack React Query integration** (`useTRPC()` + `trpc.x.queryOptions()` + `useQuery`), not the classic `trpc.x.useQuery()` proxy. **The full data layer — per-domain `hooks/<domain>/` structure, `<domain>.cache.ts`, mutations, polling, pagination, prefetch — is owned by the `tanstack-query` gate.** The two rules that matter here:

- **Server reads go through a `use*` hook backed by the cache**, never `useState` + `useEffect` + `fetch`.
- **Never mirror server data into Zustand** — the tRPC/TanStack cache is the single source of truth.

```typescript
// PASS: server reads live in a domain hook (hooks/markets/useMarketsList.ts)
const trpc = useTRPC()
const { data: markets, isLoading, error } = useQuery(trpc.markets.list.queryOptions({ status: 'active' }))

// PASS: mutation — `isPending` and lifecycle come from the mutation object; invalidate via the query client
const queryClient = useQueryClient()
const createMarket = useMutation(
  trpc.markets.create.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.markets.list.queryKey() }),
  }),
)

// FAIL: mirroring tRPC response into Zustand — two sources of truth that drift
const { data } = useQuery(trpc.markets.list.queryOptions())
useEffect(() => setMarkets(data), [data])
```

## Loading, Empty, and Error States

Every component that loads data handles three states explicitly: **loading**, **empty**, **error**. Never just the happy path.

```typescript
// PASS — three states in priority order, off the domain hook (hooks/markets/useMarketsList.ts)
const MarketList = () => {
  const { data: markets, isLoading, error, refetch } = useMarketsList()

  if (isLoading) return <MarketListSkeleton />
  if (error) return <ErrorState message="Couldn't load markets" onRetry={refetch} />
  if (!markets || markets.length === 0) return <EmptyState message="No markets yet" action={<CreateMarketButton />} />

  return <ul>{markets.map((market) => <MarketRow key={market.id} market={market} />)}</ul>
}

// FAIL — only the happy path; ignores loading / error / empty and assumes data is ready
const MarketList = () => {
  const { data: markets } = useMarketsList()
  return <ul>{markets?.map((market) => <MarketRow key={market.id} market={market} />)}</ul>
}
```

**Skeletons** live next to the component they shadow (`MarketCard.tsx` + `MarketCardSkeleton.tsx`), match the loaded shape (same row count, columns, heights), and shimmer with Tailwind's `animate-pulse`.

**Mutations** follow the same pattern: pending (disabled submit + indicator, from `mutation.isPending`), success (toast / redirect), error (inline near the field when known, toast when not). Never use a full-page spinner overlay during a mutation.

## Optimistic UI

For mutations where the post-mutation state is predictable (toggling a favourite, renaming a row, changing a status), render the new state immediately and reconcile when the server responds.

**For server data, use TanStack Query's optimistic-update pattern** through tRPC — it owns the cache, so the optimistic value and the eventual server value live in one place. Use `useQueryClient()` + `trpc.x.queryKey()` (the modern integration). The canonical cancel → snapshot → set → rollback → settle shape lives in `tanstack-query` § Mutations:

```typescript
// PASS — optimistic update via the tRPC / TanStack Query cache
const trpc = useTRPC()
const queryClient = useQueryClient()
const listKey = trpc.markets.list.queryKey()

const toggleFavourite = useMutation(
  trpc.markets.toggleFavourite.mutationOptions({
    onMutate: async ({ id, favourited }) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData(listKey)
      queryClient.setQueryData(listKey, (old) =>
        old?.map((market) => (market.id === id ? { ...market, favourited } : market)),
      )
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  }),
)
```

**For client-only or transient optimism** — state that isn't backed by a tRPC query — React 19's `useOptimistic` is lighter. Scope it to the leaf row/item that owns the value so a failure only flickers one row. Don't reach for it for destructive mutations (delete, archive) where a revert would be jarring, or where the server result isn't predictable (server-assigned ID, derived field) — show a normal pending state there instead.

## Custom Hooks

Reusable behaviour lives in `hooks/`. Names start with `use`; the return value is explicitly typed when its shape isn't obvious. Cross-cutting hooks stay **flat** in `hooks/` with the domain in the filename (`useMarketFilters.ts`). **Exception:** a server-state domain (≈6+ hooks) gets its own `hooks/<domain>/` folder holding its `<domain>.cache.ts`, query/mutation hooks, and any domain-specific non-query hooks (selection, upload, editor state) — owned by the `tanstack-query` gate.

```typescript
const useToggle = (initial = false): [boolean, () => void] => {
  const [value, setValue] = useState(initial)
  const toggle = useCallback(() => setValue((previous) => !previous), [])
  return [value, toggle]
}

export default useToggle
```

```typescript
const useDebounce = <T>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handle)
  }, [value, delay])

  return debounced
}

export default useDebounce
```

## Component Patterns

### Composition

Each composable piece is its own file. The parent imports and arranges them.

```
Card/
├── index.tsx      ← composes CardHeader + CardBody
├── CardHeader.tsx
└── CardBody.tsx
```

```typescript
// Card/CardHeader.tsx
type Props = { children: React.ReactNode }

const CardHeader = ({ children }: Props) => <div className="card-header">{children}</div>

export default CardHeader
```

```typescript
// Card/index.tsx
import CardHeader from '@/components/ui/Card/CardHeader'
import CardBody from '@/components/ui/Card/CardBody'

type Props = {
  children: React.ReactNode
  variant?: 'default' | 'outlined'
}

const Card = ({ children, variant = 'default' }: Props) => (
  <div className={`card card-${variant}`}>{children}</div>
)

export default Card
```

### Compound Components

Shared state lives in Context, defined in a `.ts` file (no JSX). Each compound piece is its own file. Context access goes through a wrapper hook so the safety check (throwing if used outside the provider) lives in exactly one place — and the hook uses React 19's `use()`, not `useContext()`.

```
components/ui/Tabs/
├── index.tsx        ← Tabs root, owns state, provides context
├── Tab.tsx          ← individual tab button
└── TabsContext.ts   ← context definition (.ts not .tsx)

hooks/
└── useTabs.ts        ← context-access hook with the safety check
```

```typescript
// components/ui/Tabs/TabsContext.ts
import { createContext } from 'react'

type TabsContextValue = {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const TabsContext = createContext<TabsContextValue | undefined>(undefined)
```

```typescript
// hooks/useTabs.ts — the only place that knows about the provider requirement
import { use } from 'react'
import { TabsContext } from '@/components/ui/Tabs/TabsContext'

const useTabs = () => {
  const context = use(TabsContext)
  if (!context) throw new Error('useTabs must be used within <Tabs>')
  return context
}

export default useTabs
```

```typescript
// components/ui/Tabs/index.tsx — provider shorthand, no .Provider
import { useState } from 'react'
import { TabsContext } from '@/components/ui/Tabs/TabsContext'

type Props = { children: React.ReactNode; defaultTab: string }

const Tabs = ({ children, defaultTab }: Props) => {
  const [activeTab, setActiveTab] = useState(defaultTab)
  return <TabsContext value={{ activeTab, setActiveTab }}>{children}</TabsContext>
}

export default Tabs
```

```typescript
// components/ui/Tabs/Tab.tsx — consumes via the hook, no inline throw
import useTabs from '@/hooks/useTabs'

type Props = { id: string; children: React.ReactNode }

const Tab = ({ id, children }: Props) => {
  const { activeTab, setActiveTab } = useTabs()

  return (
    <button data-active={activeTab === id} onClick={() => setActiveTab(id)}>
      {children}
    </button>
  )
}

export default Tab
```

## React 19 Idioms

Next.js 15 runs **React 19**. New code is on React 19 patterns end-to-end. The React 18 equivalents still work but they're noise, and reviewers will flag them.

### Refs — ref-as-prop, never `forwardRef`

Under React 19, `ref` is just another prop. Take it as a destructured prop; don't wrap the component in `forwardRef`.

```typescript
// PASS — ref-as-prop, React 19 idiomatic
type Props = React.ComponentProps<'input'> & { label?: string }

const TextField = ({ ref, label, ...props }: Props) => (
  <label>
    {label}
    <input ref={ref} {...props} />
  </label>
)

export default TextField

// FAIL — forwardRef is the React 18 pattern; don't reach for it
const TextField = React.forwardRef<HTMLInputElement, Props>(({ label, ...props }, ref) => (/* … */))
TextField.displayName = 'TextField'
```

Type conventions that follow:

- **Props for an intrinsic element** — `React.ComponentProps<'button'>`, not `React.HTMLAttributes<HTMLButtonElement>`. `ComponentProps` already includes `ref?`.
- **Props for another component** — `React.ComponentProps<typeof X>`, not `React.ComponentPropsWithoutRef<typeof X>`. The `WithoutRef` variant only existed to strip the ref off the props type under `forwardRef`; React 19 doesn't need it.
- **`displayName` is not required** — a function component takes its name from the variable it's assigned to.

### Context consumption — `use()`, never `useContext()`

React 19 replaces `useContext(Context)` with the more general `use(Context)`. Same semantics for context, but `use()` also works inside conditionals and loops. Always read context through a wrapper hook (see **Compound Components**) so the provider-guard lives in one place.

```typescript
// PASS — React 19 idiomatic
import { use } from 'react'

const useAuth = () => {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used within <AuthProvider>')
  return context
}

// FAIL — React 18 hook, no reason to reach for it on this stack
import { useContext } from 'react'
const useAuth = () => useContext(AuthContext)
```

### Provider shorthand — `<Context value={…}>`, not `<Context.Provider>`

```typescript
// PASS — React 19 idiomatic
<AuthContext value={value}>{children}</AuthContext>

// FAIL — works, but it's the React 18 form
<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
```

### Other React 19 idioms worth reaching for

Not mechanical replacements — use them when the use-case calls for them, but know they exist before hand-rolling the React 18 equivalent.

- **`useActionState`** for non-tRPC form mutations that go through a Server Action — returns `[state, action, isPending]` in one call. tRPC forms stay on RHF + Zod + `mutateAsync`; reach for `useActionState` when the mutation is a Server Action rather than a tRPC procedure.
- **`useTransition`** — `const [isPending, startTransition] = useTransition()` gives a managed `isPending` for any async work. In a tRPC app the mutation object already exposes `isPending`, so this is mainly for non-tRPC async or marking expensive state updates (filter/search/tab switches) as non-urgent. Don't reach for it pre-emptively — only when you measure jank.
- **`useFormStatus`** inside a submit button to read the parent form's pending state without prop-drilling `isSubmitting`.
- **Document metadata in components** — `<title>`, `<meta>`, `<link>` rendered in the tree are hoisted to `<head>` automatically. (In the App Router, prefer the `metadata` export / `generateMetadata` for static and per-route titles; use in-tree tags for metadata that depends on client state.)

## Environment Variables

Next.js only exposes variables prefixed with `NEXT_PUBLIC_` to the browser bundle; everything else is server-only. Centralise env access in a single typed, validated module — components never read `process.env` directly.

```typescript
// lib/env.ts — the single place that reads process.env, validated with Zod
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
})
```

```typescript
// In a component or hook
import { env } from '@/lib/env'

const apiUrl = env.NEXT_PUBLIC_API_URL

// FAIL — direct access bypasses validation and the typed export
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

A missing or malformed var then fails fast at startup, not when a component first reads it. **Never put a secret in a `NEXT_PUBLIC_*` variable** — anything `NEXT_PUBLIC_*` ships to the browser and is visible to every user. Server-only secrets are read without the prefix, in server code only.

## Performance Optimisation

Optimise when you measure a problem. `useMemo` and `useCallback` cost something — reach for them when a measured re-render is the problem, or when a value flows into something memoised.

```typescript
// useMemo for expensive derivations
const sortedMarkets = useMemo(
  () => [...markets].sort((first, second) => second.volume - first.volume),
  [markets],
)

// useCallback to stabilise a callback passed to a memoised child
const handleSelect = useCallback((id: string) => selectMarket(id), [selectMarket])

// React.memo for pure children rendered in long lists
const MarketCard = React.memo(({ market }: { market: Market }) => (
  <div className="market-card"><h3>{market.name}</h3></div>
))

// Code-split heavy components — lazy() requires a default export
const HeavyChart = lazy(() => import('@/components/HeavyChart'))

const Dashboard = () => (
  <Suspense fallback={<ChartSkeleton />}>
    <HeavyChart />
  </Suspense>
)
```

## Conditional Rendering

Keep conditions flat and explicit. Avoid nested ternaries.

```typescript
// PASS: clear conditions
{isLoading && <Spinner />}
{error && <ErrorState error={error} />}
{data && <DataDisplay data={data} />}

// FAIL: nested ternaries
{isLoading ? <Spinner /> : error ? <ErrorState error={error} /> : <DataDisplay data={data} />}
```

When more than two branches are involved, extract a small render helper or split into early returns.

## Accessibility

- Every interactive element has an accessible label (`aria-label` or visible text).
- Forms use `<label>` linked to their input (`htmlFor` / `id`), not placeholder-only labels.
- Keyboard navigation works without a mouse — sensible Tab order, Enter/Space activate, Esc closes overlays.
- Focus is trapped inside open modals and returned to the trigger on close.
- Colour is never the only signal — pair it with text, an icon, or a state attribute.

```typescript
// Keyboard navigation
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, options.length - 1)) }
  if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
  if (e.key === 'Enter') { e.preventDefault(); onSelect(options[activeIndex]) }
  if (e.key === 'Escape') setIsOpen(false)
}

// Focus management for modals
const Modal = ({ isOpen, onClose, children }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      modalRef.current?.focus()
    } else previousFocusRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      {children}
    </div>
  )
}

export default Modal
```

## Animation

```typescript
import { motion, AnimatePresence } from 'framer-motion'

const AnimatedList = ({ markets }: { markets: Market[] }) => (
  <AnimatePresence>
    {markets.map((market) => (
      <motion.div
        key={market.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <MarketCard market={market} />
      </motion.div>
    ))}
  </AnimatePresence>
)

export default AnimatedList
```
