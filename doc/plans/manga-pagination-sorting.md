# Plan: pagination & sorting for manga listing endpoints

Status: **draft, not started**. Written to be picked up by another agent/session later.

## Problem

`GET /manga` (DB-backed listing) and `GET /manga/search` (AniList-backed search)
currently return **every matching row in one response, with no page/limit control
and no server-side ordering**:

- `MangaApiGroup.listMangas` (`api/src/domain/manga/manga.group.ts:16-19`) has no
  `.setUrlParams(...)` at all. `MangaService.listMangas`
  (`api/src/domain/manga/manga.service.ts:98-142`) calls
  `db.query.mangas.findMany({ with: {...} })` with no `limit`/`offset`/`orderBy` —
  it loads the whole `mangas` table every time.
- `MangaApiGroup.searchManga` only accepts `q`
  (`SearchMangaParams = Schema.Struct({ q: Schema.NonEmptyTrimmedString })`,
  `manga.group.ts:12`). `MangaProviderService.searchMedia`
  (`api/src/domain/mangaProvider/mangaProvider.service.ts:263-318`) calls AniList's
  GraphQL `Page` query with `page: 1` hardcoded in the query string and
  `perPage: 20` hardcoded in the call site (`mangaProvider.service.ts:268`) — never
  exposed to the caller. AniList's `Page.media` also supports a `sort` argument
  that isn't used at all today.
- There is no `manga.repository.ts` / `manga.schema.ts` — DB access lives directly
  in `manga.service.ts`, query-param validation lives directly in `manga.group.ts`
  as Effect `Schema.Struct`.

This is a safety net for scale, not a response to an existing bug: today's table
is small, but nothing stops it from growing without bound.

Separately, ordering is currently a **frontend** responsibility:
`web/src/components/domain/home/use-browse-filters.ts:105-120` fetches the full
`useMangaList()` result and sorts it client-side by `score`, `year-desc`,
`year-asc`, `title`, or `chapters` (`SortKey`, imported from `filter-bar.tsx`).
The user wants sorting-by-release-date (`publishedAt`) to become the backend's
job instead.

## Goals

1. Add classic page-based pagination (`page`, `limit`) to `GET /manga` and
   `GET /manga/search`, as a hard safety net (server always caps how many rows
   it can return in one call).
2. Add optional server-side sorting by `publishedAt` (release date) to both
   endpoints, so the frontend is no longer the one deciding order.
3. Keep both params **optional with sane defaults** — this is additive
   hardening, not a mandatory UI rewrite in the same change.

## Non-goals (explicitly out of scope for this refactor)

- Rebuilding the browse UI (`browse-section.tsx`, `use-browse-filters.ts`,
  `filter-bar.tsx`) into a paginated/infinite-scroll experience. See
  "Frontend impact" below — that's flagged as necessary follow-up work, not
  bundled here.
- Sorting by anything other than `publishedAt` (score/title/chapters stay
  client-side sort keys for now — only `publishedAt` moves server-side, since
  that's the one the user called out specifically).
- Full-text/relevance ranking changes to AniList search.

## Decisions made

- **Response shape: envelope with metadata**, not a bare array. Both endpoints
  change from `Schema.Array(X)` to something like
  `{ items: X[], page, limit, total, hasNextPage }`. Confirmed with the user —
  this lets the frontend show "page N" / disable a "next" control reliably,
  and AniList already gives us `pageInfo.total` / `pageInfo.hasNextPage` for
  free on the search side.

## Design

### 1. Shared schema (new file)

Create `api/src/http/pagination.schema.ts` — pure `effect/Schema`, no
service/db/config imports, so it's safe to import from `*.group.ts` (must not
violate the `api.ts` boundary rule: nothing importing into `api.ts`'s graph may
reach `*.service.ts`/`*.repository.ts`/`db.ts`/`config.ts` — see
`doc/good-pratices.md` and the existing `manga.group.ts` pattern).

```ts
import { Schema } from "effect";

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export const PaginationParams = Schema.Struct({
  page: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 },
  ),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.between(1, MAX_PAGE_LIMIT),
    ),
    { default: () => DEFAULT_PAGE_LIMIT },
  ),
});
export type PaginationParams = typeof PaginationParams.Type;

export const Paginated = <A, I, R>(item: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    items: Schema.Array(item),
    page: Schema.Int,
    limit: Schema.Int,
    total: Schema.Int,
    hasNextPage: Schema.Boolean,
  });
```

Check exact `Schema.optionalWith(..., { default })` API against the installed
`effect` version before implementing — confirm the helper name/signature
compiles, this is written from memory of the pattern, not verified against
`node_modules`.

### 2. Manga-specific sort params

