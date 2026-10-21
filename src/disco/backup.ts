// O backup em disco no navegador: `.mdoffice/backups/` DENTRO da pasta escolhida.
//
// Cada documento vira uma pasta espelhando o caminho, e dentro dela ficam as cópias
// datadas (`2026-10-21_10-42-13.md`), a cópia do estado anterior (`.orig`) e o histórico
// de alterações (`.historico/historico.json`):
//
//   Projeto/.mdoffice/backups/Projeto/notas.md/2026-10-21_10-42-13.md
//
// É o mesmo desenho do `commands/backup.rs` do app nativo (que espelha o caminho absoluto
// em `C_/…`). O que muda é a raiz: em vez da pasta de dados do Windows, tudo vive ao lado
// dos documentos — o backup viaja junto com a pasta do projeto.
//
// Não há limite de tamanho: a limpeza é só por política (quantidade de cópias e prazo), e
// uma cópia idêntica à última é ignorada (o autosave não enche o disco de repetições).
import {
  CONFIG_PADRAO,
  carimbo,
  type BackupConfig,
  type BackupEntry,
  type BackupFile,
  type BackupIndex,
  type BackupWriteResult,
  type IndexFile,
} from "../backupPolicy";
import { caminhoDeExibicao } from "./arquivo";
import { buscarDocumento, listarDocumentos, listarPastas, type DocumentoRegistrado } from "./registro";
import {
  apagarArquivo,
  escreverNoArquivo,
  existe,
  gravarBytes,
  gravarJson,
  gravarTexto,
  lerBytes,
  lerJson,
  lerTexto,
  mesmosBytes,
  nomesDeArquivos,
  pastaDoApp,
  raizDoDocumento,
  subpasta,
  subpastaSeExistir,
} from "./pastaApp";

/** O rótulo da raiz (é o que a interface mostra como "pasta do app"). */
const RAIZ = ".mdoffice/backups";
const PASTA_APP = ".mdoffice";
const PASTA = "backups";
const INDICE = "_indice.json";
const ORIGEM = ".origem.txt";
const HIST = ".historico";
/** quantos `.orig` a limpeza nunca apaga */
const KEEP_ORIG = 3;
/** onde a configuração fica guardada (o mesmo desenho do `backup.json` do Rust) */
const CHAVE_CONFIG = "mdc.backup-config";

// ---------- configuração ----------

export function lerConfig(): BackupConfig {
  try {
    const bruto = localStorage.getItem(CHAVE_CONFIG);
    if (bruto) return { ...CONFIG_PADRAO, ...(JSON.parse(bruto) as Partial<BackupConfig>) };
  } catch {
    /* preferência corrompida: volta ao padrão */
  }
  return { ...CONFIG_PADRAO };
}

export function gravarConfig(config: BackupConfig): void {
  try {
    localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config));
  } catch {
    /* sem armazenamento: vale o padrão nesta sessão */
  }
}

/** A pasta de backup da "aplicação" (no navegador, a mesma pasta escolhida). */
export function pastaDoAppDoBackup(): string {
  return RAIZ;
}

/** No navegador não se escolhe outra raiz: o backup vive dentro da pasta dos documentos. */
export function prepararPasta(_path: string): string {
  return RAIZ;
}

export async function pastasAtivas(): Promise<string[]> {
  return (await listarPastas()).length ? [RAIZ] : [];
}

// ---------- caminhos ----------

