# Backend Development Patterns

Backend architecture patterns and best practices for scalable server-side Next.js / TypeScript applications.

## API Design Patterns

### RESTful API Structure

```typescript
// PASS: Resource-based URLs
GET    /api/markets
GET    /api/markets/:id
POST   /api/markets
PUT    /api/markets/:id
PATCH  /api/markets/:id
DELETE /api/markets/:id

// PASS: Query parameters for filtering, sorting, pagination
GET /api/markets?status=active&sort=volume&limit=20&offset=0
```

### Repository Pattern

```typescript
// type, not interface — implements still works with type in TS
type MarketRepository = {
  findAll: (filters?: MarketFilters) => Promise<Market[]>
  findById: (id: string) => Promise<Market | null>
  create: (data: CreateMarketDto) => Promise<Market>
  update: (id: string, data: UpdateMarketDto) => Promise<Market>
  delete: (id: string) => Promise<void>
}

class SupabaseMarketRepository implements MarketRepository {
  findAll = async (filters?: MarketFilters): Promise<Market[]> => {
    let query = supabase.from('markets').select('*')

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.limit) query = query.limit(filters.limit)

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data
  }
}
```

### Service Layer Pattern

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

### Middleware Pattern

```typescript
export const withAuth = (handler: NextApiHandler): NextApiHandler =>
  async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const user = await verifyToken(token)
      req.user = user
      return handler(req, res)
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
```

## Database Patterns

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