Sorting stays manga-scoped for now (only one sortable field exists), defined
next to the other manga param schemas in `manga.group.ts`:

```ts
const MangaSortParams = Schema.Struct({
  sortBy: Schema.optional(Schema.Literal("publishedAt")),
  sortOrder: Schema.optionalWith(Schema.Literal("asc", "desc"), {
    default: () => "desc",
  }),
});
```

`sortBy` is optional and left unset by default — no `ORDER BY` is applied
unless the client asks for one, to avoid silently changing the current
(unspecified) row order for existing callers. Confirm with the user whether an
explicit default sort (e.g. always `publishedAt desc`) is preferable once the
frontend side of this is scoped — flagged as open question below.

### 3. `GET /manga` (`manga.group.ts` + `manga.service.ts`)

- `manga.group.ts`: give `listMangas` a
  `.setUrlParams(Schema.extend(PaginationParams, MangaSortParams))` and change
  `.addSuccess(Schema.Array(MangaSummary))` to `.addSuccess(Paginated(MangaSummary))`.
- `manga.controller.ts`: pass `urlParams` through to
  `mangaService.listMangas(user.id, urlParams)`.
- `manga.service.ts` `listMangas`: extend the `db.query.mangas.findMany({...})`
  call with:
  - `limit`, `offset: (page - 1) * limit`
  - `orderBy: sortBy === "publishedAt" ? { publishedAt: sortOrder } : undefined`
    (the relational-query `orderBy`-by-object form is already used elsewhere,
    e.g. `scanProvider.service.ts` for chapters/providers — follow that
    convention rather than inventing a new one)
  - a separate total count query. Check whether the installed drizzle-orm
    (`1.0.0-beta.23`) exposes `db.$count(mangas)` — if so, prefer that over a
    hand-rolled `count(*)` select for consistency with the rest of the
    codebase.
  - `hasNextPage = page * limit < total`

Note: `latestChapterAt` is currently computed by loading every chapter row per
manga via the `chapters` relation (`manga.service.ts:112-120`) — unrelated to
this refactor, but worth flagging as a pre-existing cost that pagination
doesn't fix (it still loads all chapters for the *page's* mangas, which is
fine, just noting it's not addressed here).

### 4. `GET /manga/search` (AniList)

- `manga.group.ts`: `SearchMangaParams` becomes
  `Schema.extend(Schema.Struct({ q: Schema.NonEmptyTrimmedString }), Schema.extend(PaginationParams, MangaSortParams))`,
  success schema becomes `Paginated(AniListSearchResult)`.
- `manga.controller.ts`: pass the extra params to
  `mangaProviderService.searchMedia(urlParams.q, urlParams)`.
- `mangaProvider.service.ts`:
  - Update `SEARCH_QUERY` to accept `$page`, `$perPage` (already partially
    there, just currently hardcoded — `page: 1` needs to become `page: $page`)
    and a new `$sort: [MediaSort]` variable, and request
    `pageInfo { total currentPage hasNextPage }` on `Page`.
  - Map our `sortBy`/`sortOrder` to AniList's `MediaSort` enum. **Needs
    verifying against AniList's actual schema** — the value is very likely
    `START_DATE` / `START_DATE_DESC` (not `PUBLISHED_AT`), since AniList's
    field is `startDate`, but confirm via
    `https://anilist.co/graphiql` or the public SDL before hardcoding it.
  - Update `AniListSearchRequestBody` (the outgoing request schema,
    `mangaProvider.service.ts:95-101`) to include `page`, `sort`.
  - Update `AniListSearchResponse` (`mangaProvider.schema.ts`) to parse the new
    `pageInfo` block.
  - `searchMedia(query, params)` returns `{ items, page, limit, total,
    hasNextPage }` built from `pageInfo`, instead of a bare array.

### 5. Frontend — API client & query layer (minimal adaptation, this refactor)

- `web/src/lib/api.ts`: `listMangas()` and `searchManga(q)` gain a params
  argument and their return types follow the new envelope (typed
  automatically through `HttpApiClient.make(Api)` — no manual type changes
  needed beyond passing params through, per the existing
  `@workspace/api` contract-first setup).
- `web/src/components/domain/manga/manga.queries.ts`:
  - `useMangaList()` → `useMangaList(params?)`, with `mangaKeys.list(params)`
    instead of the current fixed `mangaKeys.list()` (query-key-factory
    pattern — keep params in the key so different pages/sorts cache
    separately, same pattern already used for `mangaKeys.search`/`detail`).
  - `useMangaSearch(q)` → `useMangaSearch(q, params?)`, same key treatment.
  - `useFavoriteMutation`'s optimistic update
    (`queryClient.setQueryData<MangaSummary[]>(mangaKeys.list(), ...)`,
    `manga.queries.ts:70-76`) currently assumes the cached value under
    `mangaKeys.list()` is a bare `MangaSummary[]`. Once the response is an
    envelope, this needs updating to reach into `.items`, and — because the
    key now varies by params — it needs to target whichever param'd list
    query/queries are actually mounted (or switch to
    `queryClient.invalidateQueries` only, dropping the optimistic patch).

