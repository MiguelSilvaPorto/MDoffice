//! Comandos do backend: leitura/gravação de arquivos, pasta de imagens e
//! imagens como data URL para a pré-visualização.

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipWriter};

fn io_err(e: std::io::Error) -> String {
    e.to_string()
}

/// Lê um arquivo de texto (.md, .markdown, .txt…) como UTF-8.
#[tauri::command]
pub fn load_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(io_err)
}

/// Grava texto, criando a pasta de destino se necessário.
#[tauri::command]
pub fn save_text(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.exists() {
            fs::create_dir_all(dir).map_err(io_err)?;
        }
    }
    fs::write(&p, content).map_err(io_err)
}

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

/// Deixa o nome de arquivo simples e seguro (sem acentos, espaços ou símbolos).
fn slugify(input: &str) -> String {
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
fn unique_path(dir: &Path, base: &str, ext: &str) -> PathBuf {
    let mut candidate = dir.join(format!("{base}.{ext}"));
    let mut i = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{base}-{i}.{ext}"));
        i += 1;
    }
    candidate
}

fn split_name(name: &str) -> (String, String) {
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

#[derive(Debug, Serialize)]
pub struct FolderEntry {
    name: String,
    relative: String,
    directory: bool,
}

#[derive(Debug, Serialize)]
pub struct FolderSnapshot {
    root: String,
    entries: Vec<FolderEntry>,
    truncated: bool,
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

fn scan_folder(root: &Path) -> Result<FolderSnapshot, String> {
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

/// Extrai os destinos das imagens Markdown sem interpretar nem executar HTML.
fn markdown_image_targets(markdown: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let mut cursor = 0;
    while let Some(start) = markdown[cursor..].find("![") {
        let absolute_start = cursor + start;
        let Some(label_end_rel) = markdown[absolute_start + 2..].find("](") else {
            cursor = absolute_start + 2;
            continue;
        };
        let dest_start = absolute_start + 2 + label_end_rel + 2;
        let Some(dest_end_rel) = markdown[dest_start..].find(')') else {
            cursor = dest_start;
            continue;
        };
        let raw = markdown[dest_start..dest_start + dest_end_rel].trim();
        let mut target = raw.split_whitespace().next().unwrap_or("").trim();
        if target.starts_with('<') && target.ends_with('>') && target.len() >= 2 {
            target = &target[1..target.len() - 1];
        }
        if !target.is_empty() && !targets.iter().any(|existing| existing == target) {
            targets.push(target.to_string());
        }
        cursor = dest_start + dest_end_rel + 1;
    }
    targets
}

fn add_zip_file(zip: &mut ZipWriter<fs::File>, name: &str, bytes: &[u8]) -> Result<(), String> {
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);
    zip.start_file(name.replace('\\', "/"), options)
        .map_err(|e| e.to_string())?;
    zip.write_all(bytes).map_err(io_err)
}

/// Cria um único ZIP portátil com o Markdown, suas imagens locais referenciadas,
/// JSONs editáveis dos desenhos e uma folha simples de orientação para a IA.
#[tauri::command]
pub fn export_portable_bundle(
    doc_path: String,
    content: String,
    output_path: String,
) -> Result<usize, String> {
    let doc = Path::new(&doc_path);
    let parent = doc
        .parent()
        .ok_or_else(|| "Salve o Markdown em uma pasta antes de exportar o pacote.".to_string())?;
    let doc_name = doc
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "Nome do documento inválido.".to_string())?;

    let output = fs::File::create(&output_path).map_err(io_err)?;
    let mut zip = ZipWriter::new(output);
    add_zip_file(&mut zip, &doc_name, content.as_bytes())?;

    let mut bundled_images = 0usize;
    let mut bundled_sidecars = 0usize;
    for target in markdown_image_targets(&content) {
        // Data URLs já estão dentro do Markdown; imagens web continuam acessíveis pela rede.
        if target.starts_with("data:")
            || target.starts_with("https://")
            || target.starts_with("http://")
        {
            continue;
        }
        let rel_path = Path::new(&target);
        if rel_path.is_absolute()
            || rel_path
                .components()
                .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)))
        {
            return Err(format!(
                "A imagem '{target}' está fora da pasta do documento. Mova-a para assets/ antes de exportar."
            ));
        }
        let source = parent.join(rel_path);
        if !source.is_file() {
            return Err(format!(
                "A imagem '{target}' não foi encontrada. O pacote não foi finalizado."
            ));
        }
        let bytes = fs::read(&source).map_err(io_err)?;
        add_zip_file(&mut zip, &target, &bytes)?;
        bundled_images += 1;

        // O sidecar preserva a possibilidade de editar desenhos após descompactar.
        let sidecar_rel = format!("{target}.draw.json");
        let sidecar_path = parent.join(&sidecar_rel);
        if sidecar_path.is_file() {
            let sidecar = fs::read(sidecar_path).map_err(io_err)?;
            add_zip_file(&mut zip, &sidecar_rel, &sidecar)?;
            bundled_sidecars += 1;
        }
    }

    let instructions = format!(
        "# Instruções para a IA\n\nEste pacote contém o documento `{doc_name}` e {bundled_images} imagem(ns) local(is) referenciada(s) por ele. Os desenhos editáveis também incluem {bundled_sidecars} arquivo(s) JSON auxiliar(es). Imagens externas (URLs HTTP/HTTPS) não são copiadas; elas precisam de internet.\n\n## O que quero que você faça?\nDescreva a tarefa de forma direta.\n\n## Como quero o resultado?\n- Formato da resposta:\n- Tom e nível de detalhe:\n- Estrutura desejada:\n\n## Contexto e critérios\n- O que é importante manter:\n- Restrições ou exemplos:\n\nAbra o Markdown e considere as imagens incluídas no diretório `assets/` como referências visuais.\n"
    );
    add_zip_file(&mut zip, "INSTRUCOES_PARA_IA.md", instructions.as_bytes())?;
    zip.finish().map_err(|e| e.to_string())?;
    Ok(bundled_images)
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
/// Usado para salvar automaticamente documentos novos em Documentos/mdCreator.
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
    fs::rename(src, &target).map_err(io_err)?;
    Ok(target.to_string_lossy().to_string())
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn inspeciona_arvore_sem_entrar_em_pastas_de_dependencias() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("relógio válido")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("mdcreator-tree-{nonce}"));
        fs::create_dir_all(root.join("src/components")).expect("cria subpastas");
        fs::create_dir_all(root.join("node_modules/pacote")).expect("cria pasta ignorada");
        fs::write(root.join("src/main.rs"), "// teste").expect("cria arquivo");
        fs::write(root.join("src/components/editor.ts"), "// teste")
            .expect("cria arquivo aninhado");
        fs::write(root.join("README.md"), "# teste").expect("cria readme");
        fs::write(root.join("node_modules/pacote/index.js"), "// ignorado")
            .expect("cria dependência");

        let snap = scan_folder(&root).expect("estrutura deve ser lida");
        let paths: Vec<_> = snap.entries.iter().map(|e| e.relative.as_str()).collect();
        assert!(paths.contains(&"src"));
        assert!(paths.contains(&"src/main.rs"));
        assert!(paths.contains(&"src/components"));
        assert!(paths.contains(&"src/components/editor.ts"));
        assert!(paths.contains(&"README.md"));
        assert!(!paths.iter().any(|p| p.contains("node_modules")));
        fs::remove_dir_all(&root).expect("limpa arquivos de teste");
    }

    #[test]
    fn copia_assets_ao_sair_do_rascunho_sem_sobrescrever() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("relógio válido")
            .as_nanos();
        let from_dir = std::env::temp_dir().join(format!("mdcreator-assets-from-{nonce}"));
        let to_dir = std::env::temp_dir().join(format!("mdcreator-assets-to-{nonce}"));
        fs::create_dir_all(from_dir.join("assets")).expect("cria assets origem");
        fs::create_dir_all(to_dir.join("assets")).expect("cria assets destino");
        fs::write(from_dir.join("assets/desenho-a.png"), [1u8, 2, 3]).expect("imagem origem");
        fs::write(from_dir.join("assets/desenho-b.json"), b"{\"x\":1}").expect("json origem");
        fs::write(from_dir.join("doc.md"), "origem").expect("doc origem");
        fs::write(to_dir.join("assets/desenho-a.png"), [9u8, 9, 9]).expect("conflito no destino");

        let copied = copy_assets(
            from_dir.join("doc.md").to_string_lossy().to_string(),
            to_dir.join("doc.md").to_string_lossy().to_string(),
        )
        .expect("copia assets");
        assert_eq!(copied, 2);
        assert_eq!(
            fs::read(to_dir.join("assets/desenho-a.png")).expect("lê original"),
            vec![9u8, 9, 9],
            "não pode sobrescrever o arquivo existente"
        );
        assert_eq!(
            fs::read(to_dir.join("assets/desenho-a-1.png")).expect("lê cópia com sufixo"),
            vec![1u8, 2, 3]
        );
        assert_eq!(
            fs::read(to_dir.join("assets/desenho-b.json")).expect("lê json copiado"),
            b"{\"x\":1}"
        );
        fs::remove_dir_all(&from_dir).expect("limpa origem");
        fs::remove_dir_all(&to_dir).expect("limpa destino");
    }

    #[test]
    fn renomeia_documento_sem_sobrescrever() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("relógio válido")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("mdcreator-rename-{nonce}"));
        fs::create_dir_all(&dir).expect("cria pasta");
        let original = dir.join("antigo.md");
        fs::write(&original, "conteúdo").expect("cria arquivo");
        fs::write(dir.join("Novo Nome.md"), "já existia").expect("cria conflito");

        // nome inválido é limpo e ".md" é acrescentado
        let novo = rename_file(
            original.to_string_lossy().to_string(),
            "Novo/Nome?estranho".to_string(),
        )
        .expect("renomeia");
        assert!(novo.ends_with("Novo-Nome-estranho.md"), "veio: {novo}");

        // se o nome já existe, ganha sufixo em vez de sobrescrever
        let arquivo2 = dir.join("outro.md");
        fs::write(&arquivo2, "x").expect("cria arquivo");
        let novo2 = rename_file(
            arquivo2.to_string_lossy().to_string(),
            "Novo Nome.md".to_string(),
        )
        .expect("renomeia com conflito");
        assert!(novo2.ends_with("Novo Nome-1.md"), "veio: {novo2}");
        assert_eq!(
            fs::read_to_string(dir.join("Novo Nome.md")).expect("lê antigo"),
            "já existia"
        );
        fs::remove_dir_all(&dir).expect("limpa arquivos de teste");
    }

    #[test]
    fn sugere_caminho_md_livre_sem_sobrescrever() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("relógio válido")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("mdcreator-mdpath-{nonce}"));
        let first = unique_md_path(
            dir.to_string_lossy().to_string(),
            "Meu Documento Ácido".to_string(),
        )
        .expect("sugere caminho");
        assert!(first.ends_with("meu-documento-acido.md"), "veio: {first}");
        fs::write(&first, "conteúdo").expect("cria arquivo");
        let second = unique_md_path(
            dir.to_string_lossy().to_string(),
            "Meu Documento Ácido".to_string(),
        )
        .expect("sugere caminho livre");
        assert!(
            second.ends_with("meu-documento-acido-1.md"),
            "veio: {second}"
        );
        assert_ne!(first, second);
        fs::remove_dir_all(&dir).expect("limpa arquivos de teste");
    }

    #[test]
    fn pacote_portatil_leva_markdown_imagem_json_e_modelo_de_instrucao() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("relógio válido")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("mdcreator-bundle-{nonce}"));
        let assets = root.join("assets");
        fs::create_dir_all(&assets).expect("cria pasta assets");
        fs::write(assets.join("desenho-teste.png"), [137, 80, 78, 71])
            .expect("cria imagem de teste");
        fs::write(
            assets.join("desenho-teste.png.draw.json"),
            r#"{"version":1,"elements":[]}"#,
        )
        .expect("cria sidecar do desenho");
        let markdown = "# Brief\n\n![Desenho](assets/desenho-teste.png)\n";
        let doc_path = root.join("brief.md");
        let zip_path = root.join("brief-para-ia.zip");
        fs::write(&doc_path, markdown).expect("cria markdown");

        let count = export_portable_bundle(
            doc_path.to_string_lossy().to_string(),
            markdown.to_string(),
            zip_path.to_string_lossy().to_string(),
        )
        .expect("cria pacote zip");
        assert_eq!(count, 1);

        let file = fs::File::open(&zip_path).expect("abre zip");
        let mut archive = zip::ZipArchive::new(file).expect("zip válido");
        let names: Vec<_> = archive.file_names().map(str::to_string).collect();
        assert!(names.contains(&"brief.md".to_string()));
        assert!(names.contains(&"assets/desenho-teste.png".to_string()));
        assert!(names.contains(&"assets/desenho-teste.png.draw.json".to_string()));
        assert!(names.contains(&"INSTRUCOES_PARA_IA.md".to_string()));

        let mut guide = String::new();
        archive
            .by_name("INSTRUCOES_PARA_IA.md")
            .expect("modelo no ZIP")
            .read_to_string(&mut guide)
            .expect("lê modelo");
        assert!(guide.contains("O que quero que você faça?"));
        assert!(guide.contains("Como quero o resultado?"));
        fs::remove_dir_all(&root).expect("limpa arquivos de teste");
    }
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
pub fn save_binary(path: String, data: String) -> Result<(), String> {
    let bytes = B64.decode(data.as_bytes()).map_err(|e| e.to_string())?;
    let p = PathBuf::from(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.exists() {
            fs::create_dir_all(dir).map_err(io_err)?;
        }
    }
    fs::write(&p, bytes).map_err(io_err)
}

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
