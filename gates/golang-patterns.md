# Go Development Patterns

Idiomatic Go patterns and best practices for building robust, efficient, and maintainable applications.

## Core Principles

1. **Simplicity and Clarity** — Code should be obvious and easy to read. Favour clear over clever.
2. **Make the Zero Value Useful** — Design types so their zero value is immediately usable without initialization.
3. **Accept Interfaces, Return Structs** — Functions should accept interface parameters and return concrete types.

```go
// PASS: Clear and direct
func GetUser(id string) (*User, error) {
    user, err := db.FindUser(id)
    if err != nil {
        return nil, fmt.Errorf("get user %s: %w", id, err)
    }
    return user, nil
}

// FAIL: Overly clever
func GetUser(id string) (*User, error) {
    return func() (*User, error) {
        if u, e := db.FindUser(id); e == nil {
            return u, nil
        } else {
            return nil, e
        }
    }()
}
```

## Error Handling

### Error Wrapping with Context

```go
func LoadConfig(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("load config %s: %w", path, err)
    }

    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse config %s: %w", path, err)
    }

    return &cfg, nil
}
```

### Custom Error Types

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Message)
}

var (
    ErrNotFound     = errors.New("resource not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrInvalidInput = errors.New("invalid input")
)
```

### errors.Is and errors.As

```go
func HandleError(err error) {
    if errors.Is(err, sql.ErrNoRows) {
        log.Println("No records found")
        return
    }

    var validationErr *ValidationError
    if errors.As(err, &validationErr) {
        log.Printf("Validation error on field %s: %s", validationErr.Field, validationErr.Message)
        return
    }

    log.Printf("Unexpected error: %v", err)
}
```

### Never Ignore Errors

```go
// FAIL: Ignoring error
result, _ := doSomething()

// PASS: Handle it
result, err := doSomething()
if err != nil {
    return err
}
```

## Concurrency Patterns

### Worker Pool

```go
func WorkerPool(jobs <-chan Job, results chan<- Result, numWorkers int) {
    var wg sync.WaitGroup

    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {
                results <- process(job)
            }
        }()
    }

    wg.Wait()
    close(results)
}
```

### Context for Cancellation and Timeouts

```go
func FetchWithTimeout(ctx context.Context, url string) ([]byte, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, fmt.Errorf("create request: %w", err)
    }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("fetch %s: %w", url, err)
    }
    defer resp.Body.Close()

    return io.ReadAll(resp.Body)
}
```

### Graceful Shutdown

```go
func GracefulShutdown(server *http.Server) {
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        log.Fatalf("Server forced to shutdown: %v", err)
    }
}
```

### errgroup for Coordinated Goroutines

```go
func FetchAll(ctx context.Context, urls []string) ([][]byte, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([][]byte, len(urls))

    for i, url := range urls {
        i, url := i, url // Capture loop variables
        g.Go(func() error {
            data, err := FetchWithTimeout(ctx, url)
            if err != nil {
                return err
            }
            results[i] = data
            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err
    }
    return results, nil
}
```

### Avoiding Goroutine Leaks

```go
// FAIL: Goroutine leak if no receiver
func leakyFetch(ctx context.Context, url string) <-chan []byte {
    ch := make(chan []byte)
    go func() {
        data, _ := fetch(url)
        ch <- data // Blocks forever if no receiver
    }()
    return ch
}

// PASS: Buffered channel + context cancellation
func safeFetch(ctx context.Context, url string) <-chan []byte {
    ch := make(chan []byte, 1)
    go func() {
        data, err := fetch(url)
        if err != nil {
            return
        }
        select {
        case ch <- data:
        case <-ctx.Done():
        }
    }()
    return ch
}
```

## Interface Design

### Small, Focused Interfaces

```go
// PASS: Single-method interfaces composed as needed
type Reader interface { Read(p []byte) (n int, err error) }
type Writer interface { Write(p []byte) (n int, err error) }
type Closer interface { Close() error }

type ReadWriteCloser interface {
    Reader
    Writer
    Closer
}
```

### Define Interfaces Where They're Used

```go
// In the consumer package, not the provider
package service

type UserStore interface {
    GetUser(id string) (*User, error)
    SaveUser(user *User) error
}
```

### Optional Behaviour with Type Assertions

```go
func WriteAndFlush(w io.Writer, data []byte) error {
    if _, err := w.Write(data); err != nil {
        return err
    }

    if f, ok := w.(Flusher); ok {
        return f.Flush()
    }
    return nil
}
```

## Package Organization

### Standard Project Layout

```
myproject/
├── cmd/
│   └── myapp/
│       └── main.go
├── internal/
│   ├── handler/
│   ├── service/
│   ├── repository/
│   └── config/
├── pkg/
│   └── client/
├── api/
│   └── v1/
├── testdata/
├── go.mod
└── Makefile
```

### Avoid Package-Level State

```go
// FAIL: Global mutable state
var db *sql.DB
func init() { db, _ = sql.Open("postgres", os.Getenv("DATABASE_URL")) }

// PASS: Dependency injection
type Server struct { db *sql.DB }
func NewServer(db *sql.DB) *Server { return &Server{db: db} }
```

## Struct Design

### Functional Options Pattern

```go
type Option func(*Server)

func WithTimeout(d time.Duration) Option {
    return func(s *Server) { s.timeout = d }
}

func NewServer(addr string, opts ...Option) *Server {
    s := &Server{
        addr:    addr,
        timeout: 30 * time.Second,
        logger:  log.Default(),
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}

server := NewServer(":8080",
    WithTimeout(60*time.Second),
    WithLogger(customLogger),
)
```

### Embedding for Composition

```go
type Logger struct{ prefix string }
func (l *Logger) Log(msg string) { fmt.Printf("[%s] %s\n", l.prefix, msg) }

type Server struct {
    *Logger
    addr string
}

s := NewServer(":8080")
s.Log("Starting...") // Calls embedded Logger.Log
```

## Memory and Performance

### Preallocate Slices

```go
// FAIL: Grows slice multiple times
var results []Result
for _, item := range items {
    results = append(results, process(item))
}

// PASS: Single allocation
results := make([]Result, 0, len(items))
for _, item := range items {
    results = append(results, process(item))
}
```

### sync.Pool for Frequent Allocations

```go
var bufferPool = sync.Pool{
    New: func() interface{} { return new(bytes.Buffer) },
}

func ProcessRequest(data []byte) []byte {
    buf := bufferPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufferPool.Put(buf)
    }()
    buf.Write(data)
    return buf.Bytes()
}
```

### String Building in Loops

```go
// FAIL: Many allocations
var result string
for _, p := range parts { result += p + "," }

// PASS
var sb strings.Builder
for i, p := range parts {
    if i > 0 { sb.WriteString(",") }
    sb.WriteString(p)
}

// BEST: Use standard library
return strings.Join(parts, ",")
```

## Anti-Patterns to Avoid

```go
// FAIL: Panic for control flow
func GetUser(id string) *User {
    user, err := db.Find(id)
    if err != nil {
        panic(err)
    }
    return user
}

// FAIL: Context in struct
type Request struct {
    ctx context.Context // Context should be first param, not stored
    ID  string
}

// PASS: Context as first parameter
func ProcessRequest(ctx context.Context, id string) error { }

// FAIL: Mixing value and pointer receivers — pick one and be consistent
func (c Counter) Value() int { return c.n }
func (c *Counter) Increment() { c.n++ }
```

## Go Idioms Quick Reference

| Idiom | Description |
|-------|-------------|
| Accept interfaces, return structs | Functions accept interface params, return concrete types |
| Errors are values | Treat errors as first-class values, not exceptions |
| Don't communicate by sharing memory | Use channels for coordination between goroutines |
| Make the zero value useful | Types should work without explicit initialization |
| Clear is better than clever | Prioritise readability over cleverness |
| Return early | Handle errors first, keep happy path unindented |
| gofmt is no one's favourite but everyone's friend | Always format with gofmt/goimports |

## Essential Commands

```bash
go build ./...
go test ./...
go test -race ./...
go test -cover ./...
go vet ./...
go mod tidy
gofmt -w .
```
