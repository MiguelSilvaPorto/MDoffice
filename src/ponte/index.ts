// A PONTE com o disco: o único lugar que sabe se o app está no Tauri ou no navegador.
//
// No app nativo (Tauri) o disco é do backend Rust: o `invoke` manda o comando e o caminho é
// um caminho de verdade (`C:\Docs\notas.md`). No navegador o disco é do File System Access
// API: o "caminho" é o **id** do registro (`src/disco/registro.ts`) e o arquivo é um handle.
//
// O app **não sabe** de nada disso: `src/files.ts`, `src/backup.ts`, `src/storage.ts` e
// `src/preview.ts` chamam as MESMAS funções (o `invoke` e os diálogos) e a ponte traduz.
//
// O que só existe no app nativo (o backup em disco, a lixeira na pasta de dados e o painel de
// armazenamento) responde com um erro claro em vez de fingir que funcionou — quem chama já
// desliga essas telas quando não há backend (`temBackend`).

import { invoke as invokeTauri } from "@tauri-apps/api/core";
import { open as dlgOpenTauri, save as dlgSaveTauri, ask as askTauri } from "@tauri-apps/plugin-dialog";
import * as disco from "../disco/arquivo";
import * as backupDisco from "../disco/backup";
import * as lixeira from "../disco/lixeira";
import * as rascunhos from "../disco/rascunhos";
import { previaDoArquivo } from "../disco/zip";
import { buscarMarkdown, listarMarkdown } from "../disco/arvore";

/** O app está no Tauri (o backend Rust)? */
export function emTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** O app tem acesso ao disco? (o Tauri, ou o navegador com o File System Access API) */
export function temDisco(): boolean {
  return emTauri() || disco.temDisco();
}

/** O app é o de verdade (com disco), e não o modo "só texto" do navegador sem o FSA? */
export function emApp(): boolean {
  return temDisco();
}

// ---------------------------------------------------------------------------
// os comandos
// ---------------------------------------------------------------------------

/** O `invoke` do app: no Tauri vai para o Rust; no navegador, para a camada de disco. */
export async function invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (emTauri()) return await invokeTauri<T>(cmd, args);
  return await comandoDoDisco<T>(cmd, args);
}

/**
 * Os comandos que o navegador sabe fazer. Os que não estão aqui (o backup em disco, a lixeira
 * e o painel de armazenamento, que vivem na pasta de dados do app) só existem no Tauri — quem
 * chama já os desliga por `temBackend()`, e se algum escapar o erro diz o porquê.
 */
async function comandoDoDisco<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const texto = (v: unknown) => String(v ?? "");
  switch (cmd) {
    case "load_text":
      return (await disco.lerTexto(texto(args.path))) as T;
    case "save_text":
      return (await disco.gravarTexto(texto(args.path), texto(args.content))) as T;
    case "save_binary":
      return (await disco.gravarBytes(texto(args.path), texto(args.data))) as T;
    case "read_file_data_url":
      return (await disco.lerComoDataUrl(texto(args.path))) as T;
    case "rename_file":
      return (await disco.renomearDocumento(texto(args.from), texto(args.to))) as T;
    case "move_file":
      return (await disco.moverDocumento(texto(args.from), texto(args.toDir))) as T;
    case "create_folder":
      return (await disco.criarPasta(texto(args.parent), texto(args.name))) as T;
    case "rename_folder":
      return (await disco.renomearPasta(texto(args.from), texto(args.to))) as T;
    case "delete_folder":
      return (await disco.apagarPasta(texto(args.path))) as T;
    case "unique_md_path": {
      // no navegador o "caminho livre" nasce quando o arquivo é criado: a sugestão é o nome
      const base = slugify(texto(args.base));
      return `${base}.md` as T;
    }
    case "preview_file": {
      const bytes = await disco.bytesDoDocumento(texto(args.path));
      return (await previaDoArquivo(await disco.nomeDoDocumento(texto(args.path)), bytes)) as T;
    }
    case "list_markdown":
      return (await listarMarkdown(texto(args.path))) as T;
    case "search_markdown":
      return (await buscarMarkdown((args.roots as string[]) ?? [], texto(args.query), Number(args.limit) || 150)) as T;
    case "asset_copy":
      return (await disco.copiarAsset(texto(args.doc), texto(args.src), args.name as string | null)) as T;
    case "asset_write":
      return (await disco.escreverAsset(texto(args.doc), texto(args.name), texto(args.data))) as T;
    case "asset_update":
      return (await disco.atualizarAsset(texto(args.doc), texto(args.relative), texto(args.data))) as T;
    case "copy_assets":
      return (await disco.copiarAssets(texto(args.fromDoc), texto(args.toDoc))) as T;
    case "default_docs_dir":
      // o navegador não tem "Documentos": a pasta é a que a pessoa conceder (ou o seletor)
      return "" as T;
    // ---------- backup em disco (em `.mdoffice/backups`, dentro da pasta escolhida) ----------
    case "backup_config":
      return backupDisco.lerConfig() as T;
    case "backup_save_config":
      backupDisco.gravarConfig(args.config as Parameters<typeof backupDisco.gravarConfig>[0]);
      return undefined as T;
    case "backup_app_root":
      return backupDisco.pastaDoAppDoBackup() as T;
    case "backup_prepare_root":
      return backupDisco.prepararPasta(texto(args.path)) as T;
    case "backup_roots":
      return (await backupDisco.pastasAtivas()) as T;
    case "backup_write":
      return (await backupDisco.gravar(texto(args.path))) as T;
    case "backup_list":
      return (await backupDisco.listar(texto(args.path))) as T;
    case "backup_restore":
      return (await backupDisco.restaurar(texto(args.path), texto(args.root), texto(args.name))) as T;
    case "backup_delete":
      await backupDisco.apagarCopia(texto(args.path), texto(args.root), texto(args.name));
      return undefined as T;
    case "backup_prune":
      return (await backupDisco.limpar(Number(args.maxCopies) || 0, Number(args.maxDays) || 0)) as T;
    case "backup_forget":
      return (await backupDisco.esquecer(texto(args.path))) as T;
    case "backup_index":
      return (await backupDisco.indice()) as T;
    case "backup_missing":
      return (await backupDisco.sumidos()) as T;
    case "backup_aged":
      return (await backupDisco.antigos(Number(args.minDays) || 0)) as T;
    case "backup_save_history":
      await backupDisco.salvarHistorico(texto(args.path), texto(args.root), texto(args.json));
      return undefined as T;
    case "backup_load_history":
      return (await backupDisco.lerHistorico(texto(args.path), texto(args.root))) as T;
    case "backup_clear_history":
      await backupDisco.apagarHistorico(texto(args.path), texto(args.root));
      return undefined as T;
    // ---------- rascunhos (em `.mdoffice/rascunhos`, dentro da pasta escolhida) ----------
    case "draft_path":
      return (await rascunhos.criar(texto(args.base), texto(args.ext) || "md")) as T;
    case "list_drafts":
      return (await rascunhos.listar()) as T;
    case "drafts_folder_path":
      return rascunhos.pasta() as T;
    case "delete_draft":
      await rascunhos.apagar(texto(args.path));
      return undefined as T;
    // ---------- lixeira (em `.mdoffice/lixeira`, dentro da pasta escolhida) ----------
    case "trash_move":
      return (await lixeira.mover(texto(args.path))) as T;
    case "trash_purge":
      return (await lixeira.limpar()) as T;
    default:
      throw new Error(
        `O comando "${cmd}" só existe no app nativo (ele vive na pasta de dados do app, que o navegador não alcança).`,
      );
  }
}

