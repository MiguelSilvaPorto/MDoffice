//! Busca de texto dentro dos documentos Markdown das pastas (sem diferenciar acento/maiúscula).

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct SearchHit {
    pub path: String,
    pub name: String,
    pub line: usize,
    pub text: String,
    pub start: usize,
    pub end: usize,
}

/// Minúscula e sem acento, caractere a caractere (os índices continuam alinhados).
fn fold_char(c: char) -> char {
    let l = c.to_lowercase().next().unwrap_or(c);
    match l {
        'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'í' | 'ì' | 'î' | 'ï' => 'i',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
        'ú' | 'ù' | 'û' | 'ü' => 'u',
        'ç' => 'c',
        'ñ' => 'n',
        x => x,
    }
}

fn collect_markdown(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    let Ok(read) = fs::read_dir(dir) else { return };
    for entry in read.flatten() {
        if out.len() >= 2000 {
            return;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_symlink() {
            continue;
        }
        let path = entry.path();
        if kind.is_dir() {
            if depth > 0 && !matches!(name.as_str(), "node_modules" | "target" | "dist" | "build") {
                collect_markdown(&path, depth - 1, out);
            }
        } else if kind.is_file() {
            let lower = name.to_lowercase();
            if lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".mdx") {
                out.push(path);
            }
        }
    }
}

/// Procura um texto dentro dos documentos Markdown das pastas (sem diferenciar maiúsculas/acentos).
#[tauri::command]
pub fn search_markdown(roots: Vec<String>, query: String, limit: usize) -> Result<Vec<SearchHit>, String> {
    let needle: Vec<char> = query.trim().chars().map(fold_char).collect();
    if needle.len() < 2 {
        return Ok(Vec::new());
    }
    let limit = limit.clamp(1, 300);
    let mut files = Vec::new();
    for root in &roots {
        collect_markdown(Path::new(root), 6, &mut files);
    }
    let mut hits = Vec::new();
    'files: for path in files {
        let Ok(meta) = fs::metadata(&path) else { continue };
        if meta.len() > 2_000_000 {
            continue;
        }
        let Ok(text) = fs::read_to_string(&path) else { continue };
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        let mut per_file = 0;
        for (i, line) in text.lines().enumerate() {
            let chars: Vec<char> = line.chars().collect();
            let folded: Vec<char> = chars.iter().map(|c| fold_char(*c)).collect();
            let Some(pos) = folded.windows(needle.len()).position(|w| w == needle.as_slice()) else {
                continue;
            };
            // recorte de até ~140 caracteres em volta do achado
            let from = pos.saturating_sub(50);
            let to = (pos + needle.len() + 90).min(chars.len());
            let snippet: String = chars[from..to].iter().collect();
            hits.push(SearchHit {
                path: path.to_string_lossy().to_string(),
                name: name.clone(),
                line: i + 1,
                text: snippet,
                start: pos - from,
                end: pos - from + needle.len(),
            });
            per_file += 1;
            if hits.len() >= limit {
                break 'files;
            }
            if per_file >= 5 {
                break;
            }
        }
    }
    Ok(hits)
}
