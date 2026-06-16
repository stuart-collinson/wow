# Server State — tRPC + TanStack Query

Server state on the frontend lives in **TanStack Query v5**, reached through **tRPC v11's TanStack React Query integration**. This gate owns the client data layer: the per-domain `hooks/` directory shape, stale times, the `<domain>.cache.ts` tunables file, hooks, mutations, polling, pagination, and server-side prefetch. Where this gate and `frontend-patterns` disagree on data fetching, **this gate wins**.

## tRPC *is* TanStack Query — they are not alternatives

tRPC's recommended React integration is the TanStack React Query integration. There is no "tRPC vs TanStack Query" choice to make: tRPC sits on top of TanStack Query and hands you typed factories that TanStack's own hooks consume.

```ts
const trpc = useTRPC()                                   // the typed tRPC proxy (a hook)
const queryClient = useQueryClient()                     // TanStack's client, for cache writes

useQuery(trpc.posts.list.queryOptions({ status: 'active' }))   // tRPC builds the options, TanStack runs the query
useMutation(trpc.posts.create.mutationOptions())               // same for writes
queryClient.invalidateQueries({ queryKey: trpc.posts.pathKey() })  // whole-router prefix key — invalidates every posts.* query
```

What this means in practice:

- **tRPC replaces the network layer.** Your tRPC router (`server/routers/<domain>.ts`, see `backend-patterns`) is the typed client. There is **no** hand-rolled `lib/api/client.ts`, no per-domain `fetch` wrappers, and **no hand-built query-key factories** — tRPC generates the keys for you. Two builders, and the distinction matters: **`trpc.<domain>.<proc>.queryKey(input?)`** is the key for a *single procedure* (`trpc.posts.list.queryKey()`), while **`trpc.<domain>.pathKey()`** is the *whole-router prefix* (`trpc.posts.pathKey()`). `trpc.posts.pathKey()` is a prefix of `trpc.posts.list.queryKey()`, so prefix-invalidation works out of the box. (`pathFilter()` is the matching filter form for the predicate-based query-client methods.) There is **no** `queryKey()` on a non-leaf router node — reaching for `trpc.posts.queryKey()` is a type error; that case is `pathKey()`.
- **TanStack Query owns the cache.** Every discipline below — stale times, surgical cache writes, polling, pagination, prefetch — is a TanStack Query concern, expressed through tRPC's factories.
- **Raw `useQuery` / `useMutation` is still correct for server reads that don't go through tRPC** — a third-party REST API, a direct Supabase call, a signed-URL upload. Those use a plain `queryFn` and live under the same `hooks/<domain>/` shape, sharing the one cache. Don't route them through a parallel fetch wrapper. These *do* need an explicit `queryKey` — there's no tRPC factory to generate one — so keep that key (and its `staleTime`) in the domain's `<domain>.cache.ts`, not hand-rolled inline. The "no hand-built keys" rule is about not re-rolling what tRPC already generates, not a ban on keys for genuinely non-tRPC queries.

Use the **new** integration (`useTRPC()` + `trpc.x.queryOptions()` + `useQuery`), not the classic `trpc.x.useQuery()` proxy. It is tRPC's recommended path and the reason the structure below composes cleanly.

---

## ⬛ The headline gate: every domain has the SAME structure

**This is the most important rule in this gate.** Every server-state domain is laid out identically under `hooks/<domain>/`, and it is non-negotiable:

| File | Holds |
| --- | --- |
| `hooks/<domain>/<domain>.cache.ts` | the domain's **tunables** — stale times, default page sizes, poll intervals, option presets, and any `filters → input` mapper. One per domain, always at the domain root. |
| `hooks/<domain>/use<Domain><Verb>.ts` | every `use*` hook — query, mutation, and domain-specific non-query (selection / upload / editor state) — one export per file. |
| `hooks/<domain>/<sub-resource>/use<Domain><SubVerb>.ts` | hooks grouped under a sub-resource folder when the domain spans many related sub-entities. |

Each of these is a **gate failure**:

