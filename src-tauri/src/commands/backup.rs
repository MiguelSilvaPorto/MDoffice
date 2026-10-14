//! Backup em disco dos documentos.
//!
//! Cada arquivo seu vira uma pasta dentro da raiz de backup, com o caminho original
//! espelhado (`C:\Docs\Projeto\notas.md` → `C_/Docs/Projeto/notas.md/`). Dentro dela
//! ficam as cópias datadas (`2026-10-09_10-42-13.md`), a cópia do estado anterior
//! (`.orig`) e o histórico de alterações exportado pelo app (`.historico/`).
//!
//! A gravação acontece sempre em paralelo nas duas raízes (a escolhida pelo usuário e a
//! da pasta de dados do app): se uma falhar, a outra ainda salva. Não há limite de
//! tamanho — a limpeza é só por política (quantidade de cópias e prazo).
//!
//! O `backup_index` devolve as métricas (quantidade, bytes, datas) que o monitor de
//! espaço vai ler depois; nada aqui apaga nada sozinho além da rotação combinada.
//!
//! Os comandos são `#[tauri::command(async)]`: ler e copiar o documento (que pode
//! estar numa pasta de rede) sai da thread principal — senão cada cópia trava a
//! interface. E o documento é lido **uma única vez** por gravação: os mesmos bytes
//! servem à comparação com a última cópia e à gravação em todas as raízes.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::util::{io_err, now_ms, write_atomic};

// nomes reservados dentro da pasta de backup
const ORIGEM: &str = ".origem.txt";
const HIST_DIR: &str = ".historico";
const INDEX_NAME: &str = "_indice.json";
const CFG_NAME: &str = "backup.json";

/// quantos `.orig` mais recentes a rotação nunca apaga
const KEEP_ORIG: usize = 3;
/// teto de segurança ao varrer a árvore de backup (evita laço em link quebrado)
const MAX_DEPTH: usize = 14;
/// teto de segurança para o tamanho de um segmento de nome de pasta
const MAX_SEG: usize = 90;

// ---------- configuração (guardada em JSON na pasta de dados do app) ----------

/// Política de backup. `max_copies`/`max_days` = 0 significam "sem limite".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BackupConfig {
    pub enabled: bool,
    /// guarda a cópia do estado anterior a cada novo backup datado
    pub protect: bool,
    /// pasta escolhida pelo usuário (None = só a pasta do app)
    pub user_root: Option<String>,
    pub max_copies: u32,
    pub max_days: u32,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            protect: true,
            user_root: None,
            max_copies: 50,
            max_days: 30,
        }
    }
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    app.path().app_local_data_dir().map_err(|e| e.to_string())
}

fn cfg_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join(CFG_NAME))
}

pub fn load_config(app: &tauri::AppHandle) -> BackupConfig {
    let Ok(p) = cfg_path(app) else {
        return BackupConfig::default();
    };
    std::fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn store_config(app: &tauri::AppHandle, cfg: &BackupConfig) -> Result<(), String> {
    let p = cfg_path(app)?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(io_err)?;
    }
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    write_atomic(&p, json.as_bytes())
}

/// Configuração atual do backup.
#[tauri::command(async)]
pub fn backup_config(app: tauri::AppHandle) -> Result<BackupConfig, String> {
    Ok(load_config(&app))
}

/// Grava a configuração (o app chama quando você muda um ajuste).
#[tauri::command(async)]
pub fn backup_save_config(app: tauri::AppHandle, config: BackupConfig) -> Result<(), String> {
    store_config(&app, &config)
}

/// Pasta de backup da própria aplicação (`…\AppData\Local\com.mdoffice.desktop\backups`).
#[tauri::command(async)]
pub fn backup_app_root(app: tauri::AppHandle) -> Result<String, String> {
    let dir = data_dir(&app)?.join("backups");
    fs::create_dir_all(&dir).map_err(io_err)?;
    Ok(dir.to_string_lossy().to_string())
}

/// Prepara (cria se preciso) a pasta que o usuário escolheu e devolve o caminho.
#[tauri::command(async)]
pub fn backup_prepare_root(path: String) -> Result<String, String> {
    let dir = PathBuf::from(&path);
    if dir.exists() && !dir.is_dir() {
        return Err("Esse caminho não é uma pasta.".to_string());
    }
    fs::create_dir_all(&dir).map_err(io_err)?;
    // testa se dá para escrever: uma pasta sem permissão não serviria de backup
    let probe = dir.join(".mdc-teste");
    fs::write(&probe, b"ok").map_err(|e| format!("Não foi possível gravar nessa pasta: {e}"))?;
    let _ = fs::remove_file(&probe);
    Ok(dir.to_string_lossy().to_string())
}

// ---------- caminhos ----------

/// Raízes ativas, na ordem de gravação (a do usuário primeiro).
pub fn active_roots(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let cfg = load_config(app);
    let mut roots = Vec::new();
    if let Some(r) = &cfg.user_root {
        if !r.trim().is_empty() {
            roots.push(PathBuf::from(r));
        }
    }
    if let Ok(dir) = data_dir(app) {
        roots.push(dir.join("backups"));
    }
    roots
}

/// Pastas de backup ativas (para mostrar na interface).
#[tauri::command(async)]
pub fn backup_roots(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    for r in active_roots(&app) {
        if fs::create_dir_all(&r).is_err() {
            continue;
        }
        out.push(r.to_string_lossy().to_string());
    }
    Ok(out)
}

/// Nome de pasta seguro: sem `:`, `\`, `*`, `?`, `<`, `>`, `|`, `"` nem pontuação final.
fn sanitize(seg: &str) -> String {
    let mut out: String = seg
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if (c as u32) < 0x20 => '_',
            c => c,
        })
        .collect();
    out = out.trim().trim_end_matches(['.', ' ']).to_string();
    if out.is_empty() {
        out.push('_');
    }
    if out.chars().count() > MAX_SEG {
        // nome gigante (pasta de usuário enorme): corta mantendo o começo e a diferença
        let head: String = out.chars().take(MAX_SEG - 9).collect();
        let tail = short_hash(seg);
        out = format!("{head}~{tail}");
    }
    out
}

/// Hash simples e estável do texto (FNV-1a de 32 bits) — só para differentiate nomes.
fn short_hash(s: &str) -> String {
    let mut h: u32 = 0x811c_9dc5;
    for b in s.as_bytes() {
        h ^= *b as u32;
        h = h.wrapping_mul(0x0100_0193);
    }
    format!("{h:08x}")
}

/// Pasta da raiz que espelha o caminho do arquivo original.
fn mirror_dir(root: &Path, original: &str) -> PathBuf {
    let mut out = root.to_path_buf();
    for c in Path::new(original).components() {
        match c {
            Component::Prefix(p) => out.push(sanitize(&p.as_os_str().to_string_lossy())),
            Component::Normal(s) => out.push(sanitize(&s.to_string_lossy())),
            // RootDir (a barra depois de C:) e "."/".." não viram pastas
            _ => {}
        }
    }
    out
}

