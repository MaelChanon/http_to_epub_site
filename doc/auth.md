# Authentication

Session-cookie based auth (no JWT, no third-party provider). Sessions are
opaque random tokens stored server-side in Redis; the browser only ever holds
an httpOnly cookie.

## Flow

- **Bootstrap** — `PUT /api/user` with **no** `token`
  (`UsersApiGroupLive.createUser`, `user/user.controller.ts`): allowed only
  while the `users` table is empty. Hashes the password with bcrypt
  (`encrypt/encryptService.ts`, cost factor 12), creates the account, creates
  a session, sets the cookie. Returns **403** once any account exists — there
  is no open registration. No page calls this branch: the intended way into a
  fresh instance is the startup invite link below, and this stays as an
  API-level escape hatch (curl) if that link is unusable.
- **Invite acceptance** — `PUT /api/user` **with** a `token`, same handler:
  reads the invite's permissions (`peekInvite`), rejects a duplicate email
  *before* consuming the token so a typo does not burn the link, consumes the
  token, creates the account with those permissions, creates a session, sets
  the cookie. The invitee is signed in immediately.
- **Login** — `POST /api/auth/login` (`AuthApiGroupLive.login`,
  `auth/auth.controller.ts`): looks up the user by email
  (`getByEmailWithPassword`, which is the only repository method that returns
  the password hash), `bcrypt.compare`, creates a session on success, sets the
  cookie.
- **Logout** — `POST /api/auth/logout`: reads the `session` cookie, revokes it
  in Redis (`SessionService.revokeToken`), then re-sets the cookie with
  `maxAge: 0` to clear it in the browser.
- **Current user** — `GET /api/auth/me`: trivially returns the `CurrentUser`
  value injected by the `Authentication` middleware.
- **Who becomes an administrator** — whichever branch is taken, the handler
  counts the existing users first and sets `isAdmin: total === 0`. The very
  first account on an instance is therefore always the administrator, whether
  it arrived through the startup invite below or through a direct `PUT
  /api/user`; every later account is not. (The count and the insert are not in one transaction,
  so two accounts created in the same instant on an empty instance would both
  be administrators — not a concern for a single-admin self-hosted setup.)

## Magic links

Account creation and password reset both go through single-use links that an
administrator copies and hands over out-of-band — this project has **no mail
infrastructure**, so nothing is sent automatically.

**Getting in on a fresh instance.** `domain/user/bootstrapInvite.ts`
(`BootstrapInviteLive`, merged into `WorkersLive` in `layer.ts` alongside the
crons) runs once at boot: if the `users` table is empty it issues an invite
carrying no permissions and prints the full URL to the log —

```
  No user in the database yet — open this link to create the first account:

    http://localhost:5173/invite/<token>

  Single use, expires in 48 hours.
  Whoever uses it becomes the administrator.
```

The origin comes from the first entry of `CORS_ALLOWED_ORIGINS`. The token is
remembered under `magiclink:bootstrap`, so a restart re-prints the **same**
link instead of piling up a new one on every reload; a new one is issued only
once the previous has expired or been used. Nothing is printed once any
account exists, and a failure here is logged without taking the server down.
This is the only bootstrap path with a UI — there is no setup page to visit.

`domain/user/magicLink.service.ts` (`MagicLinkService`) stores them in Redis
beside the sessions:

| Key | Value | TTL |
|---|---|---|
| `magiclink:invite:<token>` | JSON array of granted permissions | `INVITE_TTL_SECONDS`, default 48h |
| `magiclink:reset:<token>` | the target `userId` | `PASSWORD_RESET_TTL_SECONDS`, default 1h |
| `magiclink:bootstrap` | the token of the current startup invite | same as the invite it points at |

Tokens are `crypto.randomBytes(32).toString("base64url")`. The service exposes
a `peek*` pair (Redis `GET` — reading a link never burns it; used by the
reset preview and by `createUser` before the duplicate-email check) and a
`consume*` pair (Redis `GETDEL`, atomic, so single use is a property of Redis
rather than of application code that could be raced). Expiry is Redis' job:
nothing sweeps stale tokens.

