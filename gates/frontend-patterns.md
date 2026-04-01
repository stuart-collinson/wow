# Frontend Development Patterns

Modern frontend patterns for Next.js, TypeScript, Zustand, and tRPC.

## Component Architecture

### Parent Owns Logic — Sub-components Own Rendering

Parent components orchestrate data, state, and handlers. Sub-components are pure rendering of a single concern. Sub-components live in a directory named after the parent.

```
Sidebar/
├── index.tsx     ← owns all logic, composes sub-components
├── Header.tsx    ← renders the header section only
├── NavItem.tsx   ← renders a single nav item
└── Footer.tsx    ← renders the footer section only
```

```typescript
// PASS: Sidebar/index.tsx — logic owner
const Sidebar = (): JSX.Element => {
  const { user } = useAuthStore()
  const { navItems, activeItem, setActiveItem } = useSidebarStore()

  return (
    <aside>
      <Header user={user} />
      {navItems.map(item => (
        <NavItem key={item.id} item={item} isActive={item.id === activeItem} onSelect={setActiveItem} />
      ))}
    </aside>
  )
}

// PASS: Sidebar/NavItem.tsx — rendering concern only
type Props = {
  item: NavItem
  isActive: boolean
  onSelect: (id: string) => void
}

const NavItem = ({ item, isActive, onSelect }: Props): JSX.Element => (
  <button className={isActive ? 'active' : ''} onClick={() => onSelect(item.id)}>
    {item.label}
  </button>
)
```

### No God Components

```typescript
// FAIL: 10+ props, controls all behaviour
const Dashboard = ({
  user, markets, isLoading, error, onRefresh, onSort, onFilter,
  selectedMarket, onSelect, showSidebar, onToggleSidebar
}: DashboardProps): JSX.Element => { }

// PASS: Split concerns, use stores for shared state
const Dashboard = (): JSX.Element => {
  const { markets, isLoading } = useMarketStore()
  return (
    <div>
      <MarketFilters />
      <MarketList />
    </div>
  )
}
```

### If a Comment Labels a Section, It Should Be a Component

```typescript
// FAIL: Comments as structure
const Page = (): JSX.Element => (
  <div>
    {/* Header */}
    <div>...</div>
    {/* Stats */}
    <div>...</div>
    {/* Market Table */}
    <div>...</div>
  </div>
)

// PASS: Named components
const Page = (): JSX.Element => (
  <div>
    <PageHeader />
    <StatsBar />
    <MarketTable />
  </div>
)
```

## Type Scoping

```typescript
// PASS: Local type — used by one component, defined locally, never exported
type Props = {
  marketId: string
  onSelect: (id: string) => void
}

// PASS: Shared type — used by 2+ components, lives in /types directory
// types/market.ts
export type Market = {
  id: string
  name: string
  status: 'active' | 'resolved' | 'closed'
}

// FAIL: Exporting a type that's only used in one file
export type ButtonProps = { ... }  // if only Button.tsx uses it

// FAIL: Same type defined in multiple files
// Both MarketCard.tsx and MarketList.tsx define their own Market type
```

## No Prop Drilling

```typescript
// FAIL: Drilling 3+ levels
const App = (): JSX.Element => <Page user={user} />
const Page = ({ user }: { user: User }): JSX.Element => <Sidebar user={user} />
const Sidebar = ({ user }: { user: User }): JSX.Element => <Avatar user={user} />

// PASS: Zustand store — consumers read directly
const Avatar = (): JSX.Element => {
  const user = useAuthStore(s => s.user)
  return <img src={user.avatar} />
}
```

## State Management — Zustand

Preferred for shared, cross-component, or persistent state. Not for form state or single-component UI state.

```typescript
// stores/marketStore.ts
import { create } from 'zustand'

type MarketStore = {
  markets: Market[]
  selectedId: string | null
  isLoading: boolean
  setMarkets: (markets: Market[]) => void
  selectMarket: (id: string) => void
}

const useMarketStore = create<MarketStore>((set) => ({
  markets: [],
  selectedId: null,
  isLoading: false,
  setMarkets: (markets) => set({ markets }),
  selectMarket: (id) => set({ selectedId: id }),
}))

export default useMarketStore
```

```typescript
// Consuming — select only what you need to avoid unnecessary re-renders
const markets = useMarketStore(s => s.markets)
const selectMarket = useMarketStore(s => s.selectMarket)
```

### When to Use What

| State type | Tool |
|---|---|
| Shared / cross-component / persistent | Zustand |
| Form state | React Hook Form |
| Single-component UI state (toggle, hover) | useState |
| Server state / cache | tRPC + React Query |

## Forms — React Hook Form + Zod

RHF is the single source of truth for all form state. Never use Zustand or useState for form state. Zod handles all client-side validation.