/// Extensão do arquivo original (`md`, `docx`…). Sem extensão, `dat`.
fn ext_of(original: &str) -> String {
    Path::new(original)
        .extension()
        .map(|e| sanitize(&e.to_string_lossy()).to_lowercase())
        .filter(|e| !e.is_empty() && e.len() <= 12)
        .unwrap_or_else(|| "dat".to_string())
}

/// Data/hora local no formato do nome de arquivo (`2026-10-09_10-42-13`).
///
/// Converte o tempo Unix para o fuso do Windows usando a API do próprio sistema, sem
/// trazer uma biblioteca de calendário para dentro do app. Se a API falhar, cai para
/// UTC (o nome continua único e ordenado).
fn timestamp() -> String {
    #[cfg(windows)]
    {
        use std::ffi::c_void;
        #[repr(C)]
        struct SystemTimeAsFileTime {
            low: u32,
            high: u32,
        }
        extern "system" {
            fn FileTimeToLocalFileTime(
                ft: *const SystemTimeAsFileTime,
                local: *mut SystemTimeAsFileTime,
            ) -> i32;
            fn FileTimeToSystemTime(
                ft: *const SystemTimeAsFileTime,
                st: *mut c_void,
            ) -> i32;
        }
        #[repr(C)]
        #[derive(Default, Copy, Clone)]
        struct SYSTEMTIME {
            year: u16,
            month: u16,
            day: u16,
            dow: u16,
            hour: u16,
            minute: u16,
            second: u16,
            ms: u16,
        }
        let secs = now_ms() / 1000;
        // tempo Unix (100 ns desde 1601) = secs + 11644473600
        let t = secs + 11_644_473_600;
        let input = SystemTimeAsFileTime {
            low: t as u32,
            high: (t >> 32) as u32,
        };
        let mut local = SystemTimeAsFileTime { low: 0, high: 0 };
        // SAFETY: ponteiros para structs válidas, do tamanho que a API espera.
        let ok = unsafe { FileTimeToLocalFileTime(&input, &mut local) } != 0;
        if ok {
            let mut st = SYSTEMTIME::default();
            if unsafe { FileTimeToSystemTime(&local, &mut st as *mut _ as *mut c_void) } != 0 {
                return format!(
                    "{:04}-{:02}-{:02}_{:02}-{:02}-{:02}",
                    st.year, st.month, st.day, st.hour, st.minute, st.second
                );
            }
        }
    }
    // fallback: UTC
    stamp_from_secs(now_ms() / 1000)
}

