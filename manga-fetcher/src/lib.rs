use htpp_to_epub::builder::{build, BuildParams, FileMod};
use htpp_to_epub::provider::{manga_origins::MangaOrigins, sushiscan::SushiScan, Chapter, MangaInfo, Provider, TChapter};
use htpp_to_epub::utils::{build_client, fetch_with_retry};
use neon::types::extract::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MangaChapter {
    chapter_number: usize,
    pages: Vec<String>,
}

#[derive(Clone, Copy)]
enum MangaProvider {
    SushiScan,
    MangaOrigins,
}

impl MangaProvider {
    fn parse(provider: &str) -> Result<Self, String> {
        match provider {
            "SUSHISCAN" => Ok(Self::SushiScan),
            "MANGA_ORIGINS" => Ok(Self::MangaOrigins),
            other => Err(format!("unknown manga provider: {other}")),
        }
    }

    fn base_url(self) -> &'static str {
        match self {
            Self::SushiScan => "https://sushiscan.fr",
            Self::MangaOrigins => "https://mangas-origines.fr",
        }
    }
}

fn fetch_chapters_blocking(
    provider: MangaProvider,
    slug: String,
) -> Result<Vec<MangaChapter>, String> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|err| err.to_string())?;

    runtime.block_on(async move {
        let chapters = match provider {
            MangaProvider::SushiScan => {
                let client = SushiScan::new(provider.base_url());
                let manga_info = client
                    .get_manga_info(&slug)
                    .await
                    .map_err(|err| err.to_string())?;
                client
                    .get_manga_chapters(&manga_info)
                    .await
                    .map_err(|err| err.to_string())?
            }
            MangaProvider::MangaOrigins => {
                let client = MangaOrigins::new(provider.base_url());
                let manga_info = client
                    .get_manga_info(&slug)
                    .await
                    .map_err(|err| err.to_string())?;
                client
                    .get_manga_chapters(&manga_info)
                    .await
                    .map_err(|err| err.to_string())?
            }
        };

        Ok(chapters
            .into_iter()
            .map(|chapter| MangaChapter {
                chapter_number: chapter.chapter_number,
                pages: chapter.pages,
            })
            .collect())
    })
}

/// Récupère tous les chapitres d'un manga chez un provider donné.
/// `provider` attend "SUSHISCAN" ou "MANGA_ORIGINS".
#[neon::export]
async fn get_manga_chapters(
    slug: String,
    provider: String,
) -> Result<Json<Vec<MangaChapter>>, String> {
    let provider = MangaProvider::parse(&provider)?;
    let (tx, rx) = oneshot::channel();

    std::thread::spawn(move || {
        let _ = tx.send(fetch_chapters_blocking(provider, slug));
    });

    rx.await
        .map_err(|_| "manga chapters fetch task panicked".to_string())?
        .map(Json)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MangaCatalogEntry {
    tag: String,
    name: String,
    cover_url: String,
    chapter_count: usize,
}

fn fetch_catalog_blocking(provider: MangaProvider) -> Result<Vec<MangaCatalogEntry>, String> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|err| err.to_string())?;

    runtime.block_on(async move {
        let infos = match provider {
            MangaProvider::SushiScan => {
                let client = SushiScan::new(provider.base_url());
                client
                    .get_all_mangas()
                    .await
                    .map_err(|err| err.to_string())?
            }
            MangaProvider::MangaOrigins => {
                let client = MangaOrigins::new(provider.base_url());
                client
                    .get_all_mangas()
                    .await
                    .map_err(|err| err.to_string())?
            }
        };

        Ok(infos
            .into_iter()
            .map(|info| MangaCatalogEntry {
                tag: info.tag,
                name: info.name,
                cover_url: info.cover_url,
                chapter_count: info.chapter_count,
            })
            .collect())
    })
}

