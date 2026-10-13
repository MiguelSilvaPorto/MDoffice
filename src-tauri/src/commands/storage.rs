//! Armazenamento: quanto o app ocupa no disco (dados do app e a pasta legada da renomeação)
//! e a limpeza da pasta antiga.
//!
//! - **Dados do app**: `%LOCALAPPDATA%\com.mdoffice.desktop` (rascunhos, backup e o perfil do
//!   WebView, onde vivem as versões e o log de alterações).
//! - **Legado**: `%LOCALAPPDATA%\com.mdcreator.desktop` — a pasta da versão anterior à
//!   renomeação. A migração copiou o que importava para a pasta nova; esta fica para trás e
//!   pode ser removida (com confirmação) para liberar espaço.

use serde::Serialize;
use std::path::{Path, PathBuf};

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    app.path().app_local_data_dir().map_err(|e| e.to_string())
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
    /// pasta da versão anterior, quando ainda existe
    pub legacy_dir: Option<String>,
    pub legacy_bytes: u64,
}

/// Relatório de armazenamento para a tela de Configurações.
#[tauri::command]
pub fn storage_report(app: tauri::AppHandle) -> Result<StorageReport, String> {
    let data = data_dir(&app)?;
    let data_bytes = soma_pasta(&data);
    let legada = pasta_legada();
    let legacy_bytes = legada.as_deref().map(soma_pasta).unwrap_or(0);
    Ok(StorageReport {
        data_dir: data.to_string_lossy().to_string(),
        data_bytes,
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
