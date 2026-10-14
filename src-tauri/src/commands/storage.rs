//! Armazenamento: quanto o app ocupa no disco (dados do app e a pasta legada da renomeação),
//! a limpeza da pasta antiga e o **limite do cache do WebView**.
//!
//! - **Dados do app**: `%LOCALAPPDATA%\com.mdoffice.desktop` (rascunhos, backup e o perfil do
//!   WebView, onde vivem as versões, o log de alterações e o cache).
//! - **Legado**: `%LOCALAPPDATA%\com.mdcreator.desktop` — a pasta da versão anterior à
//!   renomeação. A migração copiou o que importava para a pasta nova; esta fica para trás e
//!   pode ser removida (com confirmação) para liberar espaço.
//! - **Cache do WebView**: por padrão o WebView decide quanto guardar (uma fatia do disco
//!   livre). O app deixa escolher um teto, guardado em `cache.json` (MB; 0 = automático) e
//!   passado como `--disk-cache-size` na criação da janela — por isso a janela é montada no
//!   `lib.rs`: o argumento precisa chegar **antes** de o WebView existir.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use super::util::write_atomic;

/// Identificador do app (o mesmo do `tauri.conf.json`): manda no nome da pasta de dados.
pub(crate) const IDENTIFICADOR: &str = "com.mdoffice.desktop";

/// Pastas do perfil do WebView que são **cache** (o resto é preferência ou dado que fica).
///
/// A lista vale para dois lugares: a **cópia** da pasta antiga na renomeação (cache não vai —
/// é o grosso do tamanho e se recria sozinho) e a **conta** do cache no painel. Os nomes são
/// os do Chromium/WebView2; a busca desce alguns níveis porque o perfil fica em
/// `EBWebView\Default`, e isso muda entre versões do WebView2.
pub(crate) const PASTAS_DE_CACHE: [&str; 11] = [
    "Cache",
    "Code Cache",
    "GPUCache",
    "ShaderCache",
    "GrShaderCache",
    "GPUPersistentCache",
    "DawnGraphiteCache",
    "DawnWebGPUCache",
    "CacheStorage",
    "component_crx_cache",
    "extensions_crx_cache",
];

/// Nome do arquivo da configuração do cache, na pasta de dados.
const CACHE_CFG: &str = "cache.json";

/// Tetos de cache oferecidos na tela, em MB (0 = automático, quem decide é o WebView).
pub(crate) const LIMITES_MB: [u64; 5] = [0, 512, 1024, 2048, 4096];

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    app.path().app_local_data_dir().map_err(|e| e.to_string())
}

/// Pasta de dados do app sem o `AppHandle` — `%LOCALAPPDATA%\com.mdoffice.desktop`.
///
/// O `lib.rs` precisa dela antes de o Tauri existir, para ler o teto do cache e montar os
/// argumentos da janela (é o mesmo caminho que o `app_local_data_dir` devolve no Windows).
pub(crate) fn pasta_local() -> Option<PathBuf> {
    std::env::var("LOCALAPPDATA").ok().map(|base| PathBuf::from(base).join(IDENTIFICADOR))
}

/// Soma o tamanho de uma pasta (recursivo, melhor esforço: o que falhar é ignorado).
pub(crate) fn soma_pasta(dir: &Path) -> u64 {
    let mut total = 0u64;
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    for entry in entries.flatten() {
        let Ok(tipo) = entry.file_type() else { continue };
        if tipo.is_dir() {
            total += soma_pasta(&entry.path());
        } else if let Ok(meta) = entry.metadata() {
            total += meta.len();
        }
    }
    total
}

/// Soma só o cache do perfil do WebView (o "Outros dados" ainda mistura preferências e outros
/// arquivos; este número é o cache em si).
///
/// O perfil fica em `EBWebView\Default`, mas o lugar muda entre versões do WebView2: a busca
/// desce até 3 níveis e, ao encontrar uma pasta de cache, soma tudo e **não desce** nela
/// (senão `Service Worker\CacheStorage` contaria duas vezes).
pub(crate) fn soma_cache(dir: &Path) -> u64 {
    fn desce(dir: &Path, nivel: u8) -> u64 {
        let mut total = 0u64;
        let Ok(entries) = std::fs::read_dir(dir) else {
            return 0;
        };
        for entry in entries.flatten() {
            if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            let nome = entry.file_name().to_string_lossy().to_string();
            if PASTAS_DE_CACHE.iter().any(|p| p.eq_ignore_ascii_case(&nome)) {
                total += soma_pasta(&entry.path());
            } else if nivel < 3 {
                total += desce(&entry.path(), nivel + 1);
            }
        }
        total
    }
    desce(dir, 0)
}

/// Pasta de dados da versão anterior (`com.mdcreator.desktop`), se ainda existir.
fn pasta_legada() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let base = std::env::var("LOCALAPPDATA").ok()?;
        let antiga = PathBuf::from(base).join("com.mdcreator.desktop");
        if antiga.is_dir() {
            return Some(antiga);
        }
    }
    None
}

