# manga-native (Neon binding)

`native/manga-native/` is a native Node addon, built with
[Neon](https://neon-bindings.com/) and scaffolded/managed with
`@neon-rs/cli`. It reuses the scraping logic already written in the
`http_to_epub` Rust CLI (a sibling repo, see [Sibling repo dependency](#sibling-repo-dependency)
below) and exposes it to TypeScript as three async functions.

## API

```ts
import {
  getMangaChapters,
  getProviderCatalog,
  type MangaChapter,
  type MangaCatalogEntry,
  type MangaProvider,
} from "manga-native";

type MangaProvider = "SUSHISCAN" | "MANGA_ORIGINS";

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

function getMangaChapters(slug: string, provider: MangaProvider): Promise<MangaChapter[]>;
function getProviderCatalog(provider: MangaProvider): Promise<MangaCatalogEntry[]>;
```


`getProviderCatalog` scrapes a provider's **entire** manga catalog (full
pagination, one `get_manga_info` call per manga found) — it can take several
minutes and is meant to be called from a scheduled job, never from a
synchronous HTTP request.

Provider base URLs are hardcoded in `src/lib.rs` (`https://sushiscan.fr`,
`https://mangas-origines.fr`) — the TS caller only picks which provider, not
the URL.

## Structure

- `src/index.cts` / `src/index.mts` / `src/load.cts` — the TS wrapper (CJS +
  ESM entry points, standard Neon library pattern). `load.cts` just
  `require("../index.node")`; `index.cts` declares types for the untyped
  native export and re-exports typed `getMangaChapters`/`getProviderCatalog`.
- `Cargo.toml` — depends on `htpp_to_epub` via `path = "../../http_to_epub"`,
  and on `neon` with the `tokio` and `serde` features (see below).

## Why a dedicated thread + a one-shot channel

`http_to_epub`'s `Provider` trait returns `Box<dyn std::error::Error>` (no
`+ Send`), and its chapter-fetch futures hold `scraper::Html` values across
`.await` points — both make those futures `!Send`. `#[neon::export]` on an
`async fn` spawns onto Neon's multi-threaded Tokio executor, which requires
`Future: Send`, so the `http_to_epub` calls can't be awaited directly inside
the exported function.

`fetch_chapters_blocking` works around this without touching `http_to_epub`:
it spawns a plain `std::thread`, builds a **current-thread** Tokio runtime on
it, and `block_on`s the whole non-Send call chain there — never crossing a
thread mid-`.await`. Only the final `Result<Vec<MangaChapter>, String>` (all
plain data, trivially `Send`) crosses back to the exported `async fn` through
a `tokio::sync::oneshot` channel, which *is* `Send` regardless of what ran on
the other thread. `fetch_catalog_blocking` and `fetch_chapter_numbers_blocking`
follow the exact same shape for `get_provider_catalog`.

## Sibling repo dependency

`http_to_epub/` (the Rust CLI, cloned as a sibling directory of this repo) is
**not** tracked by this repo's git history and has its own separate git repo.
Building `manga-native` requires it to be present on disk at
`../../http_to_epub` relative to `native/manga-native/`.

It originally only built a binary (`src/main.rs`, no library target), which
can't be depended on via `path =`. A minimal `http_to_epub/src/lib.rs` was
added (`pub mod provider; mod utils;`, no logic changes) purely to expose a
lib target — commit that in the `http_to_epub` repo itself if you want it to
persist there.

## Building

```bash
cd native/manga-native
npm install
npm run build   # tsc (compiles src/*.cts,*.mts to lib/) + cargo build --release + `neon dist` (copies the built cdylib to ./index.node)
```

`npm run debug` does the same without `--release`. There's no cross-platform
build/CI setup (`@neon-rs/cli`'s `neon dist`/`neon add`/platform packages) —
this is wired for a single local build (whatever platform you build on),
matching how it's used in this monorepo. `index.node`, `lib/`, `target/`,
and `cargo.log` are gitignored and must be rebuilt per machine/environment.

## Using it from the API

`native/manga-native` is an npm workspace (root `package.json`), depended on
by `api` as `"manga-native": "*"`. It's wrapped by `api/src/manga/mangaNative.service.ts`
(`MangaNativeService`), which turns every `Promise` rejection into a
`MangaNativeFetchFailed` domain error via `Effect.tryPromise` — see
[error handling](error.md) for the general pattern. `ScanProviderService` and
the scan cron jobs (`api/src/scanProvider/`) are the current consumers.
