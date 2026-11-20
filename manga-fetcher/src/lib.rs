use std::collections::BTreeMap;
use std::future::Future;

use htpp_to_epub::builder::{build, BuildParams, FileMod};
use htpp_to_epub::provider::anime_sama::{AnimeSama, AnimeSamaManga};
use htpp_to_epub::provider::sushiscan_net::SushiScanNet;
use htpp_to_epub::provider::{
    manga_origins::MangaOrigins, sushiscan::SushiScan, CfChapter, Chapter, MangaInfo, Provider,
    TChapter,
};
use htpp_to_epub::utils::cloudflare::Clearance;
use htpp_to_epub::utils::{build_client, fetch_with_retry};
use neon::types::extract::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;

const BROWSER_USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MangaChapter {
    chapter_number: usize,
    pages: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MangaCatalogEntry {
    tag: String,
    name: String,
    cover_url: String,
    chapter_count: usize,
}

#[derive(Clone, Copy)]
enum MangaProvider {
    SushiScan,
    SushiScanNet,
    MangaOrigins,
    AnimeSama,
}

impl MangaProvider {
    fn parse(provider: &str) -> Result<Self, String> {
        match provider {
            "SUSHISCAN" => Ok(Self::SushiScan),
            "SUSHISCAN_NET" => Ok(Self::SushiScanNet),
            "MANGA_ORIGINS" => Ok(Self::MangaOrigins),
            "ANIME_SAMA" => Ok(Self::AnimeSama),
            other => Err(format!("unknown manga provider: {other}")),
        }
    }

    fn base_url(self) -> &'static str {
        match self {
            Self::SushiScan => "https://sushiscan.fr",
            Self::SushiScanNet => "https://sushiscan.net",
            Self::MangaOrigins => "https://mangas-origines.fr",
            Self::AnimeSama => "https://anime-sama.to",
        }
    }

    fn is_cloudflare_fronted(self) -> bool {
        matches!(self, Self::SushiScanNet | Self::AnimeSama)
    }
}

trait IntoMangaChapter {
    fn into_manga_chapter(self) -> MangaChapter;
}

impl IntoMangaChapter for Chapter {
    fn into_manga_chapter(self) -> MangaChapter {
        MangaChapter {
            chapter_number: self.chapter_number,
            pages: self.pages,
        }
    }
}

impl IntoMangaChapter for CfChapter {
    fn into_manga_chapter(self) -> MangaChapter {
        self.into_plain().into_manga_chapter()
    }
}

/// What the TS side needs from a provider's manga info, whatever its concrete type.
trait IntoCatalogEntry {
    fn into_catalog_entry(self) -> MangaCatalogEntry;
}

impl IntoCatalogEntry for MangaInfo {
    fn into_catalog_entry(self) -> MangaCatalogEntry {
        MangaCatalogEntry {
            tag: self.tag,
            name: self.name,
            cover_url: self.cover_url,
            chapter_count: self.chapter_count,
        }
    }
}

impl IntoCatalogEntry for AnimeSamaManga {
    fn into_catalog_entry(self) -> MangaCatalogEntry {
        MangaCatalogEntry {
            tag: self.tag,
            name: self.name,
            cover_url: self.cover_url,
            chapter_count: self.chapter_count,
        }
    }
}

async fn chapters_of<P>(client: &P, slug: &str) -> Result<Vec<MangaChapter>, String>
where
    P: Provider,
    P::Chapter: IntoMangaChapter,
{
    let manga_info = client
        .get_manga_info(slug)
        .await
        .map_err(|err| err.to_string())?;
    let chapters = client
        .get_manga_chapters(&manga_info)
        .await
        .map_err(|err| err.to_string())?;
    Ok(chapters
        .into_iter()
        .map(IntoMangaChapter::into_manga_chapter)
        .collect())
}

async fn catalog_of<P>(client: &P) -> Result<Vec<MangaCatalogEntry>, String>
where
    P: Provider,
    P::MangaInfo: IntoCatalogEntry,
{
    let infos = client.get_all_mangas().await.map_err(|err| err.to_string())?;
    Ok(infos
        .into_iter()
        .map(IntoCatalogEntry::into_catalog_entry)
        .collect())
}

fn sushiscan_net(clearance: Option<&Clearance>) -> Result<SushiScanNet, String> {
    let url = MangaProvider::SushiScanNet.base_url();
    match clearance {
        Some(clearance) => SushiScanNet::with_clearance(url, clearance),
        None => SushiScanNet::new(url),
    }
    .map_err(|err| err.to_string())
}

fn anime_sama(clearance: Option<&Clearance>) -> Result<AnimeSama, String> {
    AnimeSama::new(MangaProvider::AnimeSama.base_url(), clearance).map_err(|err| err.to_string())
}

