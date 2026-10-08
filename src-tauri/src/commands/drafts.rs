//! Rascunhos do app (salvamento automático) e a pasta padrão de documentos.

use super::util::{io_err, slugify, unique_path};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// Raiz do projeto em desenvolvimento (pasta que tem package.json e src-tauri).
fn project_root() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    for _ in 0..5 {
        if dir.join("package.json").exists() && dir.join("src-tauri").exists() {
            return Some(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

/// Pasta do salvamento automático (rascunhos).
/// Preferimos `temp/` dentro do PRÓPRIO PROJETO — é a pasta que você vê no editor durante
/// o desenvolvimento. No app instalado (sem projeto por perto) usa a pasta de dados do app.
fn drafts_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = match project_root() {
        Some(root) => root.join("temp"),
        None => app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
            .join("rascunhos"),
    };
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(io_err)?;
    }
    Ok(dir)
}

/// Remove rascunhos bem antigos (mais de 15 dias) para a pasta não crescer sem fim.
fn prune_drafts(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(15 * 24 * 60 * 60);
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e != "md" && e != "docx").unwrap_or(true) {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if let Ok(modified) = meta.modified() {
                if modified < cutoff {
                    let _ = fs::remove_file(&path);
                }
            }
        }
    }
}

#[derive(Debug, Serialize)]
pub struct DraftInfo {
    path: String,
    modified_ms: u64,
}

/// Lista os rascunhos guardados pelo app (mais novo primeiro).
#[tauri::command]
pub fn list_drafts(app: tauri::AppHandle) -> Result<Vec<DraftInfo>, String> {
    let dir = drafts_folder(&app)?;
    prune_drafts(&dir);
    let mut items: Vec<DraftInfo> = Vec::new();
    let Ok(entries) = fs::read_dir(&dir) else {
        return Ok(items);
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e != "md" && e != "docx").unwrap_or(true) {
            continue;
        }
        let modified_ms = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        items.push(DraftInfo {
            path: path.to_string_lossy().to_string(),
            modified_ms,
        });
    }
    items.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(items)
}

/// Caminho livre para um novo rascunho (nome vindo do título do documento).
#[tauri::command]
pub fn draft_path(app: tauri::AppHandle, base: String, ext: Option<String>) -> Result<String, String> {
    let dir = drafts_folder(&app)?;
    prune_drafts(&dir);
    let ext = match ext.as_deref() {
        Some("docx") => "docx",
        _ => "md",
    };
    let target = unique_path(&dir, &slugify(&base), ext);
    Ok(target.to_string_lossy().to_string())
}

/// Apaga um rascunho (só permite arquivos dentro da pasta de rascunhos do app).
#[tauri::command]
pub fn delete_draft(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = drafts_folder(&app)?;
    let target = fs::canonicalize(&path).map_err(io_err)?;
    let base = fs::canonicalize(&dir).map_err(io_err)?;
    if !target.starts_with(&base) {
        return Err("Esse arquivo não é um rascunho do app.".to_string());
    }
    fs::remove_file(target).map_err(io_err)
}

/// Pasta padrão para novos documentos: `Documentos/mdCreator` (criada se preciso).
#[tauri::command]
pub fn default_docs_dir(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("mdCreator");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(io_err)?;
    }
    Ok(dir.to_string_lossy().to_string())
}
