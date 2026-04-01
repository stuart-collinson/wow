# Security Patterns & Checklist

Security best practices, vulnerability patterns, and pre-deployment checklist for web applications.

## Secrets Management

```typescript
// FAIL: Hardcoded secrets
const apiKey = "sk-proj-xxxxx"
const dbPassword = "password123"

// PASS: Environment variables
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
```

**Checklist:**
- [ ] No hardcoded API keys, tokens, or passwords
- [ ] All secrets in environment variables
- [ ] `.env.local` in .gitignore
- [ ] No secrets in git history
- [ ] Production secrets in hosting platform (Vercel, Railway)

## Input Validation

```typescript
// PASS: Zod schema validation
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
})

type CreateUserInput = z.infer<typeof createUserSchema>

export const createUser = async (input: unknown): Promise<{ success: boolean; errors?: z.ZodIssue[] }> => {
  try {
    const validated = createUserSchema.parse(input)
    await db.users.create(validated)
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, errors: error.errors }
    throw error
  }
}
```

```typescript
// File upload validation
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif']

const validateFileUpload = (file: File): void => {
  if (file.size > MAX_FILE_SIZE) throw new Error('File too large (max 5MB)')
  if (!ALLOWED_MIME_TYPES.includes(file.type)) throw new Error('Invalid file type')
}
```

**Checklist:**
- [ ] All user inputs validated with Zod schemas
- [ ] File uploads restricted (size, type, extension)
- [ ] No direct use of user input in queries
- [ ] Whitelist validation (not blacklist)
- [ ] Error messages don't leak sensitive info

## SQL Injection Prevention

```typescript
// FAIL: String concatenation
const query = `SELECT * FROM users WHERE email = '${userEmail}'`

// PASS: Parameterized queries
const { data } = await supabase.from('users').select('*').eq('email', userEmail)

// Or raw SQL
await db.query('SELECT * FROM users WHERE email = $1', [userEmail])
```

**Checklist:**
- [ ] All database queries use parameterized queries
- [ ] No string concatenation in SQL
- [ ] ORM/query builder used correctly

## Authentication & Authorization

```typescript
// FAIL: localStorage (vulnerable to XSS)
localStorage.setItem('token', token)

// PASS: httpOnly cookies
res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`)
```

```typescript
// Always verify authorization before sensitive operations
export const deleteUser = async (userId: string, requesterId: string): Promise<Response> => {
  const requester = await db.users.findUnique({ where: { id: requesterId } })

  if (requester.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  await db.users.delete({ where: { id: userId } })
  return NextResponse.json({ success: true })
}
```

```sql
-- Row Level Security in Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own data" ON users FOR UPDATE USING (auth.uid() = id);
```

**Checklist:**
- [ ] Tokens in httpOnly cookies (not localStorage)
- [ ] Authorization checks before sensitive operations
- [ ] Row Level Security enabled in Supabase
- [ ] Role-based access control implemented
- [ ] Session management secure

## XSS Prevention

```typescript
// PASS: Sanitize user-provided HTML
import DOMPurify from 'isomorphic-dompurify'

const renderUserContent = (html: string): JSX.Element => {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p'],
    ALLOWED_ATTR: [],
  })
  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}
```

```typescript
// Content Security Policy
const SECURITY_HEADERS = [{
  key: 'Content-Security-Policy',
  value: `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://api.example.com;
  `.replace(/\s{2,}/g, ' ').trim(),
}]
```

**Checklist:**
- [ ] User-provided HTML sanitized
- [ ] CSP headers configured
- [ ] React's built-in XSS protection used

## CSRF Protection

```typescript
export const POST = async (request: Request): Promise<Response> => {
  const token = request.headers.get('X-CSRF-Token')
  if (!csrf.verify(token))
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })

  // process request
}
```

## Rate Limiting

```typescript
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 100
const SEARCH_RATE_LIMIT_MAX = 10

const limiter = rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX, message: 'Too many requests' })
const searchLimiter = rateLimit({ windowMs: 60_000, max: SEARCH_RATE_LIMIT_MAX, message: 'Too many search requests' })
```

**Checklist:**
- [ ] Rate limiting on all API endpoints
- [ ] Stricter limits on expensive/search operations
- [ ] IP-based and user-based rate limiting

## Sensitive Data Exposure

```typescript
// FAIL: Logging sensitive data
console.log('User login:', { email, password })

// PASS: Redact sensitive fields
console.log('User login:', { email, userId })

// FAIL: Exposing internal error details to client
catch (error) {
  return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
}

// PASS: Generic client message, full details in server log
catch (error) {
  console.error('Internal error:', error)
  return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
}
```

**Checklist:**
- [ ] No passwords, tokens, or secrets in logs
- [ ] Error messages generic for users
- [ ] Detailed errors only in server logs
- [ ] No stack traces exposed to users

## Vulnerable Code Patterns — Flag Immediately

| Pattern | Severity | Fix |
|---------|----------|-----|
| Hardcoded secrets | CRITICAL | Use `process.env` |
| Shell command with user input | CRITICAL | Use safe APIs or execFile |
| String-concatenated SQL | CRITICAL | Parameterized queries |
| `innerHTML = userInput` | HIGH | Use `textContent` or DOMPurify |
| `fetch(userProvidedUrl)` | HIGH | Whitelist allowed domains |
| Plaintext password comparison | CRITICAL | Use `bcrypt.compare()` |
| No auth check on route | CRITICAL | Add authentication middleware |
| Balance check without lock | CRITICAL | Use `FOR UPDATE` in transaction |
| No rate limiting | HIGH | Add rate limiter |
| Logging passwords/secrets | MEDIUM | Sanitize log output |

## Pre-Deployment Security Checklist

- [ ] **Secrets**: No hardcoded secrets, all in env vars
- [ ] **Input Validation**: All user inputs validated with Zod
- [ ] **SQL Injection**: All queries parameterized
- [ ] **XSS**: User content sanitized
- [ ] **CSRF**: Protection enabled
- [ ] **Authentication**: Proper token handling
- [ ] **Authorization**: Role checks in place
- [ ] **Rate Limiting**: Enabled on all endpoints
- [ ] **HTTPS**: Enforced in production
- [ ] **Security Headers**: CSP, X-Frame-Options configured
- [ ] **Error Handling**: No sensitive data in errors
- [ ] **Logging**: No sensitive data logged
- [ ] **Dependencies**: Up to date, no vulnerabilities (`npm audit`)
- [ ] **Row Level Security**: Enabled in Supabase
- [ ] **CORS**: Properly configured
- [ ] **File Uploads**: Validated (size, type)

## Common False Positives

- Environment variables in `.env.example` (not actual secrets)
- Test credentials in test files (if clearly marked)
- Public API keys (if actually meant to be public)
- SHA256/MD5 used for checksums (not passwords)
