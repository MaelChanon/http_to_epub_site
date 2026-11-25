# Manga fetcher (effect_http_to_epub)

Scraping and EPUB building come from
[`effect_http_to_epub`](https://www.npmjs.com/package/effect_http_to_epub), an
npm library built on Effect 4. The API wraps it in a single service,
`MangaFetcherService`
(`api/src/domain/mangaFetcher/mangaFetcher.service.ts`): nothing else imports
the library.

## Service

```ts
type MangaProvider = "SUSHISCAN" | "SUSHISCAN_NET" | "MANGA_ORIGINS" | "ANIME_SAMA" | "WEEBCENTRAL";

getMangaChapters(slug, provider, clearance?)      // Chapter[] ({ number, pages }), number starts at 0
getProviderCatalog(provider, clearance?)          // MangaInfo[] ({ tag, name, coverUrl, chapterCount })
getPageRequestHeaders(provider, url, clearance?)  // sync, headers to download a page with
buildEpub(input)                                  // writes the .epub to input.outputPath
```

- Provider base URLs are hardcoded in `SITES`, next to the library layer
  (`SushiScan`, `SushiScanNet`, `MangaOrigins`, `AnimeSama`, `WeebCentral`) and
  the language of each provider. `getProviderLang(provider)` gives the latter,
  written in the generated EPUBs. Adding a provider means one entry there, the
  `provider_name` DB enum (and its migration), and the catalogue link in
  `web/src/components/domain/manga/scanProvider.util.ts`.
- The site layer is rebuilt on every call, with the call's clearance. This is
  cheap: building it does no I/O.
- `getProviderCatalog` scrapes a provider's **entire** catalog (full
  pagination, then one request or more per manga). It can take several
  minutes: call it from a scheduled job, never from a request handler.
- Every library error becomes a `MangaFetcherFetchFailed` domain error (see
  [error handling](error.md)). `needsClearance` is `true` when it was a
  `ClearanceRequired`.
- `buildEpub` downloads from our own S3 (presigned URLs), with a direct HTTP
  client. A page that cannot be downloaded or decoded is logged and skipped, a
  missing cover fails the build, and a failed build leaves no file behind.
- The library retries transport errors, timeouts (60 s), 408, 429 and 5xx up
  to 3 times, and never a Cloudflare challenge.

Anime-sama tags are the work's slug for its first scan version, and
`<slug>.<dir>.<lang>` for the others (e.g. `one-piece.scan_noir-et-blanc.vf`).

## WEEBCENTRAL

English scans. Tags are the series id in the URL (`/series/<id>/<name>`).
The site's crawl delay is 10 s between page requests (a handful of parallel ones
gets a 429), which changes three things. Images, on another host, are not
concerned.

- **Shared delay.** The library spaces requests out per site layer, and the
  layer is rebuilt on every call, so `MangaFetcherService` adds one pacer shared
  by every weebcentral call (catalog refresh and concurrent syncs).
- **Catalog from the listing only.** The library's `getAllMangas` makes two more
  requests per series: over 10 000 series, it would take days.
  `getProviderCatalog` reads the listing pages instead (about an hour), so
  entries have no chapter count (`0`, shown as unknown). The cron gives it a
  4 hour timeout instead of 45 minutes.
- **Slow syncs.** A sync takes at least 10 s per chapter, and longer than the
  30 minute stale cutoff past ~180 chapters, so `runSync` heartbeats
  the link while it scrapes.

## HTTP client and proxy

Scraping uses `ProviderProxyService.httpClient(provider)`: the provider's
proxied client when it has a proxy, `fetch` otherwise. The proxied client is
undici's, which does not follow redirects, so `ProviderProxyService` adds
`HttpClient.followRedirects()` (it drops the cookie when the origin changes).

## Cloudflare

Two separate protections apply:

- **Hotlink protection, always on.** sushiscan.net answers `403` to an image
  request without `Referer: https://sushiscan.net/`. Page images are downloaded
  by `fetchAndUpload` (`api/src/domain/s3/s3.ops.ts`), outside the library, so
  they must be sent with `getPageRequestHeaders(provider, url)`: a browser
  User-Agent, plus the `Referer` and the clearance when `url` is on the
  provider's own domain (image CDN subdomains included).
- **The Cloudflare challenge, intermittent.** The call fails with
  `needsClearance`, the API gets a clearance from FlareSolverr and retries
  once: see [cloudflare-clearance.md](cloudflare-clearance.md).

### Known issue: MANGA_ORIGINS

On 2026-11-24, mangas-origines.fr challenged every page requested by Node
(`fetch`, `undici` and `https`, Node 22 and 24, with or without browser
headers), while curl and the former Rust addon got a `200`. A `cf_clearance`
from FlareSolverr did not help. Chapter syncs and catalog refreshes of this
provider therefore fail; images are not affected. The stored chapters and
catalog stay as they were.

## Updating

```bash
npm install -w @workspace/api effect_http_to_epub@latest
```

The library depends on `sharp`, whose prebuilt binary is installed by npm for
the current platform. No native toolchain is needed.
