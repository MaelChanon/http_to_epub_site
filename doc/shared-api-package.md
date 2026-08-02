# Shared API package (`@workspace/api`)

`web` and `api` share the API contract through the `@workspace/api`
workspace package, using Effect's contract-first `HttpApi` (`HttpApi.make`,
`HttpApiGroup`, `HttpApiEndpoint`). `web/src/lib/api.ts` builds a typed
client from it with `HttpApiClient.make(Api)`. This avoids duplicating
route paths, param/payload shapes and response types between front and
back.

`HttpApiClient.make` builds the client at runtime, not just at the type
level — so everything reachable from the package entry point is actually
bundled into the JS shipped to the browser, not erased like a `type`-only
import would be.

## The boundary

`api/package.json` restricts what `web` can import to a single entry
point:

```json
"exports": { ".": "./src/http/api.ts" }
```

`api/src/http/api.ts` must only ever import **declarative** code:

- `*.group.ts` (`HttpApiGroup`/`HttpApiEndpoint` definitions)
- `*.domain.ts` / `*.schema.ts` (`Schema.Class` definitions)
- `error.ts` (Http error classes)
- `auth.middleware.ts` — the declarative side only (security scheme, tag,
  failure type). Not `auth.middleware.live.ts`.

It must **never** import, even transitively:

- `*.controller.ts`, `*.service.ts`, `*.repository.ts` (business logic, DB
  queries, calls to external providers)
- `config.ts`, `drizzle/db.ts`, `redis.ts` (secrets, connection strings)
- `src/encrypt/`, `src/session/`, `auth.middleware.live.ts`,
  `auth.service.ts`, `layer.ts` (live implementations wired with secrets)

The actual request handlers and their `*Live` layers live in
`api/src/http/apiLive.ts`, a separate module that `api.ts` does not import
and that `web` never references.

## Why this is safe

Exposing the route/payload *shapes* isn't a leak by itself — any user can
already see them by inspecting network requests in the browser. What must
stay server-only is *secrets* and *business logic*. As long as the import
graph rule above holds, those never reach the bundle.

Two things enforce it:

1. The `exports` field in `api/package.json` — `web` can only resolve
   `@workspace/api`, never a deep path like
   `@workspace/api/src/domain/user/user.service.ts`.
2. Named re-exports in `api.ts` — always list exactly what should be
   public, never `export *`. Example: `user.schema.ts` re-exports
   `UserWithPassword` (which has a `password` field) from
   `user.domain.ts`, but `api.ts` only re-exports `User`, so `web` cannot
   reference `UserWithPassword` at all.

Reusing Drizzle enum definitions (`mangaFormat`, `mangaStatus`,
`mangaGenre` from `drizzle/schema/mangas.ts`) to build `Schema.Literal`s is
fine: those are just arrays of string values, not DB connections.

## Checklist when adding a new domain/endpoint

- New `*.group.ts` file: only import `*.domain.ts`/`*.schema.ts` and
  `auth.middleware.ts`, never a service/controller/repository.
- New fields on a `Schema.Class` used in a group: check whether they
  should be split into a "public" class (like `User`) and an "internal"
  one (like `UserWithPassword`), and only re-export the public one from
  `api.ts`.
- New config/secret: keep it in `config.ts`, never import `config.ts` from
  anything reachable by `api.ts`.
