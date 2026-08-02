# manga-native (Neon binding)

`native/manga-native/` is a native Node addon, built with
[Neon](https://neon-bindings.com/) and scaffolded/managed with
`@neon-rs/cli`. It reuses the scraping logic already written in the
`http_to_epub` Rust CLI (a sibling repo, see [Sibling repo dependency](#sibling-repo-dependency)
below) and exposes it to TypeScript as a single async function.

## API

```ts
import { getMangaChapters, type MangaChapter, type MangaProvider } from "manga-native";

type MangaProvider = "SUSHISCAN" | "MANGA_ORIGINS";

interface MangaChapter {
  chapterNumber: number;
  pages: string[]; // page image URLs, in reading order
}

function getMangaChapters(slug: string, provider: MangaProvider): Promise<MangaChapter[]>;
```

`slug` is the provider's manga tag (e.g. `"jojos-bizarre-adventure"`). There's
no single-chapter lookup: a slug alone doesn't identify one chapter, so the
function fetches the manga's info then all of its chapters in one call.
Provider base URLs are hardcoded in `src/lib.rs` (`https://sushiscan.fr`,
`https://mangas-origines.fr`) — the TS caller only picks which provider, not
the URL.

## Structure

- `src/lib.rs` — the Rust side. `#[neon::export] async fn get_manga_chapters`
  dispatches to `htpp_to_epub::provider::{SushiScan, MangaOrigins}`
  (`Provider::get_manga_info` then `get_manga_chapters`), and maps the result
  to a local `MangaChapter` struct (`#[serde(rename_all = "camelCase")]`) so
  the JS side gets `chapterNumber`/`pages`, not the Rust `chapter_number`.
- `src/index.cts` / `src/index.mts` / `src/load.cts` — the TS wrapper (CJS +
  ESM entry points, standard Neon library pattern). `load.cts` just
  `require("../index.node")`; `index.cts` declares types for the untyped
  native export and re-exports a typed `getMangaChapters`.
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
the other thread.

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
by `api` as `"manga-native": "*"`. Not wired into any service or controller
yet — see `good-pratices.md` for how to add one, and
[error handling](error.md) for how to turn its `Promise` rejections into a
domain error before they reach a service.