/// Mesma formatação, a partir de segundos Unix interpreted como UTC.
fn stamp_from_secs(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (h, mi, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // dias desde 1970 → data (ciclo de 400 anos, válido para todas as datas do app)
    let mut year = 1970i64;
    let mut d = days;
    loop {
        let len = if leap(year) { 366 } else { 365 };
        if d < len {
            break;
        }
        d -= len;
        year += 1;
    }
    let meses = [31, if leap(year) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 0usize;
    while month < 12 && d >= meses[month] {
        d -= meses[month];
        month += 1;
    }
    format!(
        "{:04}-{:02}-{:02}_{:02}-{:02}-{:02}",
        year,
        month + 1,
        d + 1,
        h,
        mi,
        s
    )
}

fn leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/// Data/hora local no formato do nome de arquivo (`2026-10-09_10-42-13`).
/// O app manda esse texto pronto (o navegador conhece o horário do usuário).
fn sanitize_stamp(stamp: &str) -> String {
    let keep: String = stamp
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();
    let clean = keep.trim_matches('-').to_string();
    if clean.len() < 8 {
        return format!("manual-{}", now_ms() / 1000);
    }
    clean
}

// ---------- listagem ----------

/// Uma cópia datada dentro de uma pasta de backup.
#[derive(Debug, Clone, Serialize)]
pub struct BackupFile {
    /// raiz onde esta cópia está (para restaurar de onde veio)
    pub root: String,
    pub name: String,
    /// data/hora no formato `2026-10-09_10-42-13`
    pub stamp: String,
    pub bytes: u64,
    pub at: u64,
    /// cópia do estado anterior (proteção contra sobrescrita)
    pub protection: bool,
}

/// Todas as cópias de um documento (união das duas raízes), da mais nova para a mais antiga.
#[derive(Debug, Clone, Serialize)]
pub struct BackupEntry {
    pub original: String,
    pub copies: Vec<BackupFile>,
    pub bytes: u64,
    /// o original não está mais no disco
    pub missing: bool,
}

/// Separa o nome do arquivo de backup em (data/hora, é-proteção, extensão).
fn parse_name(name: &str) -> Option<(String, bool, String)> {
    if name.starts_with('.') {
        return None;
    }
    let p = Path::new(name);
    let ext = p.extension()?.to_string_lossy().to_string();
    let stem = p.file_stem()?.to_string_lossy().to_string();
    let (stamp, prot) = match stem.strip_suffix(".orig") {
        Some(s) => (s.to_string(), true),
        None => (stem.clone(), false),
    };
    if stamp.len() < 8 {
        return None;
    }
    Some((stamp, prot, ext))
}

fn list_dir(dir: &Path, root: &Path) -> Vec<BackupFile> {
    let mut out: Vec<BackupFile> = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return out;
    };
    for e in entries.flatten() {
        if !e.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let name = e.file_name().to_string_lossy().to_string();
        let Some((stamp, prot, _ext)) = parse_name(&name) else {
            continue;
        };
        let md = e.metadata().ok();
        out.push(BackupFile {
            root: root.to_string_lossy().to_string(),
            name,
            stamp,
            bytes: md.as_ref().map(|m| m.len()).unwrap_or(0),
            at: md
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            protection: prot,
        });
    }
    out.sort_by(|a, b| b.at.cmp(&a.at).then(a.name.cmp(&b.name)));
    out
}

fn entry_of(root: &Path, original: &str) -> BackupEntry {
    let dir = mirror_dir(root, original);
    let copies = list_dir(&dir, root);
    let bytes = copies.iter().map(|c| c.bytes).sum();
    BackupEntry {
        original: original.to_string(),
        copies,
        bytes,
        missing: !Path::new(original).exists(),
    }
}

fn merge_entries(roots: &[PathBuf], original: &str) -> BackupEntry {
    let mut copies: Vec<BackupFile> = Vec::new();
    let mut bytes = 0;
    for r in roots {
        let e = entry_of(r, original);
        bytes += e.bytes;
        copies.extend(e.copies);
    }
    copies.sort_by(|a, b| b.at.cmp(&a.at).then(a.root.cmp(&b.root)));
    BackupEntry {
        original: original.to_string(),
        copies,
        bytes,
        missing: !Path::new(original).exists(),
    }
}

/// Cópias de um documento (é o que a aba "Backup em disco" da tela de Histórico mostra).
#[tauri::command(async)]
pub fn backup_list(app: tauri::AppHandle, path: String) -> Result<BackupEntry, String> {
    Ok(merge_entries(&active_roots(&app), &path))
}

/// Resultado de gravar um backup.
#[derive(Debug, Clone, Serialize, Default)]
pub struct BackupWriteResult {
    /// pastas onde a cópia foi gravada
    pub written: Vec<String>,
    /// resumos dos erros (a pasta do usuário pode estar desconectada)
    pub failed: Vec<String>,
    /// nada novo: o conteúdo era igual ao último backup
    pub skipped: bool,
}

/// Grava uma cópia datada do arquivo nas duas raízes.
///
/// `stamp` é a data/hora local já formatada pelo app (`2026-10-09_10-42-13`).
#[tauri::command(async)]
pub fn backup_write(app: tauri::AppHandle, path: String, stamp: String) -> Result<BackupWriteResult, String> {
    let cfg = load_config(&app);
    if !cfg.enabled {
        return Ok(BackupWriteResult::default());
    }
    Ok(gravar_copia(
        &active_roots(&app),
        &path,
        &sanitize_stamp(&stamp),
        cfg.protect,
    ))
}

/// O miolo da gravação, sem depender do app (é o que os testes exercitam).
///
/// Lê o documento **uma única vez** e reusa os bytes na comparação e em todas as
/// raízes: antes, `same_bytes` e `fs::copy` reliam o original por raiz — em pasta
/// de rede isso era uma ida ao disco a mais por raiz, em série, a cada cópia.
fn gravar_copia(roots: &[PathBuf], path: &str, stamp: &str, protect: bool) -> BackupWriteResult {
    gravar_copia_com(roots, path, stamp, protect, |p| fs::read(p))
}

/// O mesmo, com o leitor do original injetável (o teste conta as leituras).
fn gravar_copia_com<F>(
    roots: &[PathBuf],
    path: &str,
    stamp: &str,
    protect: bool,
    ler_original: F,
) -> BackupWriteResult
where
    F: Fn(&Path) -> std::io::Result<Vec<u8>>,
{
    let src = PathBuf::from(path);
    let mut out = BackupWriteResult::default();
    if !src.is_file() {
        return out;
    }
    let bytes = match ler_original(&src) {
        Ok(b) => b,
        Err(e) => {
            out.failed
                .push(format!("{path}: não foi possível ler o documento ({e})"));
            return out;
        }
    };
    let ext = ext_of(path);

    for root in roots {
        let dir = mirror_dir(root, path);
        if fs::create_dir_all(&dir).is_err() {
            out.failed.push(format!("{}: não foi possível criar a pasta", root.display()));
            continue;
        }
        // guarda o caminho original uma única vez (permite reconstruir o índice depois)
        let origem = dir.join(ORIGEM);
        if !origem.exists() {
            let _ = write_atomic(&origem, path.as_bytes());
        }

        let anterior = list_dir(&dir, root).into_iter().find(|c| !c.protection);

        // conteúdo igual ao último backup: não grava de novo
        if let Some(prev) = &anterior {
            if same_bytes_with(&bytes, &dir.join(&prev.name)) {
                out.skipped = true;
                out.written.push(root.to_string_lossy().to_string());
                continue;
            }
        }

        // cópia do estado anterior, antes de gravar a nova
        if protect {
            if let Some(prev) = &anterior {
                if let Ok(bytes) = fs::read(dir.join(&prev.name)) {
                    let _ = write_atomic(&dir.join(format!("{stamp}.orig.{ext}")), &bytes);
                }
            }
        }

        match write_copy_atomic(&dir.join(format!("{stamp}.{ext}")), &bytes) {
            Ok(()) => out.written.push(root.to_string_lossy().to_string()),
            Err(e) => out.failed.push(format!("{}: {e}", root.display())),
        }
    }
    out
}

/// Grava uma cópia datada de forma atômica (temporário + rename).
///
/// O temporário começa com `.` de propósito: se o processo morrer no meio, a
/// sobra é ignorada pelo índice (nomes com ponto inicial não são cópias).
fn write_copy_atomic(destino: &Path, bytes: &[u8]) -> Result<(), String> {
    let nome = destino
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "copia".to_string());
    let tmp = destino.with_file_name(format!(".{nome}.tmp"));
    fs::write(&tmp, bytes).map_err(io_err)?;
    fs::rename(&tmp, destino).map_err(io_err)
}

/// Hash do conteúdo que o app gravou por último em cada caminho.
///
/// Serve para a proteção antes de sobrescrever: se o que está no disco é exatamente o que
/// o app gravou da última vez, o próprio app é quem está escrevendo e não há o que
/// proteger. Quando o conteúdo do disco difere, alguém mexeu no arquivo por fora
/// (outro programa, sincronização do OneDrive) e a versão anterior é guardada antes de
/// escrever por cima.
type HashMapCache = std::sync::Mutex<std::collections::HashMap<String, u64>>;

static ULTIMO_ESCRITO: std::sync::OnceLock<HashMapCache> = std::sync::OnceLock::new();

fn hash_map() -> &'static HashMapCache {
    ULTIMO_ESCRITO.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

fn hash_bytes(bytes: &[u8]) -> u64 {
    // FNV-1a de 64 bits
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100_0000_01b3);
    }
    h
}

/// Guarda a versão anterior do arquivo antes de o app gravar por cima dele.
///
/// Devolve `true` quando houve de fato uma cópia de proteção (o disco tinha outro
/// conteúdo, ou o app ainda não conhecia o arquivo). Chame ANTES de `fs::write`.
pub fn protect_before_write(app: &tauri::AppHandle, path: &str, novo: &[u8]) -> bool {
    let alvo = PathBuf::from(path);
    let mapa = hash_map();
    let key = path.to_lowercase();

    let disk = match fs::read(&alvo) {
        Ok(b) => b,
        Err(_) => {
            // arquivo novo: só anota o que vamos gravar
            if let Ok(mut m) = mapa.lock() {
                m.insert(key, hash_bytes(novo));
            }
            return false;
        }
    };
    let hash_disco = hash_bytes(&disk);
    let anterior = mapa.lock().ok().and_then(|m| m.get(&key).copied());

    let precisa_proteger = decidir_protecao(anterior, hash_disco, hash_bytes(novo));

    if precisa_proteger {
        let _ = write_backup_of_bytes(app, path, &disk);
    }
    if let Ok(mut m) = mapa.lock() {
        m.insert(key, hash_bytes(novo));
    }
    precisa_proteger
}

