//! Lista de documentos ("árvore" de .md/.docx/.xlsx/.pptx) das pastas dos projetos.

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct MdNode {
    pub name: String,
    pub path: String,
    pub directory: bool,
    pub children: Vec<MdNode>,
}

fn scan_markdown(dir: &Path, depth: usize, budget: &mut usize) -> Vec<MdNode> {
    let Ok(read) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut entries: Vec<_> = read.flatten().collect();
    entries.sort_by_key(|e| e.file_name().to_string_lossy().to_lowercase());
    let mut dirs = Vec::new();
    let mut docs = Vec::new();
    for entry in entries {
        if *budget == 0 {
            break;
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
            if depth == 0 || matches!(name.as_str(), "node_modules" | "target" | "dist" | "assets" | "build") {
                continue;
            }
            let children = scan_markdown(&path, depth - 1, budget);
            // pasta VAZIA também entra na árvore: é onde o usuário cria uma pasta nova
            // e depois arrasta documentos para dentro dela.
            dirs.push(MdNode {
                name,
                path: path.to_string_lossy().to_string(),
                directory: true,
                children,
            });
        } else if kind.is_file() {
            let lower = name.to_lowercase();
            if lower.ends_with(".md")
                || lower.ends_with(".markdown")
                || lower.ends_with(".mdx")
                || lower.ends_with(".docx")
                || lower.ends_with(".xlsx")
                || lower.ends_with(".xlsm")
                || lower.ends_with(".pptx")
            {
                *budget = budget.saturating_sub(1);
                docs.push(MdNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    directory: false,
                    children: Vec::new(),
                });
            }
        }
    }
    dirs.extend(docs);
    dirs
}

/// Lista os documentos de uma pasta (subpastas até 4 níveis, inclusive as vazias).
#[tauri::command]
pub fn list_markdown(path: String) -> Result<Vec<MdNode>, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err("A pasta não foi encontrada.".to_string());
    }
    let mut budget = 400usize;
    Ok(scan_markdown(root, 4, &mut budget))
}
