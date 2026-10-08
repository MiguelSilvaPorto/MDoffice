//! Utilitários comuns dos comandos (nomes de arquivo seguros, erros de E/S).

use std::path::{Path, PathBuf};

pub(crate) fn io_err(e: std::io::Error) -> String {
    e.to_string()
}

/// Deixa o nome de arquivo simples e seguro (sem acentos, espaços ou símbolos).
pub(crate) fn slugify(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_dash = false;
    for ch in input.chars() {
        let mapped = match ch {
            'á' | 'à' | 'â' | 'ã' | 'ä' | 'Á' | 'À' | 'Â' | 'Ã' | 'Ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' | 'Ú' | 'Ù' | 'Û' | 'Ü' => 'u',
            'ç' | 'Ç' => 'c',
            'ñ' | 'Ñ' => 'n',
            other => other,
        };
        if mapped.is_ascii_alphanumeric() {
            out.push(mapped.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        "arquivo".to_string()
    } else {
        out
    }
}

/// Evita sobrescrever arquivos: `nome.png`, `nome-1.png`, `nome-2.png`…
pub(crate) fn unique_path(dir: &Path, base: &str, ext: &str) -> PathBuf {
    let mut candidate = dir.join(format!("{base}.{ext}"));
    let mut i = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{base}-{i}.{ext}"));
        i += 1;
    }
    candidate
}

pub(crate) fn split_name(name: &str) -> (String, String) {
    let p = Path::new(name);
    let ext = p
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "png".to_string());
    let stem = p
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "arquivo".to_string());
    (stem, ext)
}