/** Um segmento de pasta seguro (`:` `\` `*` `?` `<` `>` `|` `"` e controle viram `_`). */
function sanitizar(segmento: string): string {
  const limpo = segmento
    .replace(/[<>:"\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  return limpo || "_";
}

function segmentos(original: string): string[] {
  return original.split("/").filter(Boolean).map(sanitizar);
}

function extensao(original: string): string {
  const nome = original.split("/").pop() ?? "";
  const ponto = nome.lastIndexOf(".");
  if (ponto <= 0) return "md";
  return nome.slice(ponto + 1).toLowerCase() || "md";
}

async function pastaBackupDaRaiz(raiz: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const app = await pastaDoApp(raiz);
  return await subpasta(app, [PASTA]);
}

async function pastaBackupDoDoc(doc: DocumentoRegistrado): Promise<FileSystemDirectoryHandle> {
  return await pastaBackupDaRaiz(await raizDoDocumento(doc));
}

async function pastaDaCopia(
  raizBackup: FileSystemDirectoryHandle,
  original: string,
  criar = true
): Promise<FileSystemDirectoryHandle> {
  return await subpasta(raizBackup, segmentos(original), criar);
}

/** Acha a raiz de backup de um caminho exibido, tentando cada pasta concedida. */
async function acharRaizBackup(original: string, criar = false): Promise<FileSystemDirectoryHandle | null> {
  const primeiro = original.split("/").filter(Boolean)[0] ?? "";
  for (const concedida of await listarPastas()) {
    if (primeiro && concedida.nome !== primeiro) continue;
    const raiz = criar
      ? await pastaBackupDaRaiz(concedida.handle)
      : await subpastaSeExistir(concedida.handle, [PASTA_APP, PASTA]);
    if (raiz) return raiz;
  }
  return null;
}

async function acharCopia(original: string): Promise<FileSystemDirectoryHandle | null> {
  const raiz = await acharRaizBackup(original);
  if (!raiz) return null;
  return await subpastaSeExistir(raiz, segmentos(original));
}

interface Contexto {
  doc: DocumentoRegistrado | null;
  docId: string;
  original: string;
  raizBackup: FileSystemDirectoryHandle | null;
  dir: FileSystemDirectoryHandle | null;
}

/** Resolve tudo o que as operações precisam: documento, caminho exibido e pastas. */
async function contexto(path: string, criar = false): Promise<Contexto> {
  const doc = await buscarDocumento(path);
  const original = doc ? await caminhoDeExibicao(doc.id) : path;
  let raizBackup: FileSystemDirectoryHandle | null;
  if (doc) {
    // a raiz é a do PRÓPRIO documento: um arquivo aberto sozinho (sem pasta concedida) usa a
    // pasta dele pelo `parent`, e o backup tem de ser procurado ali — não pelo nome exibido
    const raiz = await raizDoDocumento(doc);
    raizBackup = criar ? await pastaBackupDaRaiz(raiz) : await subpastaSeExistir(raiz, [PASTA_APP, PASTA]);
  } else {
    raizBackup = await acharRaizBackup(original, criar);
  }
  const dir = raizBackup
    ? criar
      ? await pastaDaCopia(raizBackup, original, true)
      : await subpastaSeExistir(raizBackup, segmentos(original))
    : null;
  return { doc, docId: doc?.id ?? "", original, raizBackup, dir };
}

// ---------- o índice ----------

interface EntradaIndice {
  docId: string;
  original: string;
  copies: BackupFile[];
}

interface Indice {
  versao: 1;
  docs: Record<string, EntradaIndice>;
}

async function lerIndice(raizBackup: FileSystemDirectoryHandle): Promise<Indice> {
  const lido = await lerJson<Indice>(raizBackup, INDICE);
  if (lido && lido.docs) return lido;
  return { versao: 1, docs: {} };
}

async function gravarIndice(raizBackup: FileSystemDirectoryHandle, indice: Indice): Promise<void> {
  await gravarJson(raizBackup, INDICE, indice);
}

/** Lê as cópias de uma pasta (o nome carrega o carimbo; o `.orig` é a proteção). */
function nomeDaCopia(nome: string): { stamp: string; protection: boolean } | null {
  const ponto = nome.lastIndexOf(".");
  if (ponto <= 0) return null;
  let base = nome.slice(0, ponto);
  const protection = base.endsWith(".orig");
  if (protection) base = base.slice(0, -5);
  if (!/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(base)) return null;
  return { stamp: base, protection };
}

async function listarCopias(dir: FileSystemDirectoryHandle): Promise<BackupFile[]> {
  const copias: BackupFile[] = [];
  for (const nome of await nomesDeArquivos(dir)) {
    const info = nomeDaCopia(nome);
    if (!info) continue;
    let bytes = 0;
    let at = 0;
    try {
      const arquivo = await (await dir.getFileHandle(nome)).getFile();
      bytes = arquivo.size;
      at = arquivo.lastModified;
    } catch {
      /* sumiu no meio da leitura */
    }
    copias.push({ root: RAIZ, name: nome, stamp: info.stamp, bytes, at, protection: info.protection });
  }
  return copias.sort((a, b) => b.at - a.at);
}

async function reindexar(
  raizBackup: FileSystemDirectoryHandle,
  original: string,
  docId: string,
  dir: FileSystemDirectoryHandle
): Promise<void> {
  const indice = await lerIndice(raizBackup);
  const copies = await listarCopias(dir);
  if (!copies.length) delete indice.docs[original];
  else indice.docs[original] = { docId, original, copies };
  await gravarIndice(raizBackup, indice);
}

// ---------- gravação ----------

/**
 * Guarda uma cópia datada do documento.
 *
 * Uma cópia idêntica à última é ignorada (o autosave salva a cada poucos segundos; sem
 * isso o backup cresceria sem parar). A proteção `.orig` guarda o estado ANTERIOR antes de
 * a política de rotação poder apagá-lo.
 */
export async function gravar(path: string): Promise<BackupWriteResult> {
  const cfg = lerConfig();
  if (!cfg.enabled) return { written: [], failed: [], skipped: true };
  const doc = await buscarDocumento(path);
  if (!doc) return { written: [], failed: ["O documento não está mais registrado."], skipped: false };

  const original = await caminhoDeExibicao(doc.id);
  const raizBackup = await pastaBackupDoDoc(doc);
  const dir = await pastaDaCopia(raizBackup, original);
  const bytes = new Uint8Array(await (await doc.handle.getFile()).arrayBuffer());

  const copias = await listarCopias(dir);
  const ultima = copias.find((c) => !c.protection) ?? null;
  if (ultima) {
    const anterior = await lerBytes(dir, ultima.name);
    if (anterior && mesmosBytes(anterior, bytes)) {
      return { written: [], failed: [], skipped: true };
    }
  }

  const ext = extensao(original);
  // O carimbo tem resolução de segundo. Duas gravações no mesmo segundo (o autosave faz
  // isso) sobrescreveriam a MESMA cópia e a versão anterior se perderia — então o carimbo
  // anda um segundo para a frente até achar um nome livre.
  let stamp = carimbo();
  let segundos = 0;
  while ((await existe(dir, `${stamp}.${ext}`)) || (await existe(dir, `${stamp}.orig.${ext}`))) {
    segundos++;
    stamp = carimbo(new Date(Date.now() + segundos * 1000));
  }
  if (cfg.protect && ultima) {
    const anterior = await lerBytes(dir, ultima.name);
    if (anterior) await gravarBytes(dir, `${stamp}.orig.${ext}`, anterior);
  }
  await gravarBytes(dir, `${stamp}.${ext}`, bytes);
  if (!(await existe(dir, ORIGEM))) {
    await gravarBytes(dir, ORIGEM, new TextEncoder().encode(original));
  }

  await podar(dir, cfg.max_copies, cfg.max_days);
  await reindexar(raizBackup, original, doc.id, dir);
  return { written: [`${RAIZ}/${original}/${stamp}.${ext}`], failed: [], skipped: false };
}

/** Corta as cópias antigas conforme a política. Devolve quantas saíram. */
async function podar(
  dir: FileSystemDirectoryHandle,
  maxCopies: number,
  maxDays: number
): Promise<number> {
  if (!maxCopies && !maxDays) return 0;
  const copias = await listarCopias(dir); // da mais nova para a mais velha
  const corte = maxDays > 0 ? Date.now() - maxDays * 24 * 60 * 60 * 1000 : 0;
  let datadas = 0;
  let protegidas = 0;
  let apagadas = 0;
  for (const copia of copias) {
    const velha = corte > 0 && copia.at > 0 && copia.at < corte;
    if (copia.protection) {
      // as `.orig` mais recentes sobrevivem à rotação (são a rede de segurança)
      if (!velha && protegidas < KEEP_ORIG) {
        protegidas++;
        continue;
      }
    } else {
      const excedente = maxCopies > 0 && datadas >= maxCopies;
      if (!velha && !excedente) {
        datadas++;
        continue;
      }
    }
    if (await apagarArquivo(dir, copia.name)) apagadas++;
  }
  return apagadas;
}

// ---------- leitura ----------

/** Cópias de um documento (aceita o id do registro ou o caminho exibido). */
export async function listar(alvo: string): Promise<BackupEntry> {
  const ctx = await contexto(alvo);
  if (!ctx.dir) return { original: ctx.original, copies: [], bytes: 0, missing: !ctx.doc };
  const copies = await listarCopias(ctx.dir);
  return { original: ctx.original, copies, bytes: copies.reduce((a, c) => a + c.bytes, 0), missing: !ctx.doc };
}

/**
 * Devolve uma cópia para o lugar original.
 *
 * Se o arquivo ainda existe, grava por cima (o estado atual já está protegido no backup).
 * Se foi apagado, recria a partir da pasta concedida — é o "recuperar o que sumiu".
 */
export async function restaurar(path: string, _root: string, name: string): Promise<string> {
  const ctx = await contexto(path);
  const dir = ctx.dir ?? (await acharCopia(ctx.original));
  if (!dir) throw new Error("Essa cópia de backup não foi encontrada.");
  const bytes = await lerBytes(dir, name);
  if (!bytes) throw new Error("Essa cópia de backup não foi encontrada.");

  if (ctx.doc) {
    await escreverNoArquivo(ctx.doc.handle, bytes);
    return ctx.original;
  }

  const partes = segmentos(ctx.original);
  if (partes.length < 2) throw new Error("Não dá para saber em que pasta este arquivo ficava.");
  const concedida = await acharConcedida(ctx.original);
  if (!concedida) throw new Error("A pasta do documento não está mais disponível.");
  // o caminho exibido começa com o nome da pasta concedida ("Projeto/notas.md"): ele NÃO
  // entra no caminho dentro dela, senão nasceria "Projeto/Projeto/notas.md"
  const dentro = partes.slice(1);
  const pai = await subpasta(concedida, dentro.slice(0, -1));
  const arquivo = await pai.getFileHandle(dentro[dentro.length - 1], { create: true });
  await escreverNoArquivo(arquivo, bytes);
  return ctx.original;
}

async function acharConcedida(original: string): Promise<FileSystemDirectoryHandle | null> {
  const primeiro = original.split("/").filter(Boolean)[0] ?? "";
  for (const pasta of await listarPastas()) {
    if (pasta.nome === primeiro) return pasta.handle;
  }
  return null;
}

/** Apaga uma cópia específica. */
export async function apagarCopia(path: string, _root: string, name: string): Promise<void> {
  const ctx = await contexto(path);
  if (!ctx.dir || !ctx.raizBackup) return;
  await apagarArquivo(ctx.dir, name);
  await reindexar(ctx.raizBackup, ctx.original, ctx.docId, ctx.dir);
}

/** Apaga as cópias antigas conforme a política. Devolve quantas saíram. */
export async function limpar(maxCopies: number, maxDays: number): Promise<number> {
  let total = 0;
  for (const concedida of await listarPastas()) {
    const raiz = await subpastaSeExistir(concedida.handle, [PASTA_APP, PASTA]);
    if (!raiz) continue;
    const indice = await lerIndice(raiz);
    for (const entrada of Object.values(indice.docs)) {
      const dir = await subpastaSeExistir(raiz, segmentos(entrada.original));
      if (!dir) continue;
      total += await podar(dir, maxCopies, maxDays);
      await reindexar(raiz, entrada.original, entrada.docId, dir);
    }
  }
  return total;
}

/** Remove todas as cópias de um documento. */
export async function esquecer(path: string): Promise<number> {
  const ctx = await contexto(path);
  if (!ctx.dir || !ctx.raizBackup) return 0;
  const quantas = (await listarCopias(ctx.dir)).length;
  const partes = segmentos(ctx.original);
  try {
    const pai = await subpasta(ctx.raizBackup, partes.slice(0, -1), false);
    await pai.removeEntry(partes[partes.length - 1], { recursive: true });
  } catch {
    /* já não está lá */
  }
  const indice = await lerIndice(ctx.raizBackup);
  delete indice.docs[ctx.original];
  await gravarIndice(ctx.raizBackup, indice);
  return quantas;
}

/** Métricas de espaço de todos os documentos com backup. */
export async function indice(): Promise<BackupIndex> {
  const arquivos: IndexFile[] = [];
  const pastas = await listarPastas();
  for (const concedida of pastas) {
    const raiz = await subpastaSeExistir(concedida.handle, [PASTA_APP, PASTA]);
    if (!raiz) continue;
    const idx = await lerIndice(raiz);
    for (const entrada of Object.values(idx.docs)) {
      const copies = entrada.copies.length;
      if (!copies) continue;
      const bytes = entrada.copies.reduce((a, c) => a + c.bytes, 0);
      const ats = entrada.copies.map((c) => c.at || 0).filter(Boolean);
      const oldest = ats.length ? Math.min(...ats) : 0;
      const newest = ats.length ? Math.max(...ats) : 0;
      const days = oldest ? Math.floor((Date.now() - oldest) / 86400000) : 0;
      arquivos.push({ original: entrada.original, copies, bytes, oldest, newest, days });
    }
  }
  return {
    roots: pastas.length ? [RAIZ] : [],
    files: arquivos.sort((a, b) => b.newest - a.newest),
    copies: arquivos.reduce((a, f) => a + f.copies, 0),
    bytes: arquivos.reduce((a, f) => a + f.bytes, 0),
  };
}

/** Documentos com backup cujo original não está mais aberto/registrado. */
export async function sumidos(): Promise<BackupEntry[]> {
  const docs = await listarDocumentos();
  const vivos = new Set<string>();
  for (const doc of docs) vivos.add(await caminhoDeExibicao(doc.id));
  const fora: BackupEntry[] = [];
  for (const concedida of await listarPastas()) {
    const raiz = await subpastaSeExistir(concedida.handle, [PASTA_APP, PASTA]);
    if (!raiz) continue;
    const idx = await lerIndice(raiz);
    for (const entrada of Object.values(idx.docs)) {
      if (vivos.has(entrada.original)) continue;
      const dir = await subpastaSeExistir(raiz, segmentos(entrada.original));
      const copies = dir ? await listarCopias(dir) : entrada.copies;
      if (!copies.length) continue;
      fora.push({ original: entrada.original, copies, bytes: copies.reduce((a, c) => a + c.bytes, 0), missing: true });
    }
  }
  return fora;
}

/** Documentos cujas cópias mais antigas já têm muitos dias. */
export async function antigos(minDays: number): Promise<IndexFile[]> {
  const tudo = await indice();
  return tudo.files.filter((f) => f.copies > 0 && f.days >= minDays);
}

// ---------- o log de alterações vai junto do backup ----------

export async function salvarHistorico(path: string, _root: string, json: string): Promise<void> {
  const ctx = await contexto(path, true);
  if (!ctx.dir) throw new Error("A pasta de backup não está disponível.");
  const hist = await subpasta(ctx.dir, [HIST]);
  await gravarTexto(hist, "historico.json", json);
}

export async function lerHistorico(path: string, _root: string): Promise<string | null> {
  const ctx = await contexto(path);
  if (!ctx.dir) return null;
  const hist = await subpastaSeExistir(ctx.dir, [HIST]);
  if (!hist) return null;
  return await lerTexto(hist, "historico.json");
}

export async function apagarHistorico(path: string, _root: string): Promise<void> {
  const ctx = await contexto(path);
  if (!ctx.dir) return;
  try {
    await ctx.dir.removeEntry(HIST, { recursive: true });
  } catch {
    /* já não está lá */
  }
}
