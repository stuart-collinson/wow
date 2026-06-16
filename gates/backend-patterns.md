# Backend Development Patterns

Backend patterns for a **Next.js (App Router) + TypeScript** application whose typed API layer is **tRPC** — the same tRPC the `tanstack-query` gate consumes on the client. tRPC is the contract: a procedure's input/output types *are* the client's types, so there is no hand-written API schema and no REST fetcher for app data (see `tanstack-query`).

These patterns are **data-source-agnostic**. A Next.js app may have no database at all (a procedure computes a result, calls a third-party API, or reads a file), may talk to an external service, or may own a database (Postgres / Supabase / etc.). Where a rule only applies once you *have* a database, it says so — don't add a database, an ORM, or a repository layer until the app needs one.

## API Design — tRPC router & procedures

App data flows through tRPC procedures, not hand-rolled REST endpoints. A domain is a router of procedures (`query` for reads, `mutation` for writes) with Zod-validated input; the procedure's return type becomes the client's type for free.

```typescript
// server/trpc.ts — init once; context resolves the caller (see Authentication)
import { initTRPC } from '@trpc/server'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
```

```typescript
// server/routers/markets.ts — one router per domain; procedures stay thin
import { z } from 'zod'
import { router, publicProcedure } from '@/server/trpc'

export const marketsRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(['active', 'resolved', 'closed']).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),                 // cursor, not offset — see below
    }))
    .query(({ input, ctx }) => ctx.markets.list(input)),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input, ctx }) => ctx.markets.byId(input.id)),

  create: publicProcedure
    .input(createMarketSchema)
    .mutation(({ input, ctx }) => ctx.markets.create(input)),
})
```

```typescript
// server/routers/_app.ts — the root router; its type is the whole client contract
import { router } from '@/server/trpc'
import { marketsRouter } from '@/server/routers/markets'

export const appRouter = router({ markets: marketsRouter })
export type AppRouter = typeof appRouter
```

Mount it once as an App Router route handler with the fetch adapter:

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { createTRPCContext } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  })

export { handler as GET, handler as POST }
```

- **Procedures stay thin.** Validate input with Zod, then delegate to a service. No business logic and no data access inline in the procedure.
- **Cursor pagination, not offset.** A list procedure takes a `cursor` and returns `{ items, nextCursor }` (`nextCursor: null` = last page) — the exact shape `useInfiniteQuery` consumes in `tanstack-query`. Offset (`limit=20&offset=40`) re-scans skipped rows and double-counts or drops rows under concurrent writes; reach for it only for a fixed, small, rarely-changing set. The keyset mechanics live in the service / repository below.
- **REST route handlers still have their place** — webhooks, OAuth callbacks, public or third-party-facing endpoints, file streaming — as App Router route handlers (`app/api/<name>/route.ts`). What they are *not* for is your own app's data layer; that is tRPC.

## Service & data-access layer

### Service layer & (optional) repository

Business logic lives in a **service**; the procedure just validates and delegates. *If* the app has a database, the service reaches it through a **repository** that abstracts the data source — so Supabase can be swapped for Prisma / Drizzle / a remote API without touching the service. A database-less app skips the repository entirely: the service computes the result or calls a third-party API directly.

```typescript
// the data-access contract — what, not how. type, not interface.
type MarketRepository = {
  list: (input: MarketListInput) => Promise<{ items: Market[]; nextCursor: string | null }>
  byId: (id: string) => Promise<Market | null>
  create: (data: CreateMarketDto) => Promise<Market>
}

// example: a Supabase-backed implementation — ONE option, not a requirement.
// Could equally be Prisma, Drizzle, a REST client, or omitted if the app has no DB.
class SupabaseMarketRepository implements MarketRepository {
  list = async ({ status, limit, cursor }: MarketListInput) => {
    let query = supabase.from('markets').select('id, name, status, volume').order('id').limit(limit + 1)
    if (status) query = query.eq('status', status)
    if (cursor) query = query.gt('id', cursor)              // keyset seek, not offset

    const { data, error } = await query
    if (error) throw new ApiError(500, error.message)

    const items = data.slice(0, limit)                      // fetched limit + 1; the extra row signals "more"
    const nextCursor = data.length > limit ? items.at(-1)!.id : null
    return { items, nextCursor }
  }
  // byId, create …
}
```

The service holds the logic that isn't a single data call — composition, fan-out, ranking, calling other services:

```typescript
class MarketService {
  constructor(private marketRepo: MarketRepository) {}

  searchMarkets = async (query: string, limit = 10): Promise<Market[]> => {
    const embedding = await generateEmbedding(query)
    const results = await this.vectorSearch(embedding, limit)
    const markets = await this.marketRepo.findByIds(results.map(r => r.id))

    return markets.sort((a, b) => {
      const scoreA = results.find(r => r.id === a.id)?.score || 0
      const scoreB = results.find(r => r.id === b.id)?.score || 0
      return scoreA - scoreB
    })
  }
}
```

### Auth — a tRPC middleware (`protectedProcedure`)

For tRPC, authentication is a **middleware** that runs before the resolver and narrows the context — not a per-handler wrapper. Build a `protectedProcedure` once and use it for every authed procedure; the resolver then reads `ctx.user` with a non-null type.

```typescript
// server/trpc.ts
import { TRPCError } from '@trpc/server'

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user } })   // user is non-null downstream
})
```

The bearer token is verified once in `createTRPCContext`, which puts `user` on the context (see Authentication below). A non-tRPC route handler (a webhook, an upload) guards itself with `requireAuth(request)` instead.

## Database Patterns

> Applies only when your app owns a database. A database-less Next.js app (no DB, or only a third-party API) skips this section. The examples use Supabase, but the principles — select only what you need, batch to avoid N+1, wrap multi-step writes in a transaction — hold for any SQL data source.

### Query Optimisation

```typescript
// PASS: Select only needed columns
const { data } = await supabase
  .from('markets')
  .select('id, name, status, volume')
  .eq('status', 'active')
  .order('volume', { ascending: false })
  .limit(10)

