// Pontes com o backend Rust (comandos do Tauri) e diálogos nativos.
import { invoke } from "@tauri-apps/api/core";
import { open as dlgOpen, save as dlgSave } from "@tauri-apps/plugin-dialog";

export const MD_FILTER = { name: "Markdown", extensions: ["md", "markdown", "txt", "mdx"] };
export const IMG_FILTER = {
  name: "Imagens",
  extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"],
};
export const MEDIA_FILTER = {
  name: "Áudio e vídeo",
  extensions: ["mp4", "webm", "ogv", "mov", "m4v", "mp3", "wav", "m4a", "aac", "ogg", "oga", "flac"],
};

export const DOCX_FILTER = { name: "Documento do Word", extensions: ["docx"] };
export const PPTX_FILTER = { name: "Apresentação do PowerPoint", extensions: ["pptx"] };
export const XLSX_FILTER = { name: "Planilha do Excel", extensions: ["xlsx"] };

/** Formatos do Office que o app abre (modernos + os antigos, que só avisam). */
export const OFFICE_FILTER = {
  name: "Documentos do Office",
  extensions: ["docx", "xlsx", "xlsm", "pptx", "doc", "xls", "ppt"],
};

export async function pickOpenDoc(): Promise<string | null> {
  const p = await dlgOpen({
    multiple: false,
    directory: false,
    filters: [
      { name: "Todos os documentos", extensions: [...MD_FILTER.extensions, "docx", "pptx", "xlsx", "xlsm"] },
      MD_FILTER,
      DOCX_FILTER,
      PPTX_FILTER,
      XLSX_FILTER,
    ],
  });
  return typeof p === "string" ? p : null;
}

/**
 * Caixa "Importar do Office": abre direto nos documentos do Word, Excel e PowerPoint.
 *
 * Os formatos antigos (.doc, .xls, .ppt) aparecem na lista para você não se perder —
 * escolher um deles mostra a explicação de como salvar no formato novo.
 */
export async function pickImportOffice(): Promise<string | null> {
  const p = await dlgOpen({
    multiple: false,
    directory: false,
    filters: [
      OFFICE_FILTER,
      DOCX_FILTER,
      { name: "Planilha do Excel (inclui .xlsm)", extensions: ["xlsx", "xlsm", "xls"] },
      PPTX_FILTER,
    ],
  });
  return typeof p === "string" ? p : null;
}

export async function pickSaveDoc(defaultPath: string): Promise<string | null> {
  const p = await dlgSave({ defaultPath, filters: [MD_FILTER] });
  return typeof p === "string" ? p : null;
}

export async function pickSaveHtml(defaultPath: string): Promise<string | null> {
  const p = await dlgSave({ defaultPath, filters: [{ name: "HTML", extensions: ["html"] }] });
  return typeof p === "string" ? p : null;
}

export async function pickSaveBundle(defaultPath: string): Promise<string | null> {
  const p = await dlgSave({ defaultPath, filters: [{ name: "Pacote portátil para IA", extensions: ["zip"] }] });
  return typeof p === "string" ? p : null;
}

export async function pickImageFile(): Promise<string | null> {
  const p = await dlgOpen({ multiple: false, directory: false, filters: [IMG_FILTER] });
  return typeof p === "string" ? p : null;
}

/** Escolhe um áudio ou vídeo do computador (filtro único, com os formatos que o app toca). */
export async function pickMediaFile(): Promise<string | null> {
  const p = await dlgOpen({ multiple: false, directory: false, filters: [MEDIA_FILTER] });
  return typeof p === "string" ? p : null;
}

export async function pickFolders(): Promise<string[]> {
  const p = await dlgOpen({ multiple: true, directory: true });
  if (typeof p === "string") return [p];
  return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
}

export interface FolderEntry {
  name: string;
  relative: string;
  directory: boolean;
}

export interface FolderSnapshot {
  root: string;
  entries: FolderEntry[];
  truncated: boolean;
}

export async function inspectFolders(paths: string[]): Promise<FolderSnapshot[]> {
  return await invoke<FolderSnapshot[]>("inspect_folders", { paths });
}

export async function exportPortableBundle(docPath: string, content: string, outputPath: string): Promise<number> {
  return await invoke<number>("export_portable_bundle", { docPath, content, outputPath });
}

export async function loadDoc(path: string): Promise<string> {
  return await invoke<string>("load_text", { path });
}

/** true se existir um arquivo de texto legível nesse caminho. */
export async function existsText(path: string): Promise<boolean> {
  try {
    await invoke<string>("load_text", { path });
    return true;
  } catch {
    return false;
  }
}

export async function saveDoc(path: string, content: string): Promise<void> {
  await invoke("save_text", { path, content });
}

/** Copia um arquivo do disco para a pasta assets/ ao lado do documento. */
export async function copyAsset(docPath: string, srcPath: string): Promise<string> {
  return await invoke<string>("asset_copy", { doc: docPath, src: srcPath, name: null });
}

