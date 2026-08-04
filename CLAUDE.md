# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-hosted manga tracker/reader that turns scanlations into EPUBs. Users
favorite manga (metadata from AniList), the API scrapes chapters from scan
sites via a Rust native addon, and chapters can be read in-browser or bundled
into a downloadable archive/EPUB.

npm workspaces monorepo:

- `api/` — Fastify-less HTTP API built on `@effect/platform`'s `HttpApi`
  (Effect-TS). Postgres via Drizzle, sessions in Redis, object storage via
  Garage (S3-compatible).
- `web/` — React 19 + Vite + TanStack Router/Query, Tailwind v4, shadcn/radix.
- `manga-fetcher/` — Neon (Rust native addon) exposing scraping logic to
  Node. Depends on a **sibling repo** `../http_to_epub` (a separate git repo,
  not part of this one) — must be cloned alongside this repo for
  `manga-fetcher` to build. See `doc/manga-fetcher.md`.
- `http_to_epub/` — the sibling Rust CLI itself, present in this checkout as
  a nested repo (own `.git`, not a submodule of this repo).

`web` and `api` share the API contract via the `@workspace/api` workspace
package (contract-first `HttpApi`) — see [Frontière @workspace/api](#the-workspaceapi-boundary-strict)
below before touching anything under `api/src/http/`.

## Commands

```bash
# Install (run once, and whenever a workspace's package.json changes)
npm install

# Dev servers (from repo root)
npm run dev:api          # tsx watch, http://localhost:3000
npm run dev:web           # vite, http://localhost:5173

# Lint/format (biome) — also runs as a pre-commit hook (npm run check)
npm run check              # check only
npm run format              # check --write

# Infra (Postgres, Redis, Garage/S3) — required for api to boot
docker compose up -d

# DB migrations (from api/)
cd api && npm run db:migrate    # drizzle-kit migrate
# generate a new migration after editing api/drizzle/schema/*.ts:
cd api && npx drizzle-kit generate

# manga-fetcher native addon (only needed after changing manga-fetcher or http_to_epub Rust code)
cd manga-fetcher && npm run build   # release build (tsc + cargo build --release + neon dist)
cd manga-fetcher && npm run debug   # same, debug build
```

There is no test suite in this repo (no vitest/jest config, no `*.test.*`
files) — `manga-fetcher`'s `npm test` just runs `cargo test` on the Rust
addon crate.

Garage's S3 bucket/keys aren't bootstrapped by `docker compose up`; one-time
manual setup is documented in `doc/s3.md`.

## Architecture

### API: Effect-TS layered services

Everything in `api/src` is Effect-TS (`effect`, `@effect/platform`). Key shape:

- **`*.group.ts`** — declarative route definitions (`HttpApiGroup`,
  `HttpApiEndpoint`): path, params, payload/response schemas. No logic.
- **`*.controller.ts`** — implements a group's handlers
  (`HttpApiBuilder.group(...)`), calling into services. Converts domain
  errors to Http errors via `.pipe(Effect.catchAll(toHttpError))`.
- **`*.service.ts`** / **`*.repository.ts`** — business logic and DB/external
  calls. `Effect.Service` classes, each exposing a `.Default` layer.
- **`*.domain.ts`** / **`*.schema.ts`** — `Schema.Class` shape definitions
  used by groups and services.
- **`api/src/http/api.ts`** — assembles the `Api` (`HttpApi.make`) from all
  groups; this is the single public entry point exported to `web` (see
  boundary rule below).
- **`api/src/http/apiLive.ts`** — wires each group's `*Live` controller
  implementation + `AuthenticationLive`; not exported to `web`.
- **`api/src/layer.ts`** — `AppLayer`, the merged `Layer` of every service's
  `.Default`, provided once in `index.ts`. Add new services here or they
  won't be resolvable.
- **`api/src/index.ts`** — process entry point: loads `.env`, builds the
  Node HTTP server with CORS + CSRF + logger middleware, runs `AppLayer`.

New domain = new folder under `api/src/domain/<name>/` following this
`*.group.ts` / `*.controller.ts` / `*.service.ts` / `*.domain.ts` split.

### The `@workspace/api` boundary (strict)

`api/package.json` restricts what `web` can import to one entry point
(`"exports": { ".": "./src/http/api.ts" }`). `api/src/http/api.ts` must
**only** import declarative code (`*.group.ts`, `*.domain.ts`/`*.schema.ts`,
`error.ts`, the declarative half of `auth.middleware.ts`) and must **never**
import — even transitively — any `*.controller.ts`/`*.service.ts`/
`*.repository.ts`, `config.ts`, `drizzle/db.ts`, `redis.ts`, or anything
under `src/encrypt/`/`src/session/`. `HttpApiClient.make` bundles everything
reachable from that entry point into the browser JS, so a transitive import
of business logic or secrets there is a real leak, not just a lint nit. Full
rules and a checklist for adding a new endpoint: `doc/shared-api-package.md`.

### Error handling (strict)

Services and repositories never construct or fail with an Http error
(`NotFoundError`, `UnauthorizedError`, etc. from `api/src/http/error.ts`) —
those exist only for the controller/middleware boundary. Services define
domain errors (`Data.TaggedError`), added to the `DomainError` union in
`appError.ts`; `toHttpError` (`error.ts`) maps each to its Http error, called
in controllers via `.pipe(Effect.catchAll(toHttpError))`. One exception:
middleware with an imposed failure type (e.g. `Authentication` requires
`UnauthorizedError`) may do a single targeted `Effect.mapError` at the very
end of its pipeline. Full walkthrough + list of existing domain errors:
`doc/error.md`.

### Auth

Session-cookie based (no JWT). Opaque random tokens issued by
`session/session.service.ts`, stored in Redis (`session:<token> -> userId`),
verified by an `HttpApiMiddleware` (`auth/auth.middleware.ts` declarative +
`auth.middleware.live.ts` implementation) that endpoints opt into with
`.middleware(Authentication)`. No global frontend auth store — auth state is
read on demand via React Query (`authKeys.currentUser()`), and route
protection is a per-route `beforeLoad` guard (no shared layout route yet).
Full flow, known gaps (no logout UI, no CSRF beyond `sameSite: lax`, no
password reset): `doc/auth.md`.

### manga-fetcher native addon

Wrapped API-side by `api/src/domain/mangaFetcher/mangaFetcher.service.ts`,
which turns every native-call `Promise` rejection into a domain error via
`Effect.tryPromise`. Consumed by `ScanProviderService` and the scan cron jobs
(`api/src/domain/scanProvider/`). `getProviderCatalog` scrapes a provider's
entire catalog and can take minutes — only call it from a scheduled job
(`scanProvider.cron.ts`), never from a synchronous request handler. Provider
base URLs are hardcoded Rust-side; TS only picks `"SUSHISCAN" |
"MANGA_ORIGINS"`. Rebuild it locally after changing `manga-fetcher/` or the
sibling `http_to_epub/` Rust source — `index.node`/`lib/`/`target/` are
gitignored and machine-specific. Full details: `doc/manga-fetcher.md`.

### S3 storage (Garage)

`api/src/domain/s3/s3.service.ts` (`S3Service`) wraps upload/download/list/
presigned-URL operations, scoped to one bucket. Manga cover images are
uploaded under `covers/<anilistId>.<ext>` by `MangaProviderService`; the raw
S3 key never leaves the API — `MangaService` resolves it to a presigned URL
(`coverUrl`) before returning a `Manga`. No controller exposes `S3Service`
directly yet. Full details incl. one-time cluster bootstrap: `doc/s3.md`.

### Frontend data layer

- API calls go through the typed `@workspace/api` client built once in
  `web/src/lib/api.ts` (`HttpApiClient.make(Api)`), wrapped into
  plain-Promise functions per endpoint (`Effect.runPromise(...)`) — add new
  endpoints there, not ad-hoc `fetch`.
- `credentials: "include"` is set globally on the client's `RequestInit`
  layer, so the session cookie is attached automatically; no manual
  Authorization header handling anywhere.
- React Query keys: centralize each resource's keys in a factory object
  (e.g. `authKeys`, colocated with that resource's `*.queries.ts`) rather
  than scattering literal arrays — see `doc/good-pratices.md`.
- Forms: `react-hook-form`, not per-field `useState` — see
  `web/src/routes/login.tsx` / `signup.tsx` for the pattern (custom fields
  take a `registration` prop from `register(...)`).
- Routing: TanStack Router, file-based under `web/src/routes/`,
  `routeTree.gen.ts` is generated — don't hand-edit it.

## Conventions

- Biome (tabs, not spaces) enforces: no default exports, no unused
  imports/vars, `noConsole` (errors only outside `web/`, which is exempt),
  `useAwait`, `useImportType`. Runs on pre-commit via husky
  (`.husky/pre-commit` → `npm run check`).
- Don't add explicit type annotations TypeScript can already infer (return
  types, variable types) — see `doc/good-pratices.md` for the exceptions
  (public function params, narrowing a literal, inference failing to
  `any`/`unknown`).
- Full doc set lives in `doc/*.md` (English) — `auth.md`, `error.md`,
  `good-pratices.md`, `manga-fetcher.md`, `s3.md`,
  `shared-api-package.md`. Prefer linking/reading these over re-deriving the
  same architecture from source when working in these areas.