// FAIL: Select everything
const { data } = await supabase.from('markets').select('*')
```

### N+1 Query Prevention

```typescript
// FAIL: N+1 — one query per market
const markets = await getMarkets()
for (const market of markets) {
  market.creator = await getUser(market.creator_id)
}

// PASS: Batch fetch
const markets = await getMarkets()
const creatorIds = markets.map(m => m.creator_id)
const creators = await getUsers(creatorIds)
const creatorMap = new Map(creators.map(c => [c.id, c]))

markets.forEach(market => {
  market.creator = creatorMap.get(market.creator_id)
})
```

### Transaction Pattern

```typescript
const createMarketWithPosition = async (
  marketData: CreateMarketDto,
  positionData: CreatePositionDto
): Promise<unknown> => {
  const { data, error } = await supabase.rpc('create_market_with_position', {
    market_data: marketData,
    position_data: positionData,
  })

  if (error) throw new Error('Transaction failed')
  return data
}
```

## Caching Strategies

### Redis Cache-Aside

```typescript
class CachedMarketRepository implements MarketRepository {
  constructor(
    private baseRepo: MarketRepository,
    private redis: RedisClient
  ) {}

  findById = async (id: string): Promise<Market | null> => {
    const cached = await this.redis.get(`market:${id}`)

    if (cached) return JSON.parse(cached)

    const market = await this.baseRepo.findById(id)

    if (market) await this.redis.setex(`market:${id}`, 300, JSON.stringify(market))

    return market
  }

  invalidateCache = async (id: string): Promise<void> => {
    await this.redis.del(`market:${id}`)
  }
}
```

## Error Handling

tRPC procedures signal failure by throwing `TRPCError` (`code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'BAD_REQUEST' | …`); tRPC's `errorFormatter` shapes the wire response once (attach a Zod `flatten()` there so the client gets typed field errors). The handler below is for any **non-tRPC route handlers** (webhooks, uploads, public endpoints).

### Centralised Error Handler

```typescript
// ApiError extends Error — class extending is the valid exception to the no-interface rule
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message)
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

export const errorHandler = (error: unknown): Response => {
  if (error instanceof ApiError)
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })

  if (error instanceof z.ZodError)
    return NextResponse.json({ success: false, error: 'Validation failed', details: error.errors }, { status: 400 })

  console.error('Unexpected error:', error)
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
}
```

### Retry with Exponential Backoff

```typescript
const MAX_RETRIES = 3

const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    if (retries <= 0) throw error
    const delay = Math.pow(2, MAX_RETRIES - retries) * 1000
    await new Promise(resolve => setTimeout(resolve, delay))
    return fetchWithRetry(fn, retries - 1)
  }
}
```

## Authentication & Authorization

### JWT Token Validation

```typescript
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
  } catch {
    throw new ApiError(401, 'Invalid token')
  }
}

export const requireAuth = async (request: Request): Promise<JWTPayload> => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')
  return verifyToken(token)
}
```

### Role-Based Access Control

```typescript
type Permission = 'read' | 'write' | 'delete' | 'admin'

type UserRole = 'admin' | 'moderator' | 'user'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['read', 'write', 'delete', 'admin'],
  moderator: ['read', 'write', 'delete'],
  user: ['read', 'write'],
}

export const hasPermission = (user: User, permission: Permission): boolean =>
  ROLE_PERMISSIONS[user.role].includes(permission)

export const requirePermission = (permission: Permission) =>
  (handler: (request: Request, user: User) => Promise<Response>) =>
    async (request: Request): Promise<Response> => {
      const user = await requireAuth(request)
      if (!hasPermission(user, permission)) throw new ApiError(403, 'Insufficient permissions')
      return handler(request, user)
    }
```

## Rate Limiting

```typescript
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 100

class RateLimiter {
  private requests = new Map<string, number[]>()

  checkLimit = async (identifier: string, max = RATE_LIMIT_MAX_REQUESTS, windowMs = RATE_LIMIT_WINDOW_MS): Promise<boolean> => {
    const now = Date.now()
    const recent = (this.requests.get(identifier) || []).filter(t => now - t < windowMs)

    if (recent.length >= max) return false

    recent.push(now)
    this.requests.set(identifier, recent)
    return true
  }
}
```

## Structured Logging

```typescript
type LogLevel = 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

class Logger {
  log = (level: LogLevel, message: string, context?: LogContext): void => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }))
  }

  info = (message: string, context?: LogContext): void => this.log('info', message, context)

  error = (message: string, error: Error, context?: LogContext): void =>
    this.log('error', message, { ...context, error: error.message, stack: error.stack })
}
```
