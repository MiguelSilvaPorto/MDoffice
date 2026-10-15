//! Ler e gravar arquivos, renomear, criar pastas e ler imagens como data URL.
//!
//! Os comandos são `#[tauri::command(async)]`: no Tauri 2, um comando sem `async`
//! roda na thread principal — e uma gravação em pasta de rede (UNC/SMB) pode levar
//! centenas de milissegundos, travando a interface inteira. Com o atributo, o
//! comando é despachado para o pool de tarefas do runtime e a main thread segue
//! respondendo (é ela que processa a janela e o IPC).

use super::backup;
use super::util::{io_err, slugify, split_name, unique_path};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

/// Grava os bytes no destino, criando a pasta somente quando ela falta.
///
/// O caminho comum (a pasta já existe) não gasta nenhuma ida extra ao disco: a
/// gravação acontece direto e só um `NotFound` dispara a criação da pasta e a
/// segunda tentativa. Antes havia um `exists()` a cada salvamento — em pasta de
/// rede, uma ida ao disco a mais em série por cada gravação.
pub(crate) fn gravar_bytes(p: &Path, bytes: &[u8]) -> Result<(), String> {
    match fs::write(p, bytes) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => {
            // pasta nova (primeiro salvamento) ou apagada por fora: cria e tenta de novo
            let Some(dir) = p.parent().filter(|d| !d.as_os_str().is_empty()) else {
                return Err(io_err(e));
            };
            fs::create_dir_all(dir).map_err(io_err)?;
            fs::write(p, bytes).map_err(io_err)
        }
        Err(e) => Err(io_err(e)),
    }
}

/// Lê um arquivo de texto (.md, .markdown, .txt…) como UTF-8.
#[tauri::command(async)]
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
#[tauri::command(async)]
pub fn save_text(app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    backup::protect_before_write(&app, &path, content.as_bytes());
    gravar_bytes(Path::new(&path), content.as_bytes())
}

/// Devolve o conteúdo de uma imagem como data URL (usado na pré-visualização).
#[tauri::command(async)]
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
#[tauri::command(async)]
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
#[tauri::command(async)]
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
#[tauri::command(async)]
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
#[tauri::command(async)]
pub fn save_binary(app: tauri::AppHandle, path: String, data: String) -> Result<(), String> {
    let bytes = B64.decode(data.as_bytes()).map_err(|e| e.to_string())?;
    backup::protect_before_write(&app, &path, &bytes);
    gravar_bytes(Path::new(&path), &bytes)
}

/// Quantos caracteres a prévia devolve (o cartão mostra bem menos; a folga cobre a quebra).
const PREVIA_CHARS: usize = 320;

/// Prévia de um documento para a tela Início: o começo do texto (o título e as primeiras linhas).
///
/// Os formatos de pacote (.docx/.pptx/.xlsx) abrem o zip e tiram o texto do XML principal — o
/// suficiente para o cartão mostrar um "papel" com a cara do documento. O arquivo **não** é
/// carregado no app: só o começo do texto sai daqui, e o zip é lido do próprio arquivo (sem
/// trazer os bytes para a memória do lado TS).
#[derive(serde::Serialize)]
pub struct Previa {
    /// o formato reconhecido: "md", "docx", "pptx", "xlsx" ou "outro"
    pub tipo: String,
    /// as primeiras linhas do documento (vazio quando não dá para ler)
    pub texto: String,
}

/// Tira o texto de um XML do OOXML: o conteúdo fica em `<w:t>`/`<a:t>`/`<t>`, e o fim de cada
/// trecho/parágrafo vira um espaço — sem isso as palavras de parágrafos vizinhos grudariam.
fn texto_de_xml(bruto: &str) -> String {
    let mut out = String::new();
    let mut tag = String::new();
    let mut dentro = false;
    for c in bruto.chars() {
        match c {
            '<' => {
                dentro = true;
                tag.clear();
            }
            '>' => {
                dentro = false;
                if tag.starts_with('/') {
                    let nome = tag.trim_start_matches('/');
                    if nome == "w:p" || nome == "a:p" {
                        out.push('\n'); // fim de parágrafo: o cartão usa a quebra
                    } else if nome == "w:t" || nome == "a:t" || nome == "t" {
                        out.push(' '); // fim de trecho: as palavras não podem grudar
                    }
                }
            }
            _ if dentro => tag.push(c),
            _ => out.push(c),
        }
    }
    out
}

