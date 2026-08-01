# Error handling

Strict rule: services (`*.service.ts`, `*.repository.ts`) must **never**
build or fail an effect with an Http error (`NotFoundError`,
`UnauthorizedError`, `BadRequestError`, `ForbiddenError`, `InternalServerError`,
defined in `error.ts`). Http errors only exist for the controller/middleware
layer (the HTTP boundary), and are produced via `toHttpError`.

## Why

An Http error used directly in a service breaks the separation between the
domain and the HTTP transport: the service becomes coupled to the HTTP
representation of the error, and the centralized mapping in `toHttpError` is
no longer the single source of truth for "which domain error maps to which
HTTP code".

## How to add a new business error

1. Create a `Data.TaggedError("XxxError")<{...}>` class (with an
   `internalMessage` getter for logging) in the relevant service file
   (e.g. `session/session.service.ts`, `user/user.repository.ts`).
   - If the error has no fields, omit the generic rather than writing
     `<{}>` (rejected by biome): `Data.TaggedError("MissingSession")`.
2. Add it to the `DomainError` union in `appError.ts`.
3. Add a case in `toHttpError` (`error.ts`):
   `Match.tag("XxxError", () => Effect.fail(new SomeHttpError({...})))`.
4. In controllers (`*.controller.ts`), convert with
   `.pipe(Effect.catchAll(toHttpError))`.

### Exception: middleware with an imposed failure type

When an `HttpApiMiddleware.Tag` imposes a specific Http failure type (e.g. the
`Authentication` middleware requires exactly `UnauthorizedError`), the service
can do a final targeted conversion via
`Effect.mapError(() => new UnauthorizedError(...))` at the end of the
pipeline — but only at that single exit point, never scattered throughout the
internal business logic. See `auth/auth.service.ts`: `MissingSession` /
`InvalidSession` are used internally, `UnauthorizedError` only appears at the
very end.

## Existing domain errors

- `UserNotFound` (`user/user.repository.ts`)
- `SQLError` (`schema/utils.ts`)
- `EncryptionFailed` (`encrypt/encryptService.ts`)
- `InvalidSession`, `MissingSession` (`session/session.service.ts`)
