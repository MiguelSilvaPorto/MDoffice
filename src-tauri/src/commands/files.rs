//! Ler e gravar arquivos, renomear, criar pastas e ler imagens como data URL.

use super::backup;
use super::util::{io_err, slugify, split_name, unique_path};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use std::fs;
use std::path::{Path, PathBuf};

/// Lê um arquivo de texto (.md, .markdown, .txt…) como UTF-8.
#[tauri::command]
pub fn load_text(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(io_err)?;
    // anota o conteúdo para a proteção antes de sobrescrever saber o que está no disco
    backup::note_disk_content(&path, &bytes);
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

/// Grava texto, criando a pasta de destino se necessário.
///
/// Antes de sobrescrever um arquivo existente, guarda a versão anterior (quando o backup
/// está ligado e o conteúdo do disco mudou por fora do app).
#[tauri::command]
pub fn save_text(app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.exists() {
            fs::create_dir_all(dir).map_err(io_err)?;
        }
    }
    backup::protect_before_write(&app, &path, content.as_bytes());
    fs::write(&p, content).map_err(io_err)
}

/// Devolve o conteúdo de uma imagem como data URL (usado na pré-visualização).
#[tauri::command]
pub fn read_file_data_url(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(io_err)?;
    let ext = Path::new(&path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    };
    Ok(format!("data:{};base64,{}", mime, B64.encode(bytes)))
}

/// Sugere um caminho `.md` livre dentro de `dir` (acrescenta -1, -2… se já existir).
/// Usado para salvar automaticamente documentos novos em Documentos/mdOffice.
#[tauri::command]
pub fn unique_md_path(dir: String, base: String) -> Result<String, String> {
    let d = PathBuf::from(&dir);
    if !d.exists() {
        fs::create_dir_all(&d).map_err(io_err)?;
    }
    let target = unique_path(&d, &slugify(&base), "md");
    Ok(target.to_string_lossy().to_string())
}

/// Renomeia o arquivo do documento (mantendo a mesma pasta) e devolve o caminho novo.
/// O nome é limpo de caracteres inválidos e nunca sobrescreve um arquivo existente.
#[tauri::command]
pub fn rename_file(from: String, to: String) -> Result<String, String> {
    let src = Path::new(&from);
    // guarda o conteúdo antes de renomear, para o caminho novo já valer como conhecido
    let conteudo = if src.is_file() { fs::read(src).ok() } else { None };
    if let Some(b) = &conteudo {
        backup::note_disk_content(&from, b);
    }
    if !src.is_file() {
        return Err("O arquivo do documento não foi encontrado.".to_string());
    }
    let parent = src
        .parent()
        .ok_or_else(|| "Arquivo sem pasta de destino.".to_string())?;
    // limpa o nome: separadores e caracteres inválidos viram "-" (não descarta partes)
    let mut clean: String = to
        .trim()
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            other => other,
        })
        .collect();
    clean = clean.trim().trim_matches('.').trim().to_string();
    if clean.is_empty() {
        clean = "documento.md".to_string();
    }
    if Path::new(&clean).extension().is_none() {
        clean.push_str(".md");
    }
    let (stem, ext) = split_name(&clean);
    let target = unique_path(parent, &stem, &ext);
    // o caminho antigo deixa de valer: a proteção passa a valer para o novo nome
    backup::forget_write(&from);
    fs::rename(src, &target).map_err(io_err)?;
    if let Some(b) = &conteudo {
        backup::note_disk_content(&target.to_string_lossy(), b);
    }
    Ok(target.to_string_lossy().to_string())
}

/// Cria uma subpasta (e devolve o caminho dela).
#[tauri::command]
pub fn create_folder(parent: String, name: String) -> Result<String, String> {
    let clean: String = name
        .trim()
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c => c,
        })
        .collect();
    if clean.is_empty() || clean == "." || clean == ".." {
        return Err("Nome de pasta inválido.".to_string());
    }
    let target = Path::new(&parent).join(clean);
    if target.exists() {
        return Err("Já existe uma pasta com esse nome.".to_string());
    }
    fs::create_dir_all(&target).map_err(io_err)?;
    Ok(target.to_string_lossy().to_string())
}

/// Grava bytes (base64) num arquivo, criando a pasta de destino se preciso (DOCX, PDF…).
#[tauri::command]
pub fn save_binary(app: tauri::AppHandle, path: String, data: String) -> Result<(), String> {
    let bytes = B64.decode(data.as_bytes()).map_err(|e| e.to_string())?;
    let p = PathBuf::from(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.exists() {
            fs::create_dir_all(dir).map_err(io_err)?;
        }
    }
    backup::protect_before_write(&app, &path, &bytes);
    fs::write(&p, bytes).map_err(io_err)
}