/// Arruma as linhas (o XML vem indentado) e corta no tamanho da prévia: os espaços viram um só,
/// as linhas em branco somem e o corte respeita o limite de caracteres.
fn limpar_previa(bruto: &str) -> String {
    let mut linhas: Vec<String> = Vec::new();
    let mut total = 0usize;
    for linha in bruto.lines() {
        let mut out = String::new();
        let mut espaco = false;
        for c in linha.chars() {
            if c.is_whitespace() {
                espaco = !out.is_empty();
                continue;
            }
            if espaco {
                out.push(' ');
                espaco = false;
            }
            out.push(c);
        }
        let limpa = out.trim().to_string();
        if limpa.is_empty() {
            continue; // linha em branco: a prévia é apertada
        }
        total += limpa.chars().count() + 1;
        linhas.push(limpa);
        if total >= PREVIA_CHARS {
            break;
        }
    }
    linhas.join("\n").chars().take(PREVIA_CHARS).collect()
}

/// O XML cru de uma entrada do pacote (zip) — `None` quando o arquivo ou a entrada não abre.
fn ler_pacote(p: &Path, entrada: &str) -> Option<String> {
    use std::io::Read;
    let arquivo = fs::File::open(p).ok()?;
    let mut zip = zip::ZipArchive::new(arquivo).ok()?;
    let mut item = zip.by_name(entrada).ok()?;
    let mut bruto = String::new();
    item.read_to_string(&mut bruto).ok()?;
    Some(bruto)
}

/// O texto principal de um pacote OOXML (o conteúdo mora num XML dentro do zip).
fn texto_do_pacote(p: &Path, entrada: &str) -> String {
    texto_de_xml(&ler_pacote(p, entrada).unwrap_or_default())
}

/// Quantas linhas e colunas a grade da prévia mostra (o cartão é pequeno).
const GRADE_LINHAS: usize = 6;
const GRADE_COLUNAS: usize = 5;

/// Os textos de `xl/sharedStrings.xml`, na ordem: as células de texto apontam para eles por índice.
fn textos_compartilhados(p: &Path) -> Vec<String> {
    let bruto = ler_pacote(p, "xl/sharedStrings.xml").unwrap_or_default();
    let mut out = Vec::new();
    for pedaco in bruto.split("<si>").skip(1) {
        let dentro = pedaco.split("</si>").next().unwrap_or("");
        out.push(texto_de_xml(&format!("<x>{dentro}</x>")).trim().to_string());
    }
    out
}

/// A posição de uma célula pelo `r` do XML ("B3" → linha 3, coluna 2).
fn ref_da_celula(tag: &str) -> Option<(usize, usize)> {
    let i = tag.find("r=\"")? + 3;
    let referencia = &tag[i..i + tag[i..].find('"')?];
    let letras: String = referencia.chars().take_while(|c| c.is_ascii_alphabetic()).collect();
    let numeros: String = referencia.chars().skip_while(|c| c.is_ascii_alphabetic()).collect();
    let mut coluna = 0usize;
    for c in letras.chars() {
        coluna = coluna * 26 + (c.to_ascii_uppercase() as usize - 'A' as usize + 1);
    }
    Some((numeros.parse().ok()?, coluna))
}

/// O valor de uma célula: `t="s"` aponta para a lista de textos compartilhados; o texto em linha
/// (`inlineStr`) mora na própria célula; o resto é o valor cru (números, datas, fórmulas).
fn valor_da_celula(corpo: &str, strings: &[String]) -> String {
    if corpo.contains("t=\"s\"") {
        let indice = corpo
            .split("<v>")
            .nth(1)
            .and_then(|v| v.split("</v>").next())
            .and_then(|v| v.trim().parse::<usize>().ok());
        return indice.and_then(|i| strings.get(i).cloned()).unwrap_or_default();
    }
    if corpo.contains("<is>") {
        let dentro = corpo.split("<is>").nth(1).unwrap_or("").split("</is>").next().unwrap_or("");
        return texto_de_xml(&format!("<x>{dentro}</x>")).trim().to_string();
    }
    corpo.split("<v>").nth(1).and_then(|v| v.split("</v>").next()).unwrap_or("").trim().to_string()
}