/// Récupère le catalogue complet d'un provider (pagination complète, peut prendre
/// plusieurs minutes). À n'appeler que depuis un job planifié, jamais depuis une
/// requête HTTP synchrone. `provider` attend "SUSHISCAN" ou "MANGA_ORIGINS".
#[neon::export]
async fn get_provider_catalog(provider: String) -> Result<Json<Vec<MangaCatalogEntry>>, String> {
    let provider = MangaProvider::parse(&provider)?;
    let (tx, rx) = oneshot::channel();

    std::thread::spawn(move || {
        let _ = tx.send(fetch_catalog_blocking(provider));
    });

    rx.await
        .map_err(|_| "provider catalog fetch task panicked".to_string())?
        .map(Json)
}

fn fetch_chapter_numbers_blocking(
    provider: MangaProvider,
    slug: String,
) -> Result<Vec<usize>, String> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|err| err.to_string())?;

    runtime.block_on(async move {
        let chapters = match provider {
            MangaProvider::SushiScan => {
                let client = SushiScan::new(provider.base_url());
                let manga_info = client
                    .get_manga_info(&slug)
                    .await
                    .map_err(|err| err.to_string())?;
                client
                    .get_manga_chapters(&manga_info)
                    .await
                    .map_err(|err| err.to_string())?
            }
            MangaProvider::MangaOrigins => {
                let client = MangaOrigins::new(provider.base_url());
                let manga_info = client
                    .get_manga_info(&slug)
                    .await
                    .map_err(|err| err.to_string())?;
                client
                    .get_manga_chapters(&manga_info)
                    .await
                    .map_err(|err| err.to_string())?
            }
        };

        Ok(chapters
            .into_iter()
            .map(|chapter| chapter.chapter_number)
            .collect())
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildEpubChapterInput {
    chapter_number: usize,
    /// URLs présignées vers notre propre S3, pas des URLs du site source.
    pages: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildEpubInput {
    tag: String,
    name: String,
    cover_url: String,
    creator: String,
    lang: String,
    width: u32,
    height: u32,
    split_double_page: bool,
    chapters: Vec<BuildEpubChapterInput>,
    output_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BuildEpubOutput {
    file_size_bytes: u64,
}

fn build_epub_blocking(input: BuildEpubInput) -> Result<BuildEpubOutput, String> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|err| err.to_string())?;

    runtime.block_on(async move {
        let client = build_client();
        let cover = fetch_with_retry(&client, &input.cover_url)
            .await
            .map_err(|err| err.to_string())?;

        let manga_info = MangaInfo {
            tag: input.tag,
            name: input.name,
            cover_url: input.cover_url,
            chapter_count: input.chapters.len(),
        };

        let chapters = input
            .chapters
            .into_iter()
            .map(|c| {
                Box::new(Chapter {
                    pages: c.pages,
                    chapter_number: c.chapter_number,
                }) as Box<dyn TChapter + Send + Sync>
            })
            .collect();

        let params = BuildParams {
            width: input.width,
            height: input.height,
            cover,
            chapters,
            manga_info: Box::new(manga_info),
            creator: input.creator,
            lang: input.lang,
            split_double_page: input.split_double_page,
        };

        let output_path = std::path::PathBuf::from(&input.output_path);
        build(&FileMod::EPUB(params), &output_path)
            .await
            .map_err(|err| err.to_string())?;

        let size = std::fs::metadata(&output_path)
            .map_err(|err| err.to_string())?
            .len();

        Ok(BuildEpubOutput {
            file_size_bytes: size,
        })
    })
}

/// Construit un EPUB à partir de chapitres déjà hébergés (URLs présignées S3, pas de
/// scraping live) et l'écrit sur disque à `outputPath`.
#[neon::export]
async fn build_epub(input: Json<BuildEpubInput>) -> Result<Json<BuildEpubOutput>, String> {
    let (tx, rx) = oneshot::channel();

    std::thread::spawn(move || {
        let _ = tx.send(build_epub_blocking(input.0));
    });

    rx.await
        .map_err(|_| "epub build task panicked".to_string())?
        .map(Json)
}