/** O nome de arquivo simples e seguro (o mesmo do Rust). */
function slugify(entrada: string): string {
  const semAcento = entrada
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    semAcento
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "documento"
  );
}

// ---------------------------------------------------------------------------
// os diálogos nativos
// ---------------------------------------------------------------------------

export interface OpcoesAbrir {
  multiple?: boolean;
  directory?: boolean;
  filters?: { name: string; extensions: string[] }[];
}

export interface OpcoesSalvar {
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

/** "Abrir…": no Tauri é o diálogo do Rust; no navegador é o seletor do File System Access. */
export async function abrirDialogo(opts: OpcoesAbrir): Promise<string | string[] | null> {
  if (emTauri()) return await dlgOpenTauri(opts);
  if (opts.directory) {
    const id = await disco.escolherPasta();
    return id;
  }
  const exts = (opts.filters ?? []).flatMap((f) => f.extensions);
  const descricao = opts.filters?.[0]?.name ?? "Documentos";
  const id = await disco.escolherArquivo(exts, descricao);
  if (id && opts.multiple) return [id];
  return id;
}

/** "Salvar como…": no navegador, o seletor de arquivo do File System Access. */
export async function salvarDialogo(opts: OpcoesSalvar): Promise<string | null> {
  if (emTauri()) return await dlgSaveTauri(opts);
  const exts = (opts.filters ?? []).flatMap((f) => f.extensions);
  const descricao = opts.filters?.[0]?.name ?? "Documentos";
  const sugerido = (opts.defaultPath ?? "documento.md").split(/[\\/]/).pop() ?? "documento.md";
  // sem extensão (o caminho padrão pode ser só a pasta) o seletor não sabe o formato: usa a do filtro
  const nome = /\.[a-z0-9]+$/i.test(sugerido) ? sugerido : `documento.${exts[0] ?? "md"}`;
  return await disco.salvarComo(nome, exts, descricao);
}

/** A pergunta de confirmação (o "salvar alterações?" e o "apagar?"). */
export async function perguntar(mensagem: string, opcoes?: string | { title?: string; kind?: string }): Promise<boolean> {
  const titulo = typeof opcoes === "string" ? opcoes : (opcoes?.title ?? "mdOffice");
  if (emTauri()) return await askTauri(mensagem, { title: titulo });
  return window.confirm(`${titulo}\n\n${mensagem}`);
}

/** Mostra o arquivo na pasta — só existe no app nativo (o navegador não expõe caminho). */
export async function mostrarNaPasta(caminho: string): Promise<void> {
  if (!emTauri()) {
    throw new Error("No navegador não há como abrir a pasta do arquivo.");
  }
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(caminho);
}

/** Abre um link no navegador do sistema (ou numa aba, quando já é o navegador). */
export async function abrirUrl(url: string): Promise<void> {
  if (emTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}
