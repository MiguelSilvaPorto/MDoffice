//! Estrutura de pastas: contexto para a IA (inspecionar) e lista de documentos dos projetos.

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct FolderEntry {
    pub(crate) name: String,
    pub(crate) relative: String,
    pub(crate) directory: bool,
}

#[derive(Debug, Serialize)]
pub struct FolderSnapshot {
    pub(crate) root: String,
    pub(crate) entries: Vec<FolderEntry>,
    pub(crate) truncated: bool,
}

const IGNORED_DIRS: &[&str] = &[
    ".git",
    ".svn",
    "node_modules",
    "target",
    "dist",
    "build",
    ".venv",
    "venv",
    "__pycache__",
    ".next",
    ".nuxt",
    "vendor",
    "coverage",
    ".idea",
    ".vs",
];
const MAX_FOLDER_DEPTH: usize = 8;
const MAX_FOLDER_ENTRIES: usize = 700;

pub(crate) fn scan_folder(root: &Path) -> Result<FolderSnapshot, String> {
    if !root.is_dir() {
        return Err(format!("Não é uma pasta válida: {}", root.display()));
    }
    let mut snapshot = FolderSnapshot {
        root: root.to_string_lossy().to_string(),
        entries: Vec::new(),
        truncated: false,
    };
    scan_folder_inner(root, root, 0, &mut snapshot);
    Ok(snapshot)
}

fn scan_folder_inner(root: &Path, current: &Path, depth: usize, snapshot: &mut FolderSnapshot) {
    if depth >= MAX_FOLDER_DEPTH || snapshot.entries.len() >= MAX_FOLDER_ENTRIES {
        snapshot.truncated = true;
        return;
    }
    let Ok(read_dir) = fs::read_dir(current) else {
        return;
    };
    let mut children: Vec<_> = read_dir.filter_map(Result::ok).collect();
    children.sort_by_key(|entry| {
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        (!is_dir, entry.file_name().to_string_lossy().to_lowercase())
    });

    for entry in children {
        if snapshot.entries.len() >= MAX_FOLDER_ENTRIES {
            snapshot.truncated = true;
            break;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        // Symlinks não são seguidos para evitar sair da pasta escolhida.
        if file_type.is_symlink() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = file_type.is_dir();
        if is_dir
            && IGNORED_DIRS
                .iter()
                .any(|ignored| name.eq_ignore_ascii_case(ignored))
        {
            continue;
        }
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        snapshot.entries.push(FolderEntry {
            name,
            relative,
            directory: is_dir,
        });
        if is_dir {
            scan_folder_inner(root, &path, depth + 1, snapshot);
        }
    }
}

/// Examina apenas nomes e níveis de diretórios das pastas explicitamente escolhidas.
/// Não lê o conteúdo dos arquivos. Ignora dependências, pastas de build e symlinks.
#[tauri::command]
pub fn inspect_folders(paths: Vec<String>) -> Result<Vec<FolderSnapshot>, String> {
    if paths.len() > 8 {
        return Err("Selecione no máximo 8 pastas por vez.".to_string());
    }
    paths
        .iter()
        .map(|path| scan_folder(Path::new(path)))
        .collect()
}

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
            if !children.is_empty() {
                dirs.push(MdNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    directory: true,
                    children,
                });
            }
        } else if kind.is_file() {
            let lower = name.to_lowercase();
            if lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".mdx") || lower.ends_with(".docx") {
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

/// Lista os documentos Markdown de uma pasta (subpastas até 4 níveis; só as que têm .md).
#[tauri::command]
pub fn list_markdown(path: String) -> Result<Vec<MdNode>, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err("A pasta não foi encontrada.".to_string());
    }
    let mut budget = 400usize;
    Ok(scan_markdown(root, 4, &mut budget))
}