/// Runs `job` to completion on a current-thread Tokio runtime owned by a dedicated
/// `std::thread`, and hands its result back through a oneshot channel.
///
/// `http_to_epub`'s provider futures are `!Send` (`Box<dyn Error>` without `Send`,
/// `scraper::Html` held across `.await`), so they can't run on Neon's multi-threaded
/// executor directly. Only the plain-data result crosses threads.
async fn run_on_own_thread<T, F, Fut>(label: &'static str, job: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Fut + Send + 'static,
    Fut: Future<Output = Result<T, String>>,
{
    let (tx, rx) = oneshot::channel();

    std::thread::spawn(move || {
        let result = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|err| err.to_string())
            .and_then(|runtime| runtime.block_on(job()));
        let _ = tx.send(result);
    });

    rx.await
        .map_err(|_| format!("{label} task panicked"))?
}

/// Récupère tous les chapitres d'un manga chez un provider donné.
/// `provider` attend "SUSHISCAN", "SUSHISCAN_NET", "MANGA_ORIGINS" ou "ANIME_SAMA".
/// `clearance` n'est utilisée que par les providers derrière Cloudflare, et seulement
/// quand Cloudflare challenge (sinon `null`).
#[neon::export]
async fn get_manga_chapters(
    slug: String,
    provider: String,
    clearance: Option<Json<Clearance>>,
) -> Result<Json<Vec<MangaChapter>>, String> {
    let provider = MangaProvider::parse(&provider)?;
    let clearance = clearance.map(|Json(c)| c);

    run_on_own_thread("manga chapters fetch", move || async move {
        let url = provider.base_url();
        match provider {
            MangaProvider::SushiScan => chapters_of(&SushiScan::new(url), &slug).await,
            MangaProvider::MangaOrigins => chapters_of(&MangaOrigins::new(url), &slug).await,
            MangaProvider::SushiScanNet => {
                chapters_of(&sushiscan_net(clearance.as_ref())?, &slug).await
            }
            MangaProvider::AnimeSama => chapters_of(&anime_sama(clearance.as_ref())?, &slug).await,
        }
    })
    .await
    .map(Json)
}

/// Récupère le catalogue complet d'un provider (pagination complète, peut prendre
/// plusieurs minutes). À n'appeler que depuis un job planifié, jamais depuis une
/// requête HTTP synchrone. Mêmes valeurs de `provider`/`clearance` que
/// `get_manga_chapters`.
#[neon::export]
async fn get_provider_catalog(
    provider: String,
    clearance: Option<Json<Clearance>>,
) -> Result<Json<Vec<MangaCatalogEntry>>, String> {
    let provider = MangaProvider::parse(&provider)?;
    let clearance = clearance.map(|Json(c)| c);

    run_on_own_thread("provider catalog fetch", move || async move {
        let url = provider.base_url();
        match provider {
            MangaProvider::SushiScan => catalog_of(&SushiScan::new(url)).await,
            MangaProvider::MangaOrigins => catalog_of(&MangaOrigins::new(url)).await,
            MangaProvider::SushiScanNet => catalog_of(&sushiscan_net(clearance.as_ref())?).await,
            MangaProvider::AnimeSama => catalog_of(&anime_sama(clearance.as_ref())?).await,
        }
    })
    .await
    .map(Json)
}

/// En-têtes HTTP à envoyer pour télécharger côté Node les pages renvoyées par
/// `get_manga_chapters`. Vide pour les providers sans protection ; pour ceux derrière
/// Cloudflare : `Referer` (protection anti-hotlink, toujours active), User-Agent de
/// navigateur et, si fournie, le cookie de clearance.
#[neon::export]
fn get_page_request_headers(
    provider: String,
    clearance: Option<Json<Clearance>>,
) -> Result<Json<BTreeMap<String, String>>, String> {
    let provider = MangaProvider::parse(&provider)?;
    let mut headers = BTreeMap::new();

    if provider.is_cloudflare_fronted() {
        headers.insert("Referer".to_string(), format!("{}/", provider.base_url()));
        match clearance {
            Some(Json(clearance)) => {
                headers.insert("User-Agent".to_string(), clearance.user_agent);
                headers.insert("Cookie".to_string(), clearance.cookie);
            }
            None => {
                headers.insert("User-Agent".to_string(), BROWSER_USER_AGENT.to_string());
            }
        }
    }

    Ok(Json(headers))
}

/// URL de base du provider : c'est elle qu'il faut faire résoudre par un solveur
/// Cloudflare (le `cf_clearance` couvre tout le domaine, CDN d'images compris).
#[neon::export]
fn get_provider_base_url(provider: String) -> Result<String, String> {
    Ok(MangaProvider::parse(&provider)?.base_url().to_string())
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

async fn build_epub_from(input: BuildEpubInput) -> Result<BuildEpubOutput, String> {
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
}

/// Construit un EPUB à partir de chapitres déjà hébergés (URLs présignées S3, pas de
/// scraping live) et l'écrit sur disque à `outputPath`.
#[neon::export]
async fn build_epub(input: Json<BuildEpubInput>) -> Result<Json<BuildEpubOutput>, String> {
    run_on_own_thread("epub build", move || build_epub_from(input.0))
        .await
        .map(Json)
}