/** Grava bytes (base64) como um novo arquivo em assets/ ao lado do documento. */
export async function writeAsset(docPath: string, fileName: string, base64: string): Promise<string> {
  return await invoke<string>("asset_write", { doc: docPath, name: fileName, data: base64 });
}

/** Atualiza um arquivo de desenho já existente dentro de assets/. */
export async function updateAsset(docPath: string, relativePath: string, base64: string): Promise<void> {
  await invoke("asset_update", { doc: docPath, relative: relativePath, data: base64 });
}

/** Lê uma imagem do disco e devolve como data URL (para exibir na pré-visualização). */
export async function readDataUrl(path: string): Promise<string> {
  return await invoke<string>("read_file_data_url", { path });
}

/** Renomeia o arquivo do documento (mesma pasta) e devolve o caminho novo. */
export async function renameFile(from: string, to: string): Promise<string> {
  return await invoke<string>("rename_file", { from, to });
}

export interface DraftInfo {
  path: string;
  modified_ms: number;
}

/** Lista os rascunhos que o app guardou (mais novo primeiro). */
export async function listDrafts(): Promise<DraftInfo[]> {
  return await invoke<DraftInfo[]>("list_drafts");
}

/** Caminho livre para um novo rascunho na pasta do app. */
export async function draftPath(base: string, ext: "md" | "docx" | "pptx" | "xlsx" = "md"): Promise<string> {
  return await invoke<string>("draft_path", { base, ext });
}

/** Apaga um rascunho do app. */
export async function deleteDraft(path: string): Promise<void> {
  await invoke("delete_draft", { path });
}

export interface TrashEntry {
  /** nome do arquivo dentro da lixeira (ganha -1, -2… se já houver um igual) */
  name: string;
  /** caminho original do arquivo, para saber de onde ele veio */
  original: string;
  /** quando foi movido (ms desde 1970) */
  moved_at: number;
  /** caminho do arquivo dentro da lixeira (para achar no Explorer) */
  trash_path: string;
}

/** Move um documento para a lixeira do app (fica guardado 30 dias). */
export async function moveToTrash(path: string): Promise<TrashEntry> {
  return await invoke<TrashEntry>("trash_move", { path });
}

/** Apaga definitivamente o que passou dos 30 dias na lixeira. Devolve quantos saíram. */
export async function purgeTrash(): Promise<number> {
  return await invoke<number>("trash_purge");
}

/**
 * Salvamento automático quando o app roda no NAVEGADOR (dev): o navegador não pode
 * escrever arquivos, então o texto vai para o servidor de desenvolvimento, que grava
 * em `temp/rascunho.md` dentro do projeto (a mesma pasta que o app usa).
 */
export async function saveDraftFallback(name: string, content: string): Promise<boolean> {
  try {
    const res = await fetch("/__salvar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Lê o salvamento automático gravado pelo servidor de desenvolvimento (`temp/rascunho.md`). */
export async function loadDraftFallback(): Promise<string | null> {
  try {
    const res = await fetch("/temp/rascunho.md", { cache: "no-store" });
    if (!res.ok) return null;
    const texto = await res.text();
    return texto.trim() ? texto : null;
  } catch {
    return null;
  }
}

/** Copia a pasta assets/ de um documento para o lado do outro. */
export async function copyAssets(fromDoc: string, toDoc: string): Promise<number> {
  return await invoke<number>("copy_assets", { fromDoc, toDoc });
}

/** Pasta padrão de documentos (…/Documentos/mdOffice), criada se não existir. */
export async function defaultDocsDir(): Promise<string> {
  return await invoke<string>("default_docs_dir");
}

/** Caminho livre (.md) dentro de uma pasta, sem sobrescrever nada existente. */
export async function uniqueMdPath(dir: string, base: string): Promise<string> {
  return await invoke<string>("unique_md_path", { dir, base });
}

export interface MdNode {
  name: string;
  path: string;
  directory: boolean;
  children: MdNode[];
}

/** Documentos Markdown de uma pasta (com subpastas que tenham .md). */
export async function listMarkdown(path: string): Promise<MdNode[]> {
  return await invoke<MdNode[]>("list_markdown", { path });
}

/** Grava um arquivo binário (base64) — usado pelo DOCX. */
export async function saveBinary(path: string, base64: string): Promise<void> {
  await invoke("save_binary", { path, data: base64 });
}

/** Caixa "Salvar como" genérica para os formatos de exportação. */
export async function pickSaveAny(defaultPath: string, label: string, extensions: string[]): Promise<string | null> {
  const p = await dlgSave({ defaultPath, filters: [{ name: label, extensions }] });
  return typeof p === "string" ? p : null;
}

export interface ContentHit {
  path: string;
  name: string;
  line: number;
  text: string;
  start: number;
  end: number;
}

/** Procura um texto dentro dos documentos Markdown das pastas (sem diferenciar acentos/maiúsculas). */
export async function searchMarkdown(roots: string[], query: string, limit = 150): Promise<ContentHit[]> {
  return await invoke<ContentHit[]>("search_markdown", { roots, query, limit });
}