#[derive(Debug, Serialize)]
pub struct StorageReport {
    /// pasta de dados atual do app
    pub data_dir: String,
    /// tamanho total da pasta de dados (inclui o cache do WebView)
    pub data_bytes: u64,
    /// só o cache do WebView, dentro da pasta de dados
    pub cache_bytes: u64,
    /// pasta da versão anterior, quando ainda existe
    pub legacy_dir: Option<String>,
    pub legacy_bytes: u64,
}

/// Relatório de armazenamento para a tela de Configurações.
#[tauri::command]
pub fn storage_report(app: tauri::AppHandle) -> Result<StorageReport, String> {
    let data = data_dir(&app)?;
    let data_bytes = soma_pasta(&data);
    let cache_bytes = soma_cache(&data);
    let legada = pasta_legada();
    let legacy_bytes = legada.as_deref().map(soma_pasta).unwrap_or(0);
    Ok(StorageReport {
        data_dir: data.to_string_lossy().to_string(),
        data_bytes,
        cache_bytes,
        legacy_dir: legada.map(|p| p.to_string_lossy().to_string()),
        legacy_bytes,
    })
}

/// Remove a pasta de dados da versão anterior. Devolve quantos bytes foram liberados.
/// Só age quando a pasta atual existe (a migração já rodou) e o caminho é o esperado.
#[tauri::command]
pub fn storage_remove_legacy(app: tauri::AppHandle) -> Result<u64, String> {
    let data = data_dir(&app)?;
    if !data.is_dir() {
        return Err("A pasta de dados atual não existe — nada foi removido.".into());
    }
    let Some(antiga) = pasta_legada() else {
        return Ok(0);
    };
    let bytes = soma_pasta(&antiga);
    std::fs::remove_dir_all(&antiga).map_err(|e| format!("Não foi possível remover a pasta antiga: {e}"))?;
    Ok(bytes)
}

// ---------------------------------------------------------------------------
// limite do cache do WebView
// ---------------------------------------------------------------------------

/// Configuração do cache: o teto pedido e o que está **em uso** nesta sessão.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct CacheConfig {
    /// teto pedido, em MB (0 = automático)
    #[serde(default)]
    pub limite_mb: u64,
    /// teto que a janela desta sessão recebeu, em MB (0 = automático)
    #[serde(default)]
    pub aplicado_mb: u64,
}

fn caminho_do_cache() -> Option<PathBuf> {
    Some(pasta_local()?.join(CACHE_CFG))
}

/// Lê o JSON da configuração do cache (o que não der para entender vira o padrão).
pub(crate) fn config_de_json(txt: &str) -> CacheConfig {
    serde_json::from_str(txt).unwrap_or_default()
}

/// Lê o `cache.json` sem reclamar: arquivo ausente ou estragado vira o padrão (automático).
pub(crate) fn ler_config() -> CacheConfig {
    caminho_do_cache()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|txt| config_de_json(&txt))
        .unwrap_or_default()
}

fn gravar_config(cfg: CacheConfig) -> Result<(), String> {
    let caminho = caminho_do_cache().ok_or("Sem pasta de dados do app para guardar o cache.")?;
    let json = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    write_atomic(&caminho, json.as_bytes())
}

/// Argumentos extras do WebView2: os padrões do wry + o teto do cache, quando há um.
///
/// Os padrões precisam vir junto: passar argumentos substitui o que o wry poria sozinho
/// (sem o menu "mini" do Windows e sem o SmartScreen). Sem teto escolhido, ficam só eles —
/// ou seja, "automático" continua sendo o comportamento de sempre.
pub(crate) fn argumentos_do_webview(limite_mb: u64) -> String {
    let mut args = String::from("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection");
    if limite_mb > 0 {
        args.push_str(&format!(" --disk-cache-size={}", limite_mb * 1024 * 1024));
    }
    args
}

/// Chamado uma vez na abertura, antes de a janela existir: marca o teto como **em uso**
/// nesta sessão e devolve os argumentos do WebView2.
pub(crate) fn preparar_webview() -> String {
    let mut cfg = ler_config();
    cfg.aplicado_mb = cfg.limite_mb;
    let _ = gravar_config(cfg);
    argumentos_do_webview(cfg.limite_mb)
}

/// O teto do cache (MB) e o que está em uso nesta sessão.
#[tauri::command]
pub fn storage_cache_config(app: tauri::AppHandle) -> Result<CacheConfig, String> {
    data_dir(&app)?;
    Ok(ler_config())
}

/// Confere se o teto pedido é uma das opções da tela (0 = automático).
pub(crate) fn validar_limite(limite_mb: u64) -> Result<u64, String> {
    if LIMITES_MB.contains(&limite_mb) {
        Ok(limite_mb)
    } else {
        Err(format!("Limite de cache fora das opções: {limite_mb} MB."))
    }
}

/// Grava o teto do cache (MB). Vale na próxima abertura do app — o WebView só lê o argumento
/// quando é criado.
#[tauri::command]
pub fn storage_set_cache_limit(app: tauri::AppHandle, limite_mb: u64) -> Result<CacheConfig, String> {
    data_dir(&app)?;
    let mut cfg = ler_config();
    cfg.limite_mb = validar_limite(limite_mb)?;
    gravar_config(cfg)?;
    Ok(cfg)
}