/// A prévia da planilha: as primeiras linhas com as células separadas por TAB (a grade do cartão).
/// A posição sai do próprio XML (`r="A1"`), então as colunas ficam nas casas certas.
fn valores_da_planilha(p: &Path) -> String {
    let strings = textos_compartilhados(p);
    let bruto = ler_pacote(p, "xl/worksheets/sheet1.xml").unwrap_or_default();
    let mut linhas: Vec<Vec<String>> = Vec::new();
    for celula in bruto.split("<c ").skip(1) {
        let corpo = celula.split("</c>").next().unwrap_or("");
        let Some((linha, coluna)) = ref_da_celula(corpo) else {
            continue;
        };
        if linha == 0 || coluna == 0 || linha > GRADE_LINHAS || coluna > GRADE_COLUNAS {
            continue;
        }
        while linhas.len() < linha {
            linhas.push(Vec::new());
        }
        let alvo = &mut linhas[linha - 1];
        let valor = valor_da_celula(corpo, &strings);
        if alvo.len() < coluna {
            alvo.resize(coluna, String::new());
        }
        alvo[coluna - 1] = valor;
    }
    linhas.iter().map(|l| l.join("\t")).collect::<Vec<_>>().join("\n")
}

/// Limpa um pedaço de célula: os espaços viram um só.
fn limpar_celula(bruto: &str) -> String {
    let mut out = String::new();
    let mut espaco = false;
    for c in bruto.chars() {
        if c.is_whitespace() {
            espaco = !out.is_empty();
            continue;
        }
        if espaco {
            out.push(' ');
            espaco = false;
        }
        out.push(c);
    }
    out
}

/// Como o `limpar_previa`, mas preservando o TAB entre as células (a grade do cartão).
fn limpar_grade(bruto: &str) -> String {
    let mut linhas: Vec<String> = Vec::new();
    let mut total = 0usize;
    for linha in bruto.lines() {
        let celulas: Vec<String> = linha.split('\t').map(limpar_celula).collect();
        if celulas.iter().all(|c| c.is_empty()) {
            continue; // linha sem valor: a prévia é apertada
        }
        let limpa = celulas.join("\t");
        total += limpa.chars().count() + 1;
        linhas.push(limpa);
        if total >= PREVIA_CHARS {
            break;
        }
    }
    linhas.join("\n")
}

/// Prévia de um documento para a tela Início (o cartão mostra um papel com o começo do texto).
#[tauri::command(async)]
pub fn preview_file(path: String) -> Result<Previa, String> {
    let p = Path::new(&path);
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let tipo = match ext.as_str() {
        "md" | "markdown" | "txt" => "md",
        "docx" => "docx",
        "pptx" => "pptx",
        "xlsx" => "xlsx",
        _ => "outro",
    };
    let (texto, grade) = match tipo {
        "md" => {
            use std::io::Read;
            let Ok(arquivo) = fs::File::open(p) else {
                return Ok(Previa { tipo: tipo.into(), texto: String::new() });
            };
            let mut bytes = Vec::new();
            let _ = arquivo.take((PREVIA_CHARS * 4) as u64).read_to_end(&mut bytes);
            (String::from_utf8_lossy(&bytes).into_owned(), false)
        }
        "docx" => (texto_do_pacote(p, "word/document.xml"), false),
        "pptx" => (texto_do_pacote(p, "ppt/slides/slide1.xml"), false),
        // a planilha vem em LINHAS de células separadas por TAB: o cartão desenha a grade com as
        // posições do XML (o `sharedStrings` sozinho só dava a lista de textos, sem linha/coluna)
        "xlsx" => (valores_da_planilha(p), true),
        _ => (String::new(), false),
    };
    let texto = if grade { limpar_grade(&texto) } else { limpar_previa(&texto) };
    Ok(Previa { tipo: tipo.into(), texto })
}