## Frontend impact — flagged, not solved here

`web/src/components/domain/home/use-browse-filters.ts` and its callers
(`browse-section.tsx`, `favorites-only-page.tsx`, `favorites-section.tsx`,
`new-drops-section.tsx` → `featured-strip.tsx`) all currently assume
`useMangaList()` returns **the entire manga table** in memory:

- available genres/years/provider counts (`use-browse-filters.ts:49-77`) are
  derived by scanning the full list client-side,
- filtering by query/provider/genre/year and the `score`/`title`/`chapters`
  sort keys all run client-side over that same full list,
- `featured-strip.tsx` picks its "New drops" by client-side sorting on
  `latestChapterAt` (a different field from `publishedAt` — out of scope
  here).

If `GET /manga` starts capping results at `limit` (default 20) by default,
these views silently break (wrong facet counts, missing items, "new drops"
computed from only the first page) **unless the frontend is updated at the
same time**. Two ways to sequence this, to decide before implementing:

1. **Ship backend-only now**, with the frontend still calling
   `listMangas()` with a large-enough `limit` (e.g. `limit=100`, the max) as a
   stopgap so today's UI keeps working unchanged until it's properly
   redesigned for pagination. Simple, but the "safety net" is weaker (100 is
   still an unbounded-ish default) and it's a silent time bomb once the table
   passes 100 rows.
2. **Scope a second phase** that redesigns the browse page around real
   pagination/infinite-scroll and moves facet computation (genres/years/
   provider counts) server-side or to a dedicated endpoint, before shrinking
   the default `limit`. More correct, more work, needs its own plan.

Recommendation: do (1) as an explicit stopgap inside this same change (call
out the hardcoded `limit=100` in the PR description as temporary), and open
phase 2 as a separate, later plan once the backend contract is settled and
proven. Don't block this refactor on redesigning the browse UI.

## Open questions to resolve before/during implementation

- [ ] Confirm AniList's `MediaSort` enum value for release-date sort
  (`START_DATE` / `START_DATE_DESC` assumed, not verified).
- [ ] Confirm `Schema.optionalWith(..., { default })` is the correct
  `effect` Schema API in the installed version for optional query params with
  defaults (used elsewhere in the codebase? if not, verify against `effect`'s
  docs/types before relying on it).
- [ ] Confirm whether `db.$count(...)` exists in `drizzle-orm@1.0.0-beta.23`
  for the DB-side `total` count, or whether a manual `count(*)` select is
  needed.
- [ ] Decide default `sortBy` behavior: leave unset (current unspecified DB
  order) vs. always default to `publishedAt desc`. Current plan leaves it
  unset to avoid changing existing behavior implicitly.
- [ ] Decide the phase-1 frontend stopgap `limit` value (100 suggested above).

## Suggested implementation order

1. `api/src/http/pagination.schema.ts` (new, shared, boundary-safe schema).
2. `manga.group.ts` — wire params + envelope success schemas for both
   endpoints (contract first, before touching implementations).
3. `manga.service.ts` `listMangas` — DB pagination + sort + total count.
4. `mangaProvider.service.ts` + `mangaProvider.schema.ts` — AniList
   pagination + sort + `pageInfo` parsing.
5. `manga.controller.ts` — thread `urlParams` through to both services.
6. `web/src/lib/api.ts` + `manga.queries.ts` — params, query keys, envelope
   handling, optimistic-update fix.
7. Frontend stopgap: pass `limit=100` (or the chosen value) from
   `useMangaList()`'s current call sites so existing browse/favorites/new-drops
   views keep working unchanged.
8. Manual verification: `GET /manga?page=1&limit=5&sortBy=publishedAt&sortOrder=asc`
   and the equivalent `GET /manga/search?q=...&page=2&limit=5&sortBy=publishedAt`
   against a real dev DB / AniList, checking `total`/`hasNextPage` correctness
   at the boundaries (last page, empty results, `limit` clamped to
   `MAX_PAGE_LIMIT`).

## Error handling reminder

Any new failure mode introduced here (e.g. an invalid page/limit combination,
an AniList response missing `pageInfo`) must follow the existing convention:
domain error class in the relevant `*.service.ts`, added to `DomainError` in
`api/src/appError.ts`, converted via `toHttpError` — never construct/fail with
an `Http*Error` directly inside a service. See `doc/error.md`.