/// Grava os bytes numa pasta de backup como cópia de proteção, com a data/hora atual.
fn write_backup_of_bytes(app: &tauri::AppHandle, path: &str, bytes: &[u8]) -> Result<(), String> {
    write_backup_of_bytes_named(app, path, bytes, "")
}

/// O mesmo, mas com um rótulo antes da data (`antes-de-restaurar-…`).
fn write_backup_of_bytes_named(
    app: &tauri::AppHandle,
    path: &str,
    bytes: &[u8],
    label: &str,
) -> Result<(), String> {
    let stamp = timestamp();
    let ext = ext_of(path);
    let prefix = if label.is_empty() {
        String::new()
    } else {
        format!("{}-", sanitize_stamp(label))
    };
    for root in active_roots(app) {
        let dir = mirror_dir(&root, path);
        if fs::create_dir_all(&dir).is_err() {
            continue;
        }
        let origem = dir.join(ORIGEM);
        if !origem.exists() {
            let _ = write_atomic(&origem, path.as_bytes());
        }
        let _ = write_atomic(&dir.join(format!("{prefix}{stamp}.orig.{ext}")), bytes);
    }
    Ok(())
}

/// Decide se a versão que está no disco precisa ser protegida antes de gravar.
///
/// - Se o app já sabia o que havia no disco (`anterior`), protege só quando o conteúdo
///   está DIFERENTE — alguém mexeu no arquivo por fora.
/// - Se não sabia (`None`), protege quando o disco não é igual ao que vai ser gravado.
fn decidir_protecao(anterior: Option<u64>, hash_disco: u64, hash_novo: u64) -> bool {
    match anterior {
        Some(h) => h != hash_disco,
        None => hash_disco != hash_novo,
    }
}

/// Anota o conteúdo que está no disco para um caminho que o app vai gravar.
///
/// O app chama isso ao abrir/ler um arquivo: assim a proteção antes de sobrescrever sabe
/// que o conteúdo atual é o esperado e não cria uma cópia de proteção à toa.
pub fn note_disk_content(path: &str, bytes: &[u8]) {
    let mapa = hash_map();
    if let Ok(mut m) = mapa.lock() {
        m.insert(path.to_lowercase(), hash_bytes(bytes));
    }
}

/// Esquece o que o app gravou num caminho (usado quando o arquivo é renomeado/apagado).
pub fn forget_write(path: &str) {
    let mapa = hash_map();
    if let Ok(mut m) = mapa.lock() {
        m.remove(&path.to_lowercase());
    }
}

/// O conteúdo lido (`a`) é igual ao que está no arquivo `b`?
fn same_bytes_with(a: &[u8], b: &Path) -> bool {
    let Ok(mb) = fs::metadata(b) else {
        return false;
    };
    if mb.len() != a.len() as u64 {
        return false;
    }
    match fs::read(b) {
        Ok(y) => a == y.as_slice(),
        _ => false,
    }
}

/// Devolve o conteúdo de uma cópia para a pasta de backup de outro arquivo (usado para
/// montar o histórico exportado).
#[tauri::command(async)]
pub fn backup_save_history(path: String, root: String, json: String) -> Result<(), String> {
    let dir = mirror_dir(Path::new(&root), &path).join(HIST_DIR);
    write_atomic(&dir.join("historico.json"), json.as_bytes())
}

/// Lê o histórico exportado de um documento (null se ainda não houver).
#[tauri::command(async)]
pub fn backup_load_history(path: String, root: String) -> Result<Option<String>, String> {
    let p = mirror_dir(Path::new(&root), &path)
        .join(HIST_DIR)
        .join("historico.json");
    match fs::read_to_string(p) {
        Ok(s) => Ok(Some(s)),
        Err(_) => Ok(None),
    }
}

/// Apaga o histórico exportado de um documento.
#[tauri::command(async)]
pub fn backup_clear_history(path: String, root: String) -> Result<(), String> {
    let dir = mirror_dir(Path::new(&root), &path).join(HIST_DIR);
    if dir.is_dir() {
        fs::remove_dir_all(dir).map_err(io_err)?;
    }
    Ok(())
}

/// Copia uma das cópias de volta para o caminho original.
#[tauri::command(async)]
pub fn backup_restore(
    app: tauri::AppHandle,
    path: String,
    root: String,
    name: String,
) -> Result<String, String> {
    let src = mirror_dir(Path::new(&root), &path).join(&name);
    if !src.is_file() {
        return Err("Essa cópia de backup não foi encontrada.".to_string());
    }
    // guarda o que está no disco agora antes de sobrescrever (na pasta de backup,
    // para não largar arquivos esquisitos na pasta do usuário)
    let target = PathBuf::from(&path);
    if target.is_file() {
        if let Ok(bytes) = fs::read(&target) {
            let _ = write_backup_of_bytes_named(&app, &path, &bytes, "antes-de-restaurar");
        }
    }
    fs::copy(&src, &target).map_err(io_err)?;
    // o conteúdo do disco mudou: a proteção acima já foi feita, então o mapa passa a
    // considerar o arquivo restaurado como o último estado conhecido
    note_disk_content(&path, &fs::read(&target).unwrap_or_default());
    Ok(target.to_string_lossy().to_string())
}

/// Apaga uma cópia específica.
#[tauri::command(async)]
pub fn backup_delete(path: String, root: String, name: String) -> Result<(), String> {
    let p = mirror_dir(Path::new(&root), &path).join(&name);
    // só apaga o que está dentro da raiz de backup
    let canon_root = fs::canonicalize(&root).map_err(io_err)?;
    let canon = fs::canonicalize(&p).map_err(io_err)?;
    if !canon.starts_with(&canon_root) {
        return Err("Esse arquivo não é uma cópia de backup.".to_string());
    }
    fs::remove_file(canon).map_err(io_err)
}

// ---------- limpeza ----------