- a domain with hooks but no `<domain>.cache.ts` baking its stale times;
- a `staleTime` or page size hard-coded inside a hook instead of imported from the cache file;
- a hand-built query-key array (`['posts', id]`) for a query that *has* a tRPC procedure, instead of `trpc.posts.byId.queryKey({ id })` (or `trpc.posts.pathKey()` for the whole domain);
- an `index.ts` barrel that re-exports the domain's hooks;
- a raw `fetch` / network call living inside a hook for an endpoint that has a tRPC procedure.

## Supporting files (`lib/`)

The domain hooks lean on a small, fixed set of `lib/` files. They are not per-domain — set them up once:

```
lib/
  trpc/
    client.tsx                # 'use client' — TRPCProvider + useTRPC()
    server.tsx                # server tRPC caller + getQueryClient() for RSC prefetch
    query-client.ts           # makeQueryClient() — global TanStack defaults (§2)
  time.ts                     # seconds() / minutes() duration helpers — no bare `60 * 1000`
```

Server-side prefetch lives in the App Router route (`app/<route>/page.tsx`), not in `hooks/` — see §6. There is no per-domain `prefetch*.ts` file.

## The `hooks/` directory — canonical layout

Two kinds of hook live in `hooks/`, and the directory shape tells them apart at a glance:

1. **Cross-cutting hooks** — no single domain (`useDebounce`, `useIsMobile`, a compound-component access hook like `useTabs`). They stay **flat** at the root of `hooks/`, one export per file, with a domain-free name.
2. **Server-state domain hooks** — everything for one backend domain. They live in a **`hooks/<domain>/` folder** once the domain reaches ≈6+ hooks; below that threshold they stay flat with the domain in the filename (`useTagsList.ts`).

A domain folder holds exactly three kinds of thing: the **one** `<domain>.cache.ts` tunables file at the domain root, the `use*` hooks (one export per file), and — only when a domain spans several sub-entities — a sub-folder per sub-resource. Domain-specific **non-query** React hooks (selection, upload, editor state) belong in the domain folder too; the test is *"is it React and about this domain?"*, not *"is it a query?"*.

```
hooks/
├── useDebounce.ts                  # cross-cutting — flat, domain-free name
├── useIsMobile.ts
├── useTabs.ts                      # compound-component access hook (see frontend-patterns)
│
├── posts/                          # simple domain — everything flat inside the folder
│   ├── posts.cache.ts              # THE tunables file — stale times, page sizes, presets, input mappers
│   ├── usePostsList.ts             # one query hook per file
│   ├── usePost.ts
│   ├── usePostsInfinite.ts
│   ├── useCreatePost.ts            # one mutation hook per file
│   ├── useUpdatePost.ts
│   └── useDeletePost.ts
│
└── campaigns/                      # complex domain — sub-resources get their own sub-folders
    ├── campaigns.cache.ts          # cache file ALWAYS at the domain root, never inside a sub-folder
    ├── useCampaignsList.ts
    ├── useCampaign.ts
    ├── useCampaignSelection.ts     # domain-specific NON-query hook — still lives here
    ├── comments/                   # sub-resource sub-folder
    │   ├── useCampaignComments.ts
    │   └── useCreateCampaignComment.ts
    ├── items/
    │   └── useCampaignItems.ts
    └── media/
        └── useCampaignMedia.ts
```

**Naming.** File name === the single export. Query/mutation hooks are `use<Domain><Verb>` — `usePostsList`, `usePost`, `useCreatePost`, `useUpdateCampaignItem`. The cache file is `<domain>.cache.ts` — one name per concept, never `<domain>Keys.ts`, `<domain>Hooks.ts`, or `index.ts`.

**Flat vs folder — the rule.** ≈6+ hooks for one domain → give it a `hooks/<domain>/` folder. Fewer → leave them flat in `hooks/` with the domain in the filename. Don't pre-create a folder for a two-hook domain; don't leave fifteen `useCampaign*.ts` files loose at the root. A sub-resource earns its own sub-folder only when it has its own cluster of hooks (`comments/`, `items/`) — the `<domain>.cache.ts` and any single sub-resource hook stay at the domain root.

