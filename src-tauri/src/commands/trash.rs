//! Lixeira de documentos.
//!
//! "Mover para a lixeira" tira o arquivo da pasta do projeto e o guarda na pasta de
//! dados do app (`lixeira/`), com um índice (`index.json`) que anota o caminho
//! original. O arquivo fica lá por 30 dias — dá para recuperar pela própria pasta,
//! no Explorer — e depois é apagado de vez na limpeza, que roda na abertura do app
//! e a cada arquivo movido. No desenvolvimento a pasta fica em `temp/lixeira` do
//! próprio projeto, como os rascunhos.

use super::util::{io_err, now_ms, project_root, write_atomic};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Dias que um arquivo fica guardado antes de ser apagado de vez.
const RETENTION_DAYS: u64 = 30;
/// Nome da pasta da lixeira (dentro da pasta de dados do app).
const FOLDER: &str = "lixeira";
/// Nome do índice dentro da pasta.
const INDEX: &str = "index.json";

/// Um item guardado na lixeira.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashEntry {
    /// nome do arquivo dentro da lixeira (ganha `-1`, `-2`… se já houver um igual)
    pub name: String,
    /// caminho original do arquivo (é por ele que se sabe de onde veio)
    pub original: String,
    /// quando foi movido, em ms desde 1970
    pub moved_at: u64,
    /// caminho do arquivo dentro da lixeira (para achar no Explorer)
    pub trash_path: String,
}

/// Pasta da lixeira: no desenvolvimento fica em `temp/lixeira` do projeto (a mesma
/// pasta que você vê no editor); instalado, na pasta de dados do app.
fn trash_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = match project_root() {
        Some(root) => root.join("temp").join(FOLDER),
        None => app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
            .join(FOLDER),
    };
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(io_err)?;
    }
    Ok(dir)
}

pub(crate) fn read_index(root: &Path) -> Vec<TrashEntry> {
    fs::read_to_string(root.join(INDEX))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_index(root: &Path, list: &[TrashEntry]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
    write_atomic(&root.join(INDEX), json.as_bytes())
}

/// Nome livre dentro da lixeira, preservando o nome original (`notas.md`, `notas-1.md`…).
fn free_name(root: &Path, name: &str) -> PathBuf {
    let p = Path::new(name);
    let ext = p.extension().map(|e| e.to_string_lossy().to_string());
    let stem = p
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "arquivo".to_string());
    let monta = |i: u32| {
        let sufixo = if i == 0 { String::new() } else { format!("-{i}") };
        match &ext {
            Some(e) => format!("{stem}{sufixo}.{e}"),
            None => format!("{stem}{sufixo}"),
        }
    };
    let mut i = 0;
    loop {
        let candidato = root.join(monta(i));
        if !candidato.exists() {
            return candidato;
        }
        i += 1;
    }
}

/// Move um arquivo para a lixeira e anota no índice (parte pura, testável).
pub(crate) fn mover(root: &Path, source: &Path, agora: u64) -> Result<TrashEntry, String> {
    fs::create_dir_all(root).map_err(io_err)?;
    let canon = fs::canonicalize(source).map_err(io_err)?;
    if !canon.is_file() {
        return Err("Só dá para mover arquivos para a lixeira.".to_string());
    }
    let base = fs::canonicalize(root).map_err(io_err)?;
    if canon.starts_with(&base) {
        return Err("Esse arquivo já está na lixeira.".to_string());
    }
    let nome = canon
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "arquivo".to_string());
    let destino = free_name(root, &nome);
    // `rename` só funciona no mesmo disco; a pasta de dados pode estar em outro
    if fs::rename(&canon, &destino).is_err() {
        fs::copy(&canon, &destino).map_err(io_err)?;
        fs::remove_file(&canon).map_err(io_err)?;
    }
    let item = TrashEntry {
        name: destino.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        original: canon.to_string_lossy().to_string(),
        moved_at: agora,
        trash_path: destino.to_string_lossy().to_string(),
    };
    let mut lista = read_index(root);
    lista.push(item.clone());
    write_index(root, &lista)?;
    Ok(item)
}

/// Apaga o que passou dos 30 dias e esquece itens que sumiram da pasta (recuperados
/// por fora, pelo Explorer). Devolve quantos arquivos foram apagados de vez.
pub(crate) fn limpar(root: &Path, agora: u64) -> Result<u32, String> {
    let corte = agora.saturating_sub(RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let base = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let mut manter: Vec<TrashEntry> = Vec::new();
    let mut apagados = 0u32;
    for item in read_index(root) {
        let arquivo = root.join(&item.name);
        if !arquivo.exists() {
            continue; // não está mais lá (restaurado por fora): sai do índice
        }
        if item.moved_at > 0 && item.moved_at < corte {
            // só apaga arquivo DENTRO da lixeira (mesma proteção do rascunho/backup)
            let dentro = fs::canonicalize(&arquivo).map(|c| c.starts_with(&base)).unwrap_or(false);
            if dentro && fs::remove_file(&arquivo).is_ok() {
                apagados += 1;
                continue;
            }
        }
        manter.push(item);
    }
    write_index(root, &manter)?;
    Ok(apagados)
}

/// Move um documento para a lixeira (a confirmação é feita pela interface).
#[tauri::command]
pub fn trash_move(app: tauri::AppHandle, path: String) -> Result<TrashEntry, String> {
    let root = trash_folder(&app)?;
    let agora = now_ms();
    let _ = limpar(&root, agora); // aproveita a visita para tirar o que venceu
    mover(&root, Path::new(&path), agora)
}

/// Apaga definitivamente o que passou dos 30 dias (chamado na abertura do app).
#[tauri::command]
pub fn trash_purge(app: tauri::AppHandle) -> Result<u32, String> {
    let root = trash_folder(&app)?;
    limpar(&root, now_ms())
}

/// Caminhos (em minúsculas) que estão guardados na lixeira — o aviso de "arquivo
/// sumiu" do backup usa isto para não reclamar de um arquivo movido de propósito.
pub(crate) fn trashed_paths(app: &tauri::AppHandle) -> Vec<String> {
    let Ok(root) = trash_folder(app) else {
        return Vec::new();
    };
    read_index(&root).iter().map(|e| e.original.to_lowercase()).collect()
}