/// Decide quais cópias saem, sem apagar nada (é o que os testes verificam).
///
/// Regras:
/// 1. mantém as `max_copies` mais recentes de cada documento (`0` = sem limite);
/// 2. apaga as que passaram de `max_days` (`0` = não apaga por tempo), mas nunca as
///    mais recentes que a quantidade combinada;
/// 3. as cópias de proteção (`.orig`) mais recentes (`KEEP_ORIG`) nunca saem.
fn escolher_apagadas(arquivos: &[BackupFile], max_copies: u32, max_days: u32, agora: u64) -> Vec<String> {
    let limite = if max_days > 0 {
        Some(agora.saturating_sub(max_days as u64 * 24 * 60 * 60 * 1000))
    } else {
        None
    };
    let mut normais: Vec<&BackupFile> = arquivos.iter().filter(|c| !c.protection).collect();
    let mut protecoes: Vec<&BackupFile> = arquivos.iter().filter(|c| c.protection).collect();
    // da mais nova para a mais antiga (a lista pode chegar em qualquer ordem)
    normais.sort_by(|a, b| b.at.cmp(&a.at));
    protecoes.sort_by(|a, b| b.at.cmp(&a.at));
    let mut fora: Vec<String> = Vec::new();
    let marcar = |c: &BackupFile, fora: &mut Vec<String>| {
        if !fora.iter().any(|n| n == &c.name) {
            fora.push(c.name.clone());
        }
    };

    // 1. prazo: sai o que passou do limite, mas a cópia MAIS RECENTE fica sempre
    //    (nunca se perde o último backup, mesmo que o documento esteja parado)
    if let Some(limite) = limite {
        for c in normais.iter().skip(1) {
            if c.at > 0 && c.at < limite {
                marcar(c, &mut fora);
            }
        }
    }
    // 2. quantidade: saem as que passam das `max_copies` mais recentes
    if max_copies > 0 && normais.len() > max_copies as usize {
        for c in normais.iter().skip(max_copies as usize) {
            marcar(c, &mut fora);
        }
    }
    // 3. proteções: as KEEP_ORIG mais recentes ficam sempre; as outras saem com o prazo
    if let Some(limite) = limite {
        for c in protecoes.iter().skip(KEEP_ORIG) {
            if c.at > 0 && c.at < limite {
                marcar(c, &mut fora);
            }
        }
    }
    fora
}

/// Apaga cópias antigas conforme a política. Devolve quantas foram apagadas.
#[tauri::command(async)]
pub fn backup_prune(app: tauri::AppHandle, max_copies: u32, max_days: u32) -> Result<u32, String> {
    let roots = active_roots(&app);
    let agora = now_ms();
    let mut apagadas = 0u32;

    for root in &roots {
        let mut pastas: Vec<PathBuf> = Vec::new();
        walk_dirs(root, 0, &mut pastas);
        for dir in pastas {
            if !dir.join(ORIGEM).is_file() {
                continue;
            }
            let arquivos = list_dir(&dir, root);
            for name in escolher_apagadas(&arquivos, max_copies, max_days, agora) {
                let p = dir.join(&name);
                if let Ok(canon) = fs::canonicalize(&p) {
                    let base = dir.canonicalize().unwrap_or_else(|_| dir.clone());
                    if canon.starts_with(&base) && fs::remove_file(&canon).is_ok() {
                        apagadas += 1;
                    }
                }
            }
        }
    }
    Ok(apagadas)
}

/// Remove todas as pastas de backup do documento (usado pelo "apagar" do documento).
#[tauri::command(async)]
pub fn backup_forget(app: tauri::AppHandle, path: String) -> Result<u32, String> {
    let mut n = 0;
    for root in active_roots(&app) {
        let dir = mirror_dir(&root, &path);
        if dir.is_dir() && fs::remove_dir_all(&dir).is_ok() {
            n += 1;
        }
    }
    Ok(n)
}

// ---------- índice (métricas para o monitor de espaço) ----------

/// Resumo de um documento no índice.
#[derive(Debug, Clone, Serialize)]
pub struct IndexFile {
    pub original: String,
    pub copies: u32,
    pub bytes: u64,
    /// cópia mais antiga (epoch ms) — 0 se não houver
    pub oldest: u64,
    pub newest: u64,
    /// idade em dias da cópia mais antiga
    pub days: u32,
}

/// Índice completo das pastas de backup.
#[derive(Debug, Clone, Serialize)]
pub struct BackupIndex {
    pub roots: Vec<String>,
    pub files: Vec<IndexFile>,
    pub copies: u64,
    pub bytes: u64,
}

/// Monta o índice a partir das raízes (o miolo do comando, testável sem o app).
fn montar_indice(roots: &[PathBuf], agora: u64) -> BackupIndex {
    let mut files: Vec<IndexFile> = Vec::new();
    let mut copies_total = 0u64;
    let mut bytes_total = 0u64;

    for root in roots {
        let mut pastas: Vec<PathBuf> = Vec::new();
        walk_dirs(root, 0, &mut pastas);
        for dir in pastas {
            let origem = match fs::read_to_string(dir.join(ORIGEM)) {
                Ok(s) if !s.trim().is_empty() => s,
                _ => continue,
            };
            let arquivos = list_dir(&dir, root);
            if arquivos.is_empty() {
                continue;
            }
            let bytes: u64 = arquivos.iter().map(|c| c.bytes).sum();
            let oldest = arquivos.iter().map(|c| c.at).min().unwrap_or(0);
            let newest = arquivos.iter().map(|c| c.at).max().unwrap_or(0);
            copies_total += arquivos.len() as u64;
            bytes_total += bytes;
            files.push(IndexFile {
                original: origem,
                copies: arquivos.len() as u32,
                bytes,
                oldest,
                newest,
                days: if oldest > 0 && agora > oldest {
                    ((agora - oldest) / (24 * 60 * 60 * 1000)) as u32
                } else {
                    0
                },
            });
        }
    }
    files.sort_by(|a, b| b.bytes.cmp(&a.bytes));
    BackupIndex {
        roots: roots.iter().map(|r| r.to_string_lossy().to_string()).collect(),
        files,
        copies: copies_total,
        bytes: bytes_total,
    }
}

/// Varre as raízes e devolve (e grava em `_indice.json`) as métricas de espaço.
#[tauri::command(async)]
pub fn backup_index(app: tauri::AppHandle) -> Result<BackupIndex, String> {
    let roots = active_roots(&app);
    let idx = montar_indice(&roots, now_ms());

    // deixa o arquivo em disco para o monitor ler direto, mesmo com o app fechado
    for root in &roots {
        if let Ok(json) = serde_json::to_string_pretty(&idx) {
            let _ = write_atomic(&root.join(INDEX_NAME), json.as_bytes());
        }
    }
    Ok(idx)
}

/// Documentos com backup cujo original sumiu do disco.
#[tauri::command(async)]
pub fn backup_missing(app: tauri::AppHandle) -> Result<Vec<BackupEntry>, String> {
    let roots = active_roots(&app);
    // arquivo que está na lixeira não "sumiu" — foi movido de propósito
    let na_lixeira = super::trash::trashed_paths(&app);
    let mut originais: Vec<String> = Vec::new();
    for root in &roots {
        let mut pastas: Vec<PathBuf> = Vec::new();
        walk_dirs(root, 0, &mut pastas);
        for dir in pastas {
            if let Ok(s) = fs::read_to_string(dir.join(ORIGEM)) {
                let s = s.trim().to_string();
                if !s.is_empty() && !originais.contains(&s) {
                    originais.push(s);
                }
            }
        }
    }
    Ok(originais
        .iter()
        .filter(|p| !Path::new(p).exists() && !na_lixeira.contains(&p.to_lowercase()))
        .map(|p| merge_entries(&roots, p))
        .collect())
}

