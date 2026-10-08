//! Pasta `assets/` ao lado do documento: imagens, desenhos (PNG + JSON) e cópia entre documentos.

use super::util::{io_err, slugify, split_name, unique_path};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use std::fs;
use std::path::{Component, Path, PathBuf};

/// Pasta `assets/` ao lado do arquivo .md (criada se não existir).
fn assets_dir(doc: &str) -> Result<PathBuf, String> {
    let parent = Path::new(doc)
        .parent()
        .ok_or_else(|| "O documento ainda não foi salvo em uma pasta.".to_string())?;
    let dir = parent.join("assets");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(io_err)?;
    }
    Ok(dir)
}

/// Copia uma imagem do disco para `assets/` e devolve o caminho relativo
/// pronto para o Markdown (ex.: `assets/desenho.png`).
#[tauri::command]
pub fn asset_copy(doc: String, src: String, name: Option<String>) -> Result<String, String> {
    let dir = assets_dir(&doc)?;
    let src_path = Path::new(&src);
    if !src_path.is_file() {
        return Err(format!("Arquivo não encontrado: {src}"));
    }
    let (src_stem, ext) = split_name(&src);
    let base = name.unwrap_or(src_stem);
    let target = unique_path(&dir, &slugify(&base), &ext);
    fs::copy(src_path, &target).map_err(io_err)?;
    let file_name = target
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(format!("assets/{file_name}"))
}

/// Grava bytes (enviados em base64 pelo editor/quadro de desenho) em `assets/`.
#[tauri::command]
pub fn asset_write(doc: String, name: String, data: String) -> Result<String, String> {
    let dir = assets_dir(&doc)?;
    let (stem, ext) = split_name(&name);
    let bytes = B64.decode(data.as_bytes()).map_err(|e| e.to_string())?;
    let target = unique_path(&dir, &slugify(&stem), &ext);
    fs::write(&target, bytes).map_err(io_err)?;
    let file_name = target
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(format!("assets/{file_name}"))
}

/// Atualiza apenas arquivos que estejam diretamente abaixo de `assets/`.
/// Usado para gravar PNG e JSON do mesmo desenho sem criar cópias a cada edição.
#[tauri::command]
pub fn asset_update(doc: String, relative: String, data: String) -> Result<(), String> {
    let mut parts = Path::new(&relative).components();
    if parts.next() != Some(Component::Normal(std::ffi::OsStr::new("assets"))) {
        return Err("O arquivo precisa estar dentro de assets/.".to_string());
    }
    let rest: Vec<_> = parts.collect();
    if rest.is_empty() || rest.iter().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("Caminho de arquivo inválido.".to_string());
    }
    let parent = Path::new(&doc)
        .parent()
        .ok_or_else(|| "Documento sem pasta de destino.".to_string())?;
    let target = parent.join(relative.replace('/', std::path::MAIN_SEPARATOR_STR));
    let bytes = B64.decode(data.as_bytes()).map_err(|e| e.to_string())?;
    fs::write(target, bytes).map_err(io_err)
}

/// Copia a pasta `assets/` de um documento para o lado do outro (sem sobrescrever).
/// Usado ao fazer "Salvar como" de um rascunho para uma pasta escolhida.
#[tauri::command]
pub fn copy_assets(from_doc: String, to_doc: String) -> Result<u32, String> {
    let from_dir = Path::new(&from_doc)
        .parent()
        .ok_or_else(|| "Documento de origem sem pasta.".to_string())?
        .join("assets");
    if !from_dir.is_dir() {
        return Ok(0);
    }
    let to_dir = Path::new(&to_doc)
        .parent()
        .ok_or_else(|| "Documento de destino sem pasta.".to_string())?
        .join("assets");
    if !to_dir.exists() {
        fs::create_dir_all(&to_dir).map_err(io_err)?;
    }
    let mut copied = 0u32;
    for entry in fs::read_dir(&from_dir).map_err(io_err)?.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let (stem, ext) = split_name(&name);
        let target = unique_path(&to_dir, &stem, &ext);
        fs::copy(&path, target).map_err(io_err)?;
        copied += 1;
    }
    Ok(copied)
}
