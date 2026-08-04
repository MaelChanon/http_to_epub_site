# Authentication

Session-cookie based auth (no JWT, no third-party provider). Sessions are
opaque random tokens stored server-side in Redis; the browser only ever holds
an httpOnly cookie.

## Flow

- **Signup** — `PUT /api/user` (`UsersApiGroupLive.createUser`,
  `user/user.controller.ts`): checks email uniqueness, hashes the password
  with bcrypt (`encrypt/encryptService.ts`, cost factor 12), inserts the user,
  creates a session, sets the cookie.
- **Login** — `POST /api/auth/login` (`AuthApiGroupLive.login`,
  `user/user.controller.ts`): looks up the user by email
  (`getByEmailWithPassword`, which is the only repository method that returns
  the password hash), `bcrypt.compare`, creates a session on success, sets the
  cookie.
- **Logout** — `POST /api/auth/logout`: reads the `session` cookie, revokes it
  in Redis (`SessionService.revokeToken`), then re-sets the cookie with
  `maxAge: 0` to clear it in the browser.
- **Current user** — `GET /api/auth/me`: trivially returns the `CurrentUser`
  value injected by the `Authentication` middleware.

## Session tokens

`SessionService` (`session/session.service.ts`) issues tokens as
`crypto.randomBytes(32).toString("base64url")` and stores them in Redis as
`session:<token> -> userId`, with a TTL from `SESSION_TTL_SECONDS` (default 7
days). The token is a random reference, not a JWT — it carries no payload and
is not signed. There is no sliding expiration: the TTL is set once at
creation and is not renewed on activity, and there is no refresh mechanism.

## Protecting endpoints

Built on `@effect/platform`'s `HttpApiMiddleware`, not Express-style
middleware.

- `auth/auth.middleware.ts` declares:
  - `CurrentUser`, a `Context.GenericTag<User>` used to inject the
    authenticated user.
  - `sessionCookie`, an `HttpApiSecurity.apiKey` reading the value from the
    `session` cookie.
  - `Authentication`, the middleware tag: `provides: CurrentUser`,
    `failure: UnauthorizedError`, `security: { sessionCookie }`.
- `auth/auth.middleware.live.ts` (`AuthenticationLive`) implements the tag by
  calling `AuthService.authenticate(token)`.
- `auth/auth.service.ts#authenticate` fails with `MissingSession` if there is
  no token, otherwise `sessionService.verifyToken` → `userService.getUserById`.
  Any failure is mapped to `UnauthorizedError` at the very end of the
  pipeline — see the ["exception: middleware with an imposed failure
  type"](./error.md) rule in `doc/error.md`.
- `AuthenticationLive` is provided globally in `apiLive.ts`, but it only
  actually runs for endpoints that opt in with `.middleware(Authentication)`,
  e.g. `GET /auth/me` (`user/user.group.ts`) and the manga endpoints
  (`manga/manga.group.ts`). `createUser`, `login` and `logout` are not gated,
  since they must be reachable while unauthenticated.

A `User.isAdmin` field exists on the schema but nothing currently reads it —
there is no role/admin-gating check anywhere yet, even though `ForbiddenError`
(403) is already registered on the `Api` (`api.ts`).

## Password hashing & storage

- `encrypt/encryptService.ts`: `bcryptjs`, `SALT_ROUNDS = 12`.
- `schema/users.ts` (Postgres, via Drizzle): single `users` table —
  `id`, `pseudo`, `email` (unique), `password` (bcrypt hash), `isAdmin`.
- No `sessions` table: sessions live only in Redis and are never persisted in
  Postgres.

## Frontend

- **No global auth context/store.** Auth state is read on demand through
  React Query, keyed by `authKeys.currentUser()`
  (`web/src/auth/auth.queries.ts`), fetched via `getCurrentUser`
  (`web/src/lib/api.ts`).
- **Cookie attachment is automatic**: the `HttpApiClient` is built with
  `Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })`
  (`web/src/lib/api.ts`) so the browser sends/receives the `session` cookie on
  every request. There is no manual token/`Authorization` header handling.
- `getCurrentUser()` swallows failures and resolves `null` instead of
  throwing, which lets route guards do a simple truthy check.
- **Route protection** is a per-route `beforeLoad` guard, e.g.
  `web/src/routes/manga.$mangaId.tsx`:

  ```ts
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: authKeys.currentUser(),
      queryFn: getCurrentUser,
    });
    if (!user) throw redirect({ to: "/login" });
  },
  ```

  There is no shared/root-level guard (no pathless `_authenticated` layout
  route yet) — each protected route repeats this block.
- `login.tsx` / `signup.tsx` use `useMutation` and navigate to `/` on
  success; they do not proactively update the `authKeys.currentUser()` cache,
  relying on the default `staleTime: 0` to refetch on the next guarded
  navigation.

## Config

Env vars, see `config.ts` / `.env.sample`:

- `SESSION_TTL_SECONDS` — session lifetime in Redis (default 7 days). Used.
- `COOKIE_SECURE` — sets the cookie's `secure` attribute (`false` for local
  dev). Used.
- `SESSION_COOKIE_NAME` — defined but currently **unused**: the cookie name
  is hardcoded as `"session"` in `auth.middleware.ts`.

AniList (used by the manga feature) is unrelated to user authentication: it's
queried anonymously server-side, no OAuth client is involved.

## Known gaps

- No logout button/menu wired up in the UI, even though `logout()` is
  exported and functional.
- No CSRF protection beyond the cookie's `sameSite: "lax"`.
- No password-reset flow (the "Forgot password?" link on the login page has
  no handler).