**No barrel.** No `index.ts` aggregator anywhere under `hooks/` — consumers import each hook directly: `import { usePostsList } from '@/hooks/posts/usePostsList'`. Barrels invite circular imports, defeat tree-shaking, and pull a whole domain into a test that needs one hook. (A component's own `index.tsx` entry file is a different thing and is fine — see `frontend-patterns`.)

## 1. Server state lives in the cache, not in Zustand

- Anything from the backend lives in the TanStack cache **by default**. Stop hand-rolling `useState` + `useEffect` + `fetch` for server reads.
- Client / UI state — form drafts, toggles, selections, dialog open/closed — stays in component state or a Zustand store. **Never mirror server data into Zustand**; two sources of truth drift. If you genuinely must read server data inside a store action, read it from the cache (`queryClient.getQueryData`) at call time.

## 2. One QueryClient, global defaults in `lib/trpc/query-client.ts`

Create it once via `makeQueryClient()` and reuse the same factory on client and server (the App Router setup wires this for you).

| Option | Value | Rule |
| --- | --- | --- |
| `staleTime` | 30s baseline | Modest floor so RSC-prefetched data isn't refetched instantly on mount. **Every domain query overrides this** in its cache file. |
| `gcTime` | 5m | Global. Domain override only with a documented reason. |
| `refetchOnWindowFocus` | `true` | The freshness mechanism. |
| `retry` (queries) | retry 5xx / network; **no retry on 4xx** | A 404 / 403 should surface immediately, not after three waits. |
| `retry` (mutations) | `false` | User-triggered; never silently retried. |

Mount `<ReactQueryDevtools>` in non-production only.

## 3. `<domain>.cache.ts` — the tunables file

`useTRPC()` is a hook, so the `queryOptions` call itself happens *in* the hook — but the **knobs** that the hook, the prefetch, and any cache write must agree on live here, in one place, as plain values. This is what stops a stale time defined in the list hook from drifting away from the one used in prefetch.

```ts
// hooks/posts/posts.cache.ts
import { keepPreviousData } from '@tanstack/react-query'

import { minutes, seconds } from '@/lib/time'
import type { PostStatus } from '@/types/post.types'

export const STALE_TIMES = { list: minutes(2), detail: seconds(30) } as const

export const POST_LIST_PAGE_SIZE = 25

export type PostListFilters = {
  status?: PostStatus
  search?: string
  cursor?: string
}

// One preset both the hook and prefetch spread, so they can't drift.
export const postListQueryOpts = { staleTime: STALE_TIMES.list, placeholderData: keepPreviousData } as const

// filters → the tRPC procedure's input — defined once, reused by hook and prefetch.
export const toPostListInput = (filters: PostListFilters) => ({
  status: filters.status,
  search: filters.search,
  cursor: filters.cursor,
  limit: POST_LIST_PAGE_SIZE,
})
```

The cache file imports **no React and no `useTRPC`** — it is pure config. Stale times are named constants via `lib/time.ts`, never bare `60 * 1000` (see `coding-standards` → Magic Values).

## 4. Hooks — thin bindings over the tRPC factory

One export per file, file name matches the export. The hook reads the `trpc` proxy, builds the input via the cache file's mapper, and spreads the preset.

```ts
// hooks/posts/usePostsList.ts
import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/lib/trpc/client'
import { postListQueryOpts, toPostListInput, type PostListFilters } from '@/hooks/posts/posts.cache'

export const usePostsList = (filters: PostListFilters) => {
  const trpc = useTRPC()
  return useQuery(trpc.posts.list.queryOptions(toPostListInput(filters), postListQueryOpts))
}
```

```ts
// hooks/posts/usePost.ts — gate a query on an absent input with skipToken, not enabled:false
import { skipToken, useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/lib/trpc/client'
import { STALE_TIMES } from '@/hooks/posts/posts.cache'

export const usePost = (id: string | undefined) => {
  const trpc = useTRPC()
  return useQuery(
    trpc.posts.byId.queryOptions(id ? { id } : skipToken, { staleTime: STALE_TIMES.detail }),
  )
}
```

- **`skipToken`** is the type-safe way to disable a query whose input isn't ready — it keeps `data` correctly typed where `enabled: false` would not.
- The hook returns the raw `useQuery` result. Consumers read `data` / `isLoading` / `error` and handle all three states (see `frontend-patterns` → Loading, Empty, Error). Don't rename `data` to `posts` inside the hook.

## 5. Mutations — update what you know, invalidate what you don't

Default to **surgical cache writes**, not blanket invalidate-then-refetch. Use `useQueryClient()` with `trpc.x.queryKey(input?)` (a single procedure) or `trpc.<domain>.pathKey()` (a whole router) for the keys.

```ts
// hooks/posts/useUpdatePost.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useTRPC } from '@/lib/trpc/client'

export const useUpdatePost = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  return useMutation(
    trpc.posts.update.mutationOptions({
      onSuccess: (post) => {
        queryClient.setQueryData(trpc.posts.byId.queryKey({ id: post.id }), post)
        queryClient.invalidateQueries({ queryKey: trpc.posts.list.queryKey() })
      },
    }),
  )
}
```

- **Update:** server returns the entity → `setQueryData` the detail, invalidate (or patch) the lists.
- **Remove:** `removeQueries` the detail + patch the row out of cached lists.
- **Invalidate** only what the response *doesn't* tell you (derived counts, audit logs). Fall back to invalidate when the response is too thin to patch.
- **`retry: false`** is the global default. On error, surface it — a toast (`sonner`) or inline message — and leave the cache untouched.

### Optimistic updates — opt-in, with a rollback path

Use the cancel → snapshot → set → rollback → settle shape. Scope it as narrow as the mutation allows.

```ts
trpc.posts.toggleFavourite.mutationOptions({
  onMutate: async ({ id, favourited }) => {
    const key = trpc.posts.list.queryKey()
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData(key)
    queryClient.setQueryData(key, (old) =>
      old?.map((post) => (post.id === id ? { ...post, favourited } : post)),
    )
    return { previous }
  },
  onError: (_err, _input, context) => {
    if (context?.previous) queryClient.setQueryData(trpc.posts.list.queryKey(), context.previous)
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.posts.list.queryKey() }),
})
```

Don't reach for optimistic updates on destructive mutations (delete, archive) where a revert is jarring, or where the server result isn't predictable (a server-assigned id). Show a normal pending state there. For client-only optimism not backed by the cache, React 19's `useOptimistic` is lighter (see `frontend-patterns`).

## 5a. Polling with `refetchInterval`

Some queries track an async server process (rendering, syncing, analysing) and must poll until a terminal state.

```ts
// hooks/jobs/useJob.ts
import { skipToken, useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/lib/trpc/client'
import type { Job } from '@/types/job.types'

const POLL_INTERVAL_MS = 3_000

const shouldPoll = (job: Job | undefined): boolean =>
  job?.status === 'pending' || job?.status === 'processing'

export const useJob = (id: string | undefined) => {
  const trpc = useTRPC()
  return useQuery(
    trpc.jobs.byId.queryOptions(id ? { id } : skipToken, {
      refetchInterval: (query) => (shouldPoll(query.state.data) ? POLL_INTERVAL_MS : false),
    }),
  )
}
```

- **Callback form, not a bare number** — poll only while data shows an in-progress state; stop on terminal state or absent data.
- **Named constant for the interval.** No magic numbers.
- **Cap the poll** with a terminal-state condition (or a time bound). A poll that can run forever is a bug.
- Only async jobs, OAuth/sync flows, and analysis pipelines warrant polling. For anything else, prefer realtime or explicit refresh.

## 6. Lists, pagination & server-side prefetch

### Cursor pagination with `useInfiniteQuery`

Prefer cursor / keyset pagination over offset. The procedure returns `{ items, nextCursor }`; `nextCursor: null` means no more pages.

```ts
// hooks/posts/usePostsInfinite.ts
import { useInfiniteQuery } from '@tanstack/react-query'

import { useTRPC } from '@/lib/trpc/client'
import { POST_LIST_PAGE_SIZE, type PostListFilters } from '@/hooks/posts/posts.cache'

export const usePostsInfinite = (filters: PostListFilters) => {
  const trpc = useTRPC()
  return useInfiniteQuery(
    trpc.posts.list.infiniteQueryOptions(
      { status: filters.status, search: filters.search, limit: POST_LIST_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
    ),
  )
}
```

For page-at-a-time lists, use `useQuery` with `placeholderData: keepPreviousData` (already in `postListQueryOpts`) so a page change doesn't flash a skeleton, and gate the "next" affordance on `!isPlaceholderData` and on a non-null cursor.

### View state in the URL

Filters, search, and cursor live in the URL (`useSearchParams` / `useRouter` from `next/navigation`, or `nuqs`), not component state — so a page is shareable and back/forward work. Debounced text inputs keep a local draft and write the URL on settle; a filter or search change **clears the cursor** (it resets pagination).

### Server-side prefetch — App Router RSC + hydration

This replaces any client-side "bootstrap prefetch registry". Prefetch in the Server Component, dehydrate, and hydrate the client cache — the client hook then reads warm data with no spinner. Reuse the cache file's input mapper and stale time so the warmed key is exactly the one the hook reads.

```tsx
// app/posts/page.tsx — Server Component
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { getQueryClient, trpc } from '@/lib/trpc/server'
import { STALE_TIMES, toPostListInput } from '@/hooks/posts/posts.cache'
import { PostsList } from '@/components/Post/PostsList'

const PostsPage = async () => {
  const queryClient = getQueryClient()
  void queryClient.prefetchQuery(
    trpc.posts.list.queryOptions(toPostListInput({}), { staleTime: STALE_TIMES.list }),
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostsList />
    </HydrationBoundary>
  )
}

export default PostsPage
```

Prefetch is opportunistic: don't block the page on it (`void` the promise), and only prefetch what the user lands on. Route-hover prefetch is a separate concern at the `<Link>` level.

## 7. Comments & style

Carries the universal `coding-standards` comment rule, held to a harder bar in this layer — **default to ZERO comments**:

- **`use<Domain><Verb>.ts` hooks: zero comments.** They are plumbing — a `useQuery` / `useMutation` spreading a factory. There is nothing non-obvious to explain.
- **`<domain>.cache.ts` is the one place a comment is sanctioned**, and only for non-obvious cache reasoning ("invalidate rather than patch — cursor pagination can't place the new row", "list filters must match the page defaults"). If the *why* is obvious from the code, no comment.
- No `as any` to read error fields — type the error or narrow it.

---

## Adopt on a new domain — checklist

1. **Procedures →** add them to your tRPC router `server/routers/<domain>.ts` (see `backend-patterns`). This is the network + type layer; there is no separate client fetcher.
2. **Cache config →** `hooks/<domain>/<domain>.cache.ts` — `STALE_TIMES`, page sizes, poll intervals, option presets, and the `filters → input` mapper. Pure config, no React.
3. **Hooks →** `hooks/<domain>/use<Domain><Verb>.ts`, one export per file, spreading `trpc.<domain>.<proc>.queryOptions(...)` / `.mutationOptions(...)`. Gate absent inputs with `skipToken`.
4. **Mutations →** surgical `setQueryData(trpc.x.queryKey(...), …)` for what the response tells you; `invalidateQueries({ queryKey: trpc.x.queryKey() })` (or `trpc.<domain>.pathKey()` to clear the whole domain) for what it doesn't.
5. **Polling →** `refetchInterval` callback in the hook (not the cache file) if any query tracks an async process. Name the interval; cap the poll.
6. **Pagination →** `useInfiniteQuery` + `infiniteQueryOptions` for cursors, or `useQuery` + `keepPreviousData` for pages. View state in the URL.
7. **Prefetch →** warm the landing query in the route's Server Component with `prefetchQuery` + `<HydrationBoundary>`, reusing the cache file's mapper + stale time.
8. **Folder vs flat:** ≈6+ hooks → own `hooks/<domain>/` folder; fewer → flat in `hooks/`. No `index.ts` barrel either way.
9. **Non-tRPC reads** (third-party REST, direct Supabase, uploads) → raw `useQuery` / `useMutation` with a `queryFn`, same folder shape, same cache.
