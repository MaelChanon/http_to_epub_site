# manga-fetcher (Neon binding)

`manga-fetcher/` is a native Node addon, built with
[Neon](https://neon-bindings.com/) and scaffolded/managed with
`@neon-rs/cli`. It reuses the scraping logic already written in the
`http_to_epub` Rust crate (a git submodule, see [The http_to_epub submodule](#the-http_to_epub-submodule)
below) and exposes it to TypeScript.

## API

```ts
import {
  getMangaChapters,
  getProviderCatalog,
  getPageRequestHeaders,
  type Clearance,
  type MangaChapter,
  type MangaCatalogEntry,
  type MangaProvider,
} from "manga-fetcher";

type MangaProvider = "SUSHISCAN" | "SUSHISCAN_NET" | "MANGA_ORIGINS" | "ANIME_SAMA";

interface Clearance {
  cookie: string;    // full Cookie header, e.g. "cf_clearance=abc..."
  userAgent: string; // the exact UA the cookie was issued to
}

// Only for SUSHISCAN_NET / ANIME_SAMA (a proxy for another provider is an error)
interface ProviderAccess {
  clearance?: Clearance; // while Cloudflare is challenging
  proxyUrl?: string;     // HTTP(S) proxy for every request, if the origin bans our IP
}

interface MangaChapter {
  chapterNumber: number;
  pages: string[]; // page image URLs, in reading order
}

interface MangaCatalogEntry {
  tag: string;
  name: string;
  coverUrl: string;
  chapterCount: number;
}

function getMangaChapters(slug: string, provider: MangaProvider, access?: ProviderAccess): Promise<MangaChapter[]>;
function getProviderCatalog(provider: MangaProvider, access?: ProviderAccess): Promise<MangaCatalogEntry[]>;
function getPageRequestHeaders(provider: MangaProvider, clearance?: Clearance): Record<string, string>; // sync
function buildEpub(input: BuildEpubInput): Promise<BuildEpubOutput>;
```


`getProviderCatalog` scrapes a provider's **entire** manga catalog (full
pagination, one `get_manga_info` call per manga found) — it can take several
minutes and is meant to be called from a scheduled job, never from a
synchronous HTTP request.

Provider base URLs are hardcoded in `src/lib.rs` (`https://sushiscan.fr`,
`https://sushiscan.net`, `https://mangas-origines.fr`, `https://anime-sama.to`)
(the TS caller only picks which provider, not the URL).

## Cloudflare-fronted providers (`SUSHISCAN_NET`, `ANIME_SAMA`)

Both origins sit behind Cloudflare. Two separate protections apply (see the
crate's `utils/cloudflare.rs` for the details):

- **Hotlink protection, always on.** sushiscan.net answers `403` to an image
  request without `Referer: https://sushiscan.net/`. The crate handles this for
  its own requests, but **page images are downloaded by Node**
  (`fetchAndUpload` in `api/src/domain/s3/s3.ops.ts`, from `processChapter` in
  `scanProvider.service.ts`), so Node must send the same headers. That is what
  `getPageRequestHeaders(provider)` returns: `Referer` + a browser
  `User-Agent` (+ `Cookie` with a clearance) for these two providers, `{}` for
  the others. Pass them per request, never as `httpClient` defaults: a
  clearance cookie must not leak to other hosts.
- **The Cloudflare challenge, intermittent.** When it is on, every request
  needs a `cf_clearance` cookie, bound to the browser UA and exit IP that
  earned it. The `clearance` parameter is optional. When Cloudflare is
  challenging, calls reject with a message prefixed by
  `CLEARANCE_REQUIRED_MARKER` (`"CF_CLEARANCE_REQUIRED"`, exported from
  `manga-fetcher`). The API then gets a clearance from FlareSolverr and
  retries once: see [cloudflare-clearance.md](cloudflare-clearance.md).

Anime-sama tags are the work's slug for its first scan version, and
`<slug>.<dir>.<lang>` for the others (e.g. `one-piece.scan_noir-et-blanc.vf`).

## Structure

- `src/index.cts` / `src/index.mts` / `src/load.cts` — the TS wrapper (CJS +
  ESM entry points, standard Neon library pattern). `load.cts` just
  `require("../index.node")`; `index.cts` declares types for the untyped
  native export and re-exports typed wrappers.
- `Cargo.toml` — depends on `htpp_to_epub` via `path = "../http_to_epub"`,
  and on `neon` with the `tokio` and `serde` features (see below).

## Why a dedicated thread + a one-shot channel

`http_to_epub`'s `Provider` trait returns `Box<dyn std::error::Error>` (no
`+ Send`), and its chapter-fetch futures hold `scraper::Html` values across
`.await` points — both make those futures `!Send`. `#[neon::export]` on an
`async fn` spawns onto Neon's multi-threaded Tokio executor, which requires
`Future: Send`, so the `http_to_epub` calls can't be awaited directly inside
the exported function.

`run_on_own_thread` works around this without touching `http_to_epub`:
it spawns a plain `std::thread`, builds a **current-thread** Tokio runtime on
it, and `block_on`s the whole non-Send call chain there — never crossing a
thread mid-`.await`. Only the final `Result<T, String>` (all plain data,
trivially `Send`) crosses back to the exported `async fn` through a
`tokio::sync::oneshot` channel, which *is* `Send` regardless of what ran on
the other thread. Every async export (`get_manga_chapters`,
`get_provider_catalog`, `build_epub`) goes through it.

Providers don't share concrete types (`Provider` has associated `MangaInfo` /
`Chapter` types, e.g. `AnimeSamaManga`, `CfChapter`), so the generic
`chapters_of` / `catalog_of` helpers convert through two small local traits,
`IntoMangaChapter` and `IntoCatalogEntry`. Adding a provider = a new
`MangaProvider` variant + one arm per `match`, plus the two trait impls if it
introduces new types.

## The http_to_epub submodule

`http_to_epub/` is a git submodule pointing at
`github.com/MaelChanon/http_to_epub` (the crate is named `htpp_to_epub`).
Clone with `git clone --recurse-submodules`, or run
`git submodule update --init` in an existing checkout. CI checks it out with
`submodules: true` (`.github/workflows/deploy.yml`) and `api/Dockerfile`
copies it into the build.

To pick up new commits from the crate:

```bash
git -C http_to_epub pull origin main
git add http_to_epub   # records the new commit in this repo
```

## Building

```bash
cd manga-fetcher
npm install
npm run build   # tsc (compiles src/*.cts,*.mts to lib/) + cargo build --release + `neon dist` (copies the built cdylib to ./index.node)
```

`npm run debug` does the same without `--release`. There's no cross-platform
build/CI setup (`@neon-rs/cli`'s `neon dist`/`neon add`/platform packages) —
this is wired for a single local build (whatever platform you build on),
matching how it's used in this monorepo. `index.node`, `lib/`, `target/`,
and `cargo.log` are gitignored and must be rebuilt per machine/environment.

## Using it from the API

`manga-fetcher` is an npm workspace (root `package.json`), depended on
by `api` as `"manga-fetcher": "*"`. It's wrapped by `api/src/domain/mangaFetcher/mangaFetcher.service.ts`
(`MangaFetcherService`), which turns every `Promise` rejection into a
`MangaFetcherFetchFailed` domain error via `Effect.tryPromise` — see
[error handling](error.md) for the general pattern. `ScanProviderService` and
the scan cron jobs (`api/src/domain/scanProvider/`) are the current consumers.