Endpoints:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/users/invite` | admin | Issue an invite for a set of permissions |
| `POST` | `/api/users/:id/password-reset` | admin | Issue a reset link for a non-admin user |
| `GET` | `/api/auth/password-reset/:token` | public | Preview a reset link (target's pseudo) |
| `POST` | `/api/auth/password-reset/:token` | public | Set the new password |

Both issuing endpoints return `{ token, expiresInSeconds }` — a relative
deadline, so the UI can render "expires in 48 hours" without hardcoding the
TTL constants and without trusting the browser's clock.

A missing or expired token surfaces as `MagicLinkNotFound` → **404** with the
message *"This link is invalid or has expired"*; the message deliberately does
not distinguish "never existed" from "expired".

`POST /api/auth/password-reset/:token` sets **no** cookie: it revokes every
session of that user (see below) and the browser lands on `/login`.

## Session tokens

`SessionService` (`session/session.service.ts`) issues tokens as
`crypto.randomBytes(32).toString("base64url")` and stores them in Redis as
`session:<token> -> userId`, with a TTL from `SESSION_TTL_SECONDS` (default 7
days). The token is a random reference, not a JWT — it carries no payload and
is not signed. There is no sliding expiration: the TTL is set once at
creation and is not renewed on activity, and there is no refresh mechanism.

**Revoking every session of one user.** `session:<token> -> userId` only
answers one direction, so `createToken` also maintains a reverse index:
`SADD user-sessions:<userId> <token>`, with the set's TTL refreshed on each
login. `revokeToken` removes the token from that set (reading the userId
*before* deleting the session key), and `revokeAllForUser(userId)` reads the
set with `SMEMBERS`, deletes every `session:*` key it names, then drops the
set. Password reset is the only caller. Members whose session already expired
linger in the set until the next revocation, which is harmless — `DEL` on an
absent key is a no-op.

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
  (`manga/manga.group.ts`). `createUser`, `login`, `logout` and the two
  magic-link preview/consume endpoints are not gated, since they must be
  reachable while unauthenticated.

`requireAdmin` (`domain/user/permission.ts`) gates the administrator-only
endpoints — `listUsers`, `updateUserPermissions`, `deleteUser`, `createInvite`
and `createPasswordReset` — failing with `ForbiddenError` (403). An
administrator can neither be deleted, nor have their permissions edited, nor
be handed a reset link (400 in each case): admins are managed at the database
level or by bootstrapping a fresh instance.

## CSRF protection

Two layers, both cookie-level rather than token-level — there is no
synchroniser token and no `X-CSRF-Token` header anywhere.

- The session cookie is `sameSite: "lax"`, so the browser does not attach it
  to cross-site `POST`/`PUT`/`PATCH`/`DELETE` requests at all.
- `http/csrfProtection.ts` is an `HttpMiddleware` wired in `index.ts` around
  the whole app (inside the CORS middleware). On mutating methods it reads
  the request's `Origin`, falling back to the origin parsed out of `Referer`,
  and answers `403` when that origin is not in `CORS_ALLOWED_ORIGINS`. Safe
  methods pass through untouched.

**Known reservation** (audit S3): the check is `origin !== undefined &&
!allowedOrigins.includes(origin)`, so a mutating request carrying **neither**
`Origin` nor `Referer` traverses the middleware. Exploitability is low —
modern browsers send `Origin` on every cross-site mutating request, and
`sameSite: "lax"` would not attach the session anyway — but the middleware
reads as a stronger guarantee than it gives. Rejecting an absent origin on a
mutating method is the fix.

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
- **Route protection** lives in a single pathless layout route,
  `web/src/routes/_authenticated.tsx`:

  ```ts
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: authKeys.currentUser(),
      queryFn: getCurrentUser,
    });
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  ```

  Every protected page is a child file (`_authenticated.index.tsx`,
  `_authenticated.library.tsx`, `_authenticated.manga.$mangaId.tsx`,
  `_authenticated.manga.$mangaId_.$providerId.$chapterId.tsx`,
  `_authenticated.admin.users.tsx`) — the segment is pathless, so the URLs are
  unchanged. The guard returns the user into the router context, which
  `_authenticated.admin.users.tsx` reuses for its own `beforeLoad`
  (`if (!context.user.isAdmin) throw redirect({ to: "/" })`). Public routes
  (`login`, `invite/$token`, `reset-password/$token`) stay outside the layout.
- **Account pages.** There is no signup page: the first administrator uses
  the startup invite link like anybody else, so `/invite/$token` is the only
  account-creation route. It renders the form straight away — there is no preview
  endpoint for invites, so a dead link is only discovered on submit, where the
  API's 404 message ("This link is invalid or has expired") is shown inline
  above the button. `/reset-password/$token` does preview the target's pseudo,
  so its page can tell a dead link apart before anything is typed, then
  navigates to `/login` once the password is set.
- Both share `components/auth/account-form.tsx` (name + email +
  password, `react-hook-form` + zod, 8-character minimum); only the copy and
  the mutation differ.
- `/login` no longer advertises self-service signup or a "forgot password"
  link — both now tell the visitor to ask an administrator.
- The admin page (`/admin/users`) issues links through
  `invite-user-dialog.tsx` and `reset-link-dialog.tsx`, which share
  `magic-link-result.tsx` (composed URL + copy button + relative expiry). The
  link is shown once and never persisted, so the panel stays open until the
  administrator dismisses it.

## Config

Env vars, see `config.ts` / `.env.sample`:

- `SESSION_TTL_SECONDS` — session lifetime in Redis (default 7 days). Used.
- `COOKIE_SECURE` — sets the cookie's `secure` attribute (`false` for local
  dev). Used.
- `SESSION_COOKIE_NAME` — defined but currently **unused**: the cookie name
  is hardcoded as `"session"` in `auth.middleware.ts`.
- `INVITE_TTL_SECONDS` — invite link lifetime (default 172800, i.e. 48h).
- `PASSWORD_RESET_TTL_SECONDS` — reset link lifetime (default 3600, i.e. 1h).

AniList (used by the manga feature) is unrelated to user authentication: it's
queried anonymously server-side, no OAuth client is involved.

## Known gaps

- No logout button/menu wired up in the UI, even though `logout()` is
  exported and functional.
- The CSRF middleware lets a mutating request through when it carries
  neither `Origin` nor `Referer` (see [CSRF protection](#csrf-protection)).
- No self-service password change for a signed-in user — only an
  administrator-issued reset link.
- No self-service "forgot password": with no mail infrastructure there is
  nowhere to send a link, so `/login` tells the visitor to ask an
  administrator.
- Pending invitations cannot be listed or revoked. A link that was issued and
  handed out can only be left to expire.
- Links travel over whatever channel the administrator chooses; nothing binds
  a link to a recipient before it is used.