/// Procura (para o monitor) documentos com cópias muito antigas.
#[tauri::command(async)]
pub fn backup_aged(app: tauri::AppHandle, min_days: u32) -> Result<Vec<IndexFile>, String> {
    let idx = backup_index(app)?;
    Ok(idx.files.into_iter().filter(|f| f.days >= min_days).collect())
}

/// Lista todas as pastas com backup (usado pela tela de backup).
fn walk_dirs(root: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > MAX_DEPTH {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for e in entries.flatten() {
        if !e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let nome = e.file_name().to_string_lossy().to_string();
        if nome == HIST_DIR {
            continue;
        }
        let path = e.path();
        out.push(path.clone());
        walk_dirs(&path, depth + 1, out);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::SystemTime;

    fn copia(name: &str, at: u64, protection: bool) -> BackupFile {
        BackupFile {
            root: "/r".into(),
            name: name.into(),
            stamp: name.trim_end_matches(".md").trim_end_matches(".orig").into(),
            bytes: 10,
            at,
            protection,
        }
    }

    const DIA: u64 = 24 * 60 * 60 * 1000;
    const AGORA: u64 = 1_800_000_000_000;

    #[test]
    fn limpeza_respeita_a_quantidade() {
        let arquivos: Vec<BackupFile> = (0..10)
            .map(|i| copia(&format!("c{i}.md"), AGORA - i as u64 * DIA, false))
            .collect();
        // mantém as 3 mais recentes (c0..c2), o resto sai
        let fora = escolher_apagadas(&arquivos, 3, 0, AGORA);
        assert_eq!(fora.len(), 7);
        assert!(fora.contains(&"c3.md".to_string()));
        assert!(fora.contains(&"c9.md".to_string()));
        assert!(!fora.contains(&"c0.md".to_string()));
        assert!(!fora.contains(&"c2.md".to_string()));
    }

    #[test]
    fn limpeza_sem_limite_nao_apaga_por_quantidade() {
        let arquivos: Vec<BackupFile> = (0..30)
            .map(|i| copia(&format!("c{i}.md"), AGORA - i as u64 * DIA, false))
            .collect();
        assert!(escolher_apagadas(&arquivos, 0, 0, AGORA).is_empty());
    }

    #[test]
    fn limpeza_por_prazo_conserva_as_recentes() {
        let arquivos = vec![
            copia("novo.md", AGORA - DIA, false),
            copia("meio.md", AGORA - 10 * DIA, false),
            copia("velho.md", AGORA - 40 * DIA, false),
            copia("antigo.md", AGORA - 90 * DIA, false),
        ];
        // 30 dias: sai o que passou do prazo; os 10 dias ficam
        let fora = escolher_apagadas(&arquivos, 0, 30, AGORA);
        assert_eq!(fora, vec!["velho.md".to_string(), "antigo.md".to_string()]);
    }

    #[test]
    fn limpeza_nunca_perde_a_ultima_copia() {
        // documento parado: a única cópia ficou velha, mas continua sendo a última
        let arquivos = vec![copia("unica.md", AGORA - 400 * DIA, false)];
        assert!(escolher_apagadas(&arquivos, 10, 30, AGORA).is_empty());
        let duas = vec![
            copia("velha.md", AGORA - 400 * DIA, false),
            copia("recente.md", AGORA - 200 * DIA, false),
        ];
        // só a mais recente fica; a velha sai
        assert_eq!(escolher_apagadas(&duas, 10, 30, AGORA), vec!["velha.md".to_string()]);
    }

    #[test]
    fn limpeza_nunca_apaga_as_protecoes_recentes() {
        let arquivos = vec![
            copia("a.md", AGORA - 100 * DIA, false),
            copia("a.orig.md", AGORA - 100 * DIA, true),
            copia("b.orig.md", AGORA - 200 * DIA, true),
            copia("c.orig.md", AGORA - 300 * DIA, true),
            copia("d.orig.md", AGORA - 400 * DIA, true),
        ];
        // mesmo com prazo curto, as 3 proteções mais recentes ficam (e a última cópia também)
        let fora = escolher_apagadas(&arquivos, 0, 7, AGORA);
        assert!(!fora.contains(&"a.md".to_string()));
        assert!(!fora.contains(&"a.orig.md".to_string()));
        assert!(!fora.contains(&"b.orig.md".to_string()));
        assert!(!fora.contains(&"c.orig.md".to_string()));
        assert!(fora.contains(&"d.orig.md".to_string())); // a 4ª mais recente já pode sair
    }

    #[test]
    fn limpeza_sem_prazo_nao_apaga_protecao() {
        let arquivos = vec![
            copia("a.orig.md", AGORA - 500 * DIA, true),
            copia("b.orig.md", AGORA - 600 * DIA, true),
            copia("c.orig.md", AGORA - 700 * DIA, true),
            copia("d.orig.md", AGORA - 800 * DIA, true),
        ];
        // com max_days = 0 não há corte por tempo: só o item 3 poderia apagar, e ele
        // depende do prazo — então nada sai
        assert!(escolher_apagadas(&arquivos, 10, 0, AGORA).is_empty());
    }

    fn raiz(nome: &str) -> PathBuf {
        let n = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = std::env::temp_dir().join(format!("mdoffice-backup-{nome}-{n}"));
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn limpo(p: &Path) {
        let _ = fs::remove_dir_all(p);
    }

    #[test]
    fn nome_de_pasta_valido_no_windows() {
        // "C:" não pode virar nome de pasta: os dois pontos viram "_"
        assert_eq!(sanitize("C:"), "C_");
        assert_eq!(sanitize("meus documentos"), "meus documentos");
        assert_eq!(sanitize("a*b?c"), "a_b_c");
        assert_eq!(sanitize("  "), "_");
        assert_eq!(sanitize("nota."), "nota");
    }

    #[test]
    fn espelha_o_caminho_inteiro() {
        let dir = mirror_dir(
            Path::new("/raiz"),
            r"C:\Users\miguel\Documentos\Projeto\notas.md",
        );
        let relativo = dir
            .strip_prefix("/raiz")
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        assert_eq!(relativo, "C_/Users/miguel/Documentos/Projeto/notas.md");
    }

    #[test]
    fn separa_data_e_protecao_do_nome() {
        assert_eq!(
            parse_name("2026-10-09_10-42-13.md"),
            Some(("2026-10-09_10-42-13".into(), false, "md".into()))
        );
        assert_eq!(
            parse_name("2026-10-09_10-42-13.orig.docx"),
            Some(("2026-10-09_10-42-13".into(), true, "docx".into()))
        );
        // arquivos internos da pasta não são cópias
        assert_eq!(parse_name(".origem.txt"), None);
        assert_eq!(parse_name("qualquer"), None);
    }

    #[test]
    fn gravacao_espelha_e_marca_a_origem() {
        let root = raiz("write");
        let origem_dir = raiz("origem");
        let doc = origem_dir.join("notas.md");
        fs::write(&doc, "versao 1").unwrap();

        // simula o que o comando faz, sem precisar do AppHandle
        let dir = mirror_dir(&root, &doc.to_string_lossy());
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(ORIGEM), doc.to_string_lossy().as_bytes()).unwrap();
        fs::copy(&doc, dir.join("2026-10-09_10-00-00.md")).unwrap();

        assert!(dir.join(ORIGEM).is_file());
        assert_eq!(
            fs::read_to_string(dir.join("2026-10-09_10-00-00.md")).unwrap(),
            "versao 1"
        );
        assert_eq!(list_dir(&dir, &root).len(), 1);
        limpo(&root);
        limpo(&origem_dir);
    }

    #[test]
    fn versao_anterior_vira_orig() {
        let root = raiz("protect");
        let origem_dir = raiz("origem2");
        let doc = origem_dir.join("notas.md");
        fs::write(&doc, "versao 1").unwrap();

        let dir = mirror_dir(&root, &doc.to_string_lossy());
        fs::create_dir_all(&dir).unwrap();
        // primeira cópia
        fs::copy(&doc, dir.join("2026-10-09_10-00-00.md")).unwrap();
        // documentou, mudou e salvou de novo
        fs::write(&doc, "versao 2").unwrap();
        let anterior = list_dir(&dir, &root)
            .into_iter()
            .find(|c| !c.protection)
            .unwrap();
        fs::copy(&dir.join(&anterior.name), dir.join("2026-10-09_10-05-00.orig.md")).unwrap();
        fs::copy(&doc, dir.join("2026-10-09_10-05-00.md")).unwrap();

        let lista = list_dir(&dir, &root);
        assert_eq!(lista.len(), 3);
        assert_eq!(lista.iter().filter(|c| c.protection).count(), 1);
        // o .orig tem o conteúdo de antes
        let prot = lista.iter().find(|c| c.protection).unwrap();
        assert_eq!(
            fs::read_to_string(dir.join(&prot.name)).unwrap(),
            "versao 1"
        );
        limpo(&root);
        limpo(&origem_dir);
    }

    #[test]
    fn o_indice_reflete_o_que_esta_gravado() {
        let root = raiz("index");
        let origem_dir = raiz("origem3");
        let doc = origem_dir.join("relatorio.md");
        fs::write(&doc, "conteúdo").unwrap();

        let dir = mirror_dir(&root, &doc.to_string_lossy());
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(ORIGEM), doc.to_string_lossy().as_bytes()).unwrap();
        fs::copy(&doc, dir.join("2026-10-09_10-00-00.md")).unwrap();
        fs::copy(&doc, dir.join("2026-10-09_11-00-00.md")).unwrap();
        fs::copy(&doc, dir.join("2026-10-09_11-00-00.orig.md")).unwrap();

        // varredura do índice (mesma lógica do comando, sem o AppHandle)
        let mut pastas = Vec::new();
        walk_dirs(&root, 0, &mut pastas);
        let com_origem: Vec<_> = pastas.into_iter().filter(|d| d.join(ORIGEM).is_file()).collect();
        assert_eq!(com_origem.len(), 1);

        let arquivos = list_dir(&com_origem[0], &root);
        assert_eq!(arquivos.len(), 3);
        let bytes: u64 = arquivos.iter().map(|c| c.bytes).sum();
        assert_eq!(bytes, 3 * "conteúdo".len() as u64);
        // a mais recente vem primeiro
        assert_eq!(arquivos[0].at >= arquivos[1].at, true);

        limpo(&root);
        limpo(&origem_dir);
    }

    #[test]
    fn a_protecao_escolhe_o_nome_certo() {
        // carimbo vindo do frontend entra como está
        assert_eq!(sanitize_stamp("2026-10-09_10-42-13"), "2026-10-09_10-42-13");
        // rótulo de restauração usa hífens, sem virar lixo no nome
        assert_eq!(sanitize_stamp("antes-de-restaurar"), "antes-de-restaurar");
        // lixo não forma nome de arquivo válido: cai no carimbo de segurança
        let so = sanitize_stamp("///");
        assert!(so.starts_with("manual-"), "{so}");
    }

    #[test]
    fn extensoes_sao_preservadas() {
        assert_eq!(ext_of("/a/b/notas.md"), "md");
        assert_eq!(ext_of("/a/b/doc.DOCX"), "docx");
        assert_eq!(ext_of("/a/b/sem_extensao"), "dat");
    }

    #[test]
    fn protecao_age_quando_o_disco_muda_por_fora() {
        let nosso = 111u64;
        let outro = 222u64;
        // o app gravou "nosso" na última vez e o disco ainda tem "nosso": nada a proteger
        assert!(!decidir_protecao(Some(nosso), nosso, 999));
        // o disco tem "outro": alguém mexeu por fora -> protege
        assert!(decidir_protecao(Some(nosso), outro, 999));
        // o app não sabia o que havia: protege, a não ser que seja o mesmo conteúdo
        assert!(decidir_protecao(None, outro, nosso));
        assert!(!decidir_protecao(None, nosso, nosso));
    }

    #[test]
    fn o_hash_distingue_conteudos() {
        assert_eq!(hash_bytes(b"oi"), hash_bytes(b"oi"));
        assert_ne!(hash_bytes(b"oi"), hash_bytes(b"Oi"));
        assert_ne!(hash_bytes(b""), hash_bytes(b" "));
    }

    #[test]
    fn ciclo_completo_grava_lista_e_restaura() {
        let root_a = raiz("ciclo-a");
        let root_b = raiz("ciclo-b");
        let origem_dir = raiz("ciclo-doc");
        let doc = origem_dir.join("notas.md");
        let roots = vec![root_a.clone(), root_b.clone()];

        // 1. primeira gravação: as duas pastas recebem a cópia
        fs::write(&doc, "versao 1").unwrap();
        let r1 = gravar_copia(&roots, &doc.to_string_lossy(), "2026-10-09_10-00-00", true);
        assert_eq!(r1.written.len(), 2, "grava nas duas pastas");
        assert!(r1.failed.is_empty());
        assert!(!r1.skipped);

        // 2. sem mudança: não grava de novo
        let r2 = gravar_copia(&roots, &doc.to_string_lossy(), "2026-10-09_10-05-00", true);
        assert!(r2.skipped, "conteúdo igual não gera cópia nova");

        // 3. texto mudou: nova cópia + proteção com a versão anterior
        fs::write(&doc, "versao 2").unwrap();
        let r3 = gravar_copia(&roots, &doc.to_string_lossy(), "2026-10-09_10-10-00", true);
        assert!(!r3.skipped);
        let dir_a = mirror_dir(&root_a, &doc.to_string_lossy());
        let lista = list_dir(&dir_a, &root_a);
        assert_eq!(lista.len(), 3, "duas cópias + uma proteção");
        let prot = lista.iter().find(|c| c.protection).expect("tem proteção");
        assert_eq!(fs::read_to_string(dir_a.join(&prot.name)).unwrap(), "versao 1");

        // 4. listagem une as duas raízes
        let unida = merge_entries(&roots, &doc.to_string_lossy());
        assert_eq!(unida.copies.len(), 6, "3 em cada raiz");
        assert!(!unida.missing);

        // 5. restaurar a cópia mais antiga devolve o texto original
        let antiga = unida
            .copies
            .iter()
            .filter(|c| !c.protection)
            .min_by_key(|c| c.at)
            .expect("tem cópia normal");
        fs::copy(mirror_dir(Path::new(&antiga.root), &doc.to_string_lossy()).join(&antiga.name), &doc).unwrap();
        assert_eq!(fs::read_to_string(&doc).unwrap(), "versao 1");

        // 6. o documento "sumiu": o aviso olha a pasta, não o conteúdo
        fs::remove_file(&doc).unwrap();
        let depois = merge_entries(&roots, &doc.to_string_lossy());
        assert!(depois.missing, "o original não está mais no disco");

        limpo(&root_a);
        limpo(&root_b);
        limpo(&origem_dir);
    }

    #[test]
    fn uma_pasta_indisponivel_nao_impede_a_outra() {
        let root_bom = raiz("uma-boa");
        // caminho impossível: usa um arquivo como se fosse pasta
        let arquivo = raiz("uma-ruim").join("bloqueio");
        fs::write(&arquivo, b"nao sou pasta").unwrap();
        let origem_dir = raiz("uma-doc");
        let doc = origem_dir.join("doc.md");
        fs::write(&doc, "conteudo").unwrap();

        let r = gravar_copia(&[arquivo.clone(), root_bom.clone()], &doc.to_string_lossy(), "2026-10-09_11-00-00", true);
        assert_eq!(r.written.len(), 1, "a pasta boa recebeu");
        assert_eq!(r.failed.len(), 1, "a ruim foi reportada");
        assert!(list_dir(&mirror_dir(&root_bom, &doc.to_string_lossy()), &root_bom).len() == 1);

        limpo(&root_bom);
        limpo(&origem_dir);
    }

    #[test]
    fn a_copia_le_o_documento_uma_vez_so() {
        // Cada ida ao disco é caríssima em pasta de rede: a gravação da cópia precisa
        // ler o documento UMA vez por chamada, não uma por raiz (era o que o antigo
        // `same_bytes` + `fs::copy` faziam, em série).
        let root_a = raiz("leitura-a");
        let root_b = raiz("leitura-b");
        let origem_dir = raiz("leitura-doc");
        let doc = origem_dir.join("notas.md");
        fs::write(&doc, "versao 1").unwrap();
        let roots = vec![root_a.clone(), root_b.clone()];

        let leituras = std::cell::Cell::new(0u32);
        let r = gravar_copia_com(&roots, &doc.to_string_lossy(), "2026-10-09_10-00-00", true, |p| {
            leituras.set(leituras.get() + 1);
            fs::read(p)
        });
        assert_eq!(r.written.len(), 2, "os dois backups receberam a cópia");
        assert_eq!(leituras.get(), 1, "o documento foi lido uma única vez");

        // o mesmo vale quando o conteúdo não mudou (a cópia é pulada, mas a leitura
        // continua sendo a única forma segura de saber)
        let leituras2 = std::cell::Cell::new(0u32);
        let r2 = gravar_copia_com(&roots, &doc.to_string_lossy(), "2026-10-09_10-01-00", true, |p| {
            leituras2.set(leituras2.get() + 1);
            fs::read(p)
        });
        assert!(r2.skipped, "conteúdo igual ao último backup");
        assert_eq!(leituras2.get(), 1, "uma leitura também no caminho pulado");

        // com disco "lento" (leitura artificialmente cara), o custo aparece uma vez:
        let inicio = std::time::Instant::now();
        let _ = gravar_copia_com(&roots, &doc.to_string_lossy(), "2026-10-09_10-02-00", true, |p| {
            std::thread::sleep(std::time::Duration::from_millis(120));
            fs::read(p)
        });
        let decorrido = inicio.elapsed();
        assert!(
            decorrido < std::time::Duration::from_millis(300),
            "com duas raízes o atraso da leitura não pode somar por raiz (levou {decorrido:?})"
        );

        limpo(&root_a);
        limpo(&root_b);
        limpo(&origem_dir);
    }

    #[test]
    fn o_indice_soma_bytes_e_conta_copias() {
        let root = raiz("indice");
        let origem_dir = raiz("indice-doc");
        let doc_a = origem_dir.join("a.md");
        let doc_b = origem_dir.join("b.md");
        fs::write(&doc_a, "aaaa").unwrap();
        fs::write(&doc_b, "bb").unwrap();
        let roots = vec![root.clone()];

        gravar_copia(&roots, &doc_a.to_string_lossy(), "2026-10-09_10-00-00", false);
        // muda o texto para a segunda cópia não ser pulada
        fs::write(&doc_a, "aaaaa").unwrap();
        gravar_copia(&roots, &doc_a.to_string_lossy(), "2026-10-09_10-01-00", false);
        gravar_copia(&roots, &doc_b.to_string_lossy(), "2026-10-09_10-02-00", false);

        let idx = montar_indice(&roots, now_ms());
        assert_eq!(idx.copies, 3, "três cópias no total");
        assert_eq!(idx.files.len(), 2, "dois documentos");
        // o maior vem primeiro (a.md: 4 + 5 bytes)
        assert!(idx.files[0].original.ends_with("a.md"));
        assert_eq!(idx.files[0].bytes, 9);
        assert_eq!(idx.files[1].bytes, 2);
        assert_eq!(idx.bytes, 11);

        limpo(&root);
        limpo(&origem_dir);
    }

    #[test]
    fn o_indice_ignora_pastas_sem_copia() {
        let root = raiz("indice-vazio");
        // uma pasta qualquer dentro da raiz, sem .origem.txt
        fs::create_dir_all(root.join("qualquer").join("coisa")).unwrap();
        let idx = montar_indice(&[root.clone()], now_ms());
        assert!(idx.files.is_empty());
        assert_eq!(idx.copies, 0);
        limpo(&root);
    }
}