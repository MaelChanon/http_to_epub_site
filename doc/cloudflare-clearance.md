# Cloudflare clearance (sushiscan.net, anime-sama)

`SUSHISCAN_NET` and `ANIME_SAMA` sit behind Cloudflare. Most of the time they
let any browser-like User-Agent through, but the site owners can switch on a
JS challenge at any moment. When they do, every request needs a
`cf_clearance` cookie that only a real browser can earn. The API gets one
from [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) (a headless
Chrome behind an HTTP API), caches it in Redis, and retries.

## Flow

```
operation (chapter listing, catalog scrape, page download)
  │  with the cached clearance, or none
  ▼
fails with a Cloudflare challenge?
  ├─ no  → done (other failures are NOT retried here)
  └─ yes → renew the clearance (single-flight, see below)
           → retry the operation ONCE with it
           → still challenged: fail (ClearanceUnavailable / original error)
```

A "challenge" is recognised two ways:

- **Scraping** (`getMangaChapters`, `getProviderCatalog`):
  effect_http_to_epub's `ClearanceRequired`, for any provider
  (`MangaFetcherFetchFailed.needsClearance`).
- **Page downloads** (`fetchAndUpload` in `s3.ops.ts`): a `403`
  carrying the `cf-mitigated` header, or a `503` from `server: cloudflare`
  (`ImageFetchFailed.cloudflareChallenge`).

**A bare 403 is not a challenge.** sushiscan.net's hotlink protection answers
a plain `403` to any image request without `Referer: https://sushiscan.net/`.
A clearance never fixes that, so treating it as a challenge would re-solve in
a loop. The missing-headers case is handled by `getPageRequestHeaders`.

## Code

`api/src/domain/cloudflare/cloudflare.service.ts` (`CloudflareService`):

- `session(provider)` returns `{ run(operation, isChallenge) }`. `operation`
  receives the current clearance (`undefined` until the first challenge). A
  session keeps a renewed clearance for its later operations, so one sync
  (`syncMangaChapters`) or catalog refresh (`refreshCatalog`) shares one
  session across all its steps.
- `renew(provider, stale)` returns a clearance fresher than `stale`:
  - if Redis already holds a different one (another worker renewed it), use it;
  - otherwise take the Redis lock `cf:clearance:<provider>:lock`
    (`SET NX EX 120`) and solve;
  - if the lock is taken, poll Redis every 2 s until the holder publishes,
    and fail if the holder's lock disappears without a result.

  This matters: a sync downloads pages with `concurrency: 3 × 5`, so a cold
  cache would otherwise start 15 Chrome solves at once. The lock lives in
  Redis rather than in-process so it also holds across API instances.
- The clearance is stored as JSON `{ cookie, userAgent }` under
  `cf:clearance:<provider>`, with `EX = CF_CLEARANCE_TTL_SECONDS` (default
  1500 s, a bit under the cookie's ~30 min life).
- Solve request: `POST $FLARESOLVERR_URL` with
  `{ "cmd": "request.get", "url": <provider base URL>, "maxTimeout": 60000 }`.
  The base URL comes from `getProviderBaseUrl` (hardcoded in `mangaFetcher.service.ts`). Every
  returned cookie is kept (the origin sets more than `cf_clearance`), along
  with `solution.userAgent`.

Failures surface as `ClearanceUnavailable` (in `DomainError`, mapped to 500).
A sync that cannot get past the challenge ends `FAILED`, and the error lands
in the admin error log. Renewals themselves are logged at `Info` level only:
they are expected, not something an admin has to act on.

## Facts about these origins

Measured, not guessed:

- **The cookie and the User-Agent are one unit.** Cloudflare binds
  `cf_clearance` to the UA of the browser that earned it. Always replay
  FlareSolverr's `userAgent` with the cookie (`getPageRequestHeaders` and the
  scrapers both do).
- **The clearance is bound to the exit IP.** FlareSolverr must reach the
  internet through the same public IP as the API. True when both run on the
  same host (both compose files); breaks if you move one behind another egress.
- **One token covers the whole domain**, image CDN included
  (`c1.sushiscan.net`): `cf_clearance` is scoped to `.sushiscan.net`.
- **The protection level fluctuates.** On 2026-11-20 neither site was
  challenging (FlareSolverr: "Challenge not detected!"), but sushiscan.net
  was observed challenging on 2026-09-14. A quiet day proves nothing.

## Configuration

| Variable | Default | |
|---|---|---|
| `FLARESOLVERR_URL` | `http://localhost:8191/v1` | Empty disables solving: a challenge then fails with `ClearanceUnavailable`. Prod: `http://flaresolverr:8191/v1`. |
| `CF_CLEARANCE_TTL_SECONDS` | `1500` | Redis TTL of a cached clearance. |
| `ANIME_SAMA_PROXY_URL` | empty (direct) | HTTP proxy for all anime-sama traffic, see below. Prod: `http://gluetun:8888`. |

The `flaresolverr` service is in both compose files (pinned to `v3.5.2`). It
is stateless and heavy (one Chrome per solve). **Never publish its port**: it
fetches any URL it is asked to, which is an SSRF primitive. Dev binds it to
`127.0.0.1`, prod doesn't publish it at all.

If FlareSolverr stops getting past Cloudflare, alternatives exposing the
same `request.get` API (e.g. Byparr) can replace the image without code
changes.

## Proxy for origins that ban the server's IP (anime-sama)

A challenge solver only helps when Cloudflare *challenges*. anime-sama goes
further: it **blocks** hosting providers' IP ranges outright. From the prod
server, every request gets a `403` "Attention Required! | Cloudflare / Sorry,
you have been blocked" page (no `cf-mitigated`, so it is correctly not
treated as a challenge), and FlareSolverr itself fails with "Cloudflare has
blocked this request. Probably your IP is banned". A residential IP (a dev
machine) is not blocked.

The only fix is to leave through another IP. With `ANIME_SAMA_PROXY_URL` set,
`ProviderProxyService` (`api/src/domain/providerProxy/`) makes **every**
anime-sama request go through that proxy:

- the scrapers: `MangaFetcherService` runs them on
  `ProviderProxyService.httpClient(provider)`, an undici client over a
  `ProxyAgent`;
- the page downloads: the same client is passed to `fetchAndUpload`;
- FlareSolverr solves: `CloudflareService` adds `proxy: { url }` to the
  `request.get` command.

All three must share the exit IP, since a `cf_clearance` is bound to the IP
that earned it. If the VPN reconnects to another server, the cached clearance
dies with the old IP; the usual challenge, renew and retry path covers it.

Other providers never use the proxy.

In prod the proxy is a [gluetun](https://github.com/qdm12/gluetun) container
(ProtonVPN free, `FREE_ONLY=on`, `HTTPPROXY=on` on `:8888`), credentials in
`PROTON_OPENVPN_USER` / `PROTON_OPENVPN_PASSWORD` (the OpenVPN/IKEv2
credentials from account.proton.me, not the account password). Free servers
are shared and may get banned too: if anime-sama starts answering 403 again,
restart gluetun to land on another server. Like FlareSolverr, never publish
its port.

## Checking it works

```bash
docker compose up -d flaresolverr   # ~10 s to boot
curl -s localhost:8191/v1 -XPOST -H 'Content-Type: application/json' \
  -d '{"cmd":"request.get","url":"https://sushiscan.net","maxTimeout":60000}'
# → "status": "ok", a cf_clearance cookie and a userAgent
redis-cli get cf:clearance:SUSHISCAN_NET   # only after a real challenge
```

The retry path only runs when a site actually challenges, so it can't be
exercised on demand against the real sites.