```typescript
// PASS: RHF + Zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const createMarketSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().min(1).max(2000),
  endDate: z.string().datetime(),
})

type CreateMarketInput = z.infer<typeof createMarketSchema>

const CreateMarketForm = (): JSX.Element => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateMarketInput>({
    resolver: zodResolver(createMarketSchema),
  })

  const onSubmit = async (data: CreateMarketInput): Promise<void> => {
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
```

### Multi-Step Wizards — Single RHF Instance at Parent

```typescript
// PASS: One form instance at the wizard root, passed to steps via props or context
const CreateMarketWizard = (): JSX.Element => {
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
const StepDetails = (): JSX.Element => {
  const { register, formState: { errors } } = useFormContext<CreateMarketInput>()
  return <input {...register('name')} />
}

// FAIL: Separate useForm in each step
const StepDetails = (): JSX.Element => {
  const form = useForm()  // WRONG — splits form state across steps
}
```

## Custom Hooks

```typescript
// PASS: Toggle
const useToggle = (initialValue = false): [boolean, () => void] => {
  const [value, setValue] = useState(initialValue)
  const toggle = useCallback((): void => setValue(v => !v), [])
  return [value, toggle]
}

// PASS: Debounce
const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

## tRPC Data Fetching

Prefer tRPC over raw fetch. tRPC queries are the server state layer — do not mirror tRPC data into Zustand.

```typescript
// PASS: tRPC query
const { data: markets, isLoading, error } = trpc.markets.list.useQuery({ status: 'active' })

// PASS: tRPC mutation
const createMarket = trpc.markets.create.useMutation({
  onSuccess: () => utils.markets.list.invalidate(),
})

const onSubmit = async (data: CreateMarketInput): Promise<void> => {
  await createMarket.mutateAsync(data)
}

// FAIL: Mirroring tRPC response into Zustand
const { data } = trpc.markets.list.useQuery()
useEffect(() => setMarkets(data), [data])  // Unnecessary — use tRPC cache directly
```

## Component Patterns

### Composition

```typescript
type CardProps = {
  children: React.ReactNode
  variant?: 'default' | 'outlined'
}

const Card = ({ children, variant = 'default' }: CardProps): JSX.Element => (
  <div className={`card card-${variant}`}>{children}</div>
)

const CardHeader = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div className="card-header">{children}</div>
)

const CardBody = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div className="card-body">{children}</div>
)
```

### Compound Components

```typescript
type TabsContextValue = {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

const Tabs = ({ children, defaultTab }: { children: React.ReactNode; defaultTab: string }): JSX.Element => {
  const [activeTab, setActiveTab] = useState(defaultTab)
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  )
}

const Tab = ({ id, children }: { id: string; children: React.ReactNode }): JSX.Element => {
  const context = useContext(TabsContext)
  if (!context) throw new Error('Tab must be used within Tabs')

  return (
    <button className={context.activeTab === id ? 'active' : ''} onClick={() => context.setActiveTab(id)}>
      {children}
    </button>
  )
}
```

## Performance Optimisation

```typescript
// useMemo for expensive computations
const sortedMarkets = useMemo(
  (): Market[] => [...markets].sort((a, b) => b.volume - a.volume),
  [markets]
)

// useCallback for stable function references
const handleSelect = useCallback((id: string): void => {
  selectMarket(id)
}, [selectMarket])

// React.memo for pure components
const MarketCard = React.memo(({ market }: { market: Market }): JSX.Element => (
  <div className="market-card">
    <h3>{market.name}</h3>
  </div>
))

// Lazy loading
const HeavyChart = lazy(() => import('./HeavyChart'))

const Dashboard = (): JSX.Element => (
  <Suspense fallback={<ChartSkeleton />}>
    <HeavyChart />
  </Suspense>
)
```

## Conditional Rendering

```typescript
// PASS: Clear conditions
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}
{data && <DataDisplay data={data} />}

// FAIL: Nested ternaries
{isLoading ? <Spinner /> : error ? <ErrorMessage error={error} /> : <DataDisplay data={data} />}
```

## Accessibility

```typescript
// Keyboard navigation
const handleKeyDown = (e: React.KeyboardEvent): void => {
  if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, options.length - 1)) }
  if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
  if (e.key === 'Enter') { e.preventDefault(); onSelect(options[activeIndex]) }
  if (e.key === 'Escape') setIsOpen(false)
}

// Focus management for modals
const Modal = ({ isOpen, onClose, children }: ModalProps): JSX.Element | null => {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect((): void => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      modalRef.current?.focus()
    } else
      previousFocusRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} onKeyDown={e => e.key === 'Escape' && onClose()}>
      {children}
    </div>
  )
}
```

## Animation

```typescript
import { motion, AnimatePresence } from 'framer-motion'

const AnimatedList = ({ markets }: { markets: Market[] }): JSX.Element => (
  <AnimatePresence>
    {markets.map(market => (
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
```
