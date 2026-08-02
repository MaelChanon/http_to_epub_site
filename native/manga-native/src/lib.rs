use htpp_to_epub::provider::{manga_origins::MangaOrigins, sushiscan::SushiScan, Provider};
use neon::types::extract::Json;
use serde::Serialize;
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