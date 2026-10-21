// O REGISTRO do disco: o app não guarda caminhos, guarda **handles**.
//
// No app nativo o documento é um caminho (`C:\Docs\notas.md`). No navegador o documento é
// um *handle* — um objeto que o Chromium dá quando a pessoa escolhe a pasta/arquivo, e que
// sobrevive ao recarregar a página **se for guardado no IndexedDB** (é o que este arquivo
// faz). O handle não tem caminho: ele tem nome, e o app guarda também o caminho *relativo*
// dentro da pasta escolhida (é o que a pessoa vê na barra e o que o backup espelha).
//
// O `path` do app (a identidade do documento: a chave do histórico, da sessão, do backup)
// é o **id** do registro no navegador — no app nativo continua sendo o caminho absoluto.

import { uid } from "../util";

const DB_NAME = "mdc-disco";
const STORE_DOCS = "documentos";
const STORE_PASTAS = "pastas";

/**
 * A pasta que a pessoa escolheu para os rascunhos (Configurações ▸ Histórico e salvamento).
 *
 * Fica no MESMO armazém das pastas concedidas, com um id reservado: o handle precisa
 * sobreviver ao recarregar, e o IndexedDB já é o lugar onde os handles vivem. O id especial
 * mantém essa pasta fora de `pastaPadrao()` — ela é dos rascunhos, não dos documentos.
 */
export const ID_RASCUNHOS = "__rascunhos__";

/** Prefixo do id dos rascunhos que moram na pasta escolhida (a interface usa para o rótulo). */
export const PREFIXO_RASCUNHO = "rascunho/";

/** Um documento que o app tem aberto (o handle é o arquivo de verdade). */
export interface DocumentoRegistrado {
  /** a identidade do documento (é o `path` do app no navegador) */
  id: string;
  handle: FileSystemFileHandle;
  /** o nome do arquivo */
  nome: string;
  /** o caminho dentro da pasta escolhida ("Projeto/notas.md") */
  relativo: string;
  /** a pasta onde ele vive */
  pastaId: string;
  /** quando foi modificado pela última vez (ms desde 1970) */
  modificado: number;
  /** o tamanho em bytes */
  bytes: number;
}

/** Uma pasta que a pessoa concedeu ao app. */
export interface PastaRegistrada {
  id: string;
  handle: FileSystemDirectoryHandle;
  /** o nome da pasta */
  nome: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((ok, fail) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_DOCS)) db.createObjectStore(STORE_DOCS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_PASTAS)) db.createObjectStore(STORE_PASTAS, { keyPath: "id" });
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
  }
  return dbPromise;
}

function envolver<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fail) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function transacionar<T>(store: string, modo: IDBTransactionMode, acao: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return await envolver(acao(db.transaction(store, modo).objectStore(store)));
}

// ---------- documentos ----------

/**
 * Cache em memória do registro.
 *
 * A árvore registra centenas de arquivos de uma vez (`listarMarkdown`): sem o cache, cada
 * arquivo faria um `getAll` para saber se já estava registrado — O(n²) no IndexedDB. Toda
 * escrita passa por este módulo, então o cache não fica velho por dentro do app.
 */
let cache: DocumentoRegistrado[] | null = null;

/**
 * Registra um documento (o handle vem de uma escolha da pessoa) e devolve o registro.
 *
 * O `id` é o **caminho relativo** dentro da pasta concedida (`notas.md`, `Sub/notas.md`):
 * continua opaco para o app (é a identidade usada no histórico, na sessão e no backup), mas
 * é legível — a aba, o título da janela e os menus usam `baseName(path)` e passam a mostrar
 * o nome do arquivo em vez de um código aleatório.
 *
 * Se o MESMO arquivo for registrado de novo (a árvore é relida a cada mudança), o registro
 * existente é reaproveitado: o id não muda, e a aba/histórico/backup continuam valendo.
 */
export async function registrarDocumento(
  handle: FileSystemFileHandle,
  pastaId: string,
  relativo: string,
  /** a semente do id quando o rascunho mora numa pasta própria (evita colidir com um
   *  documento de mesmo nome em outra pasta); sem ela, o id é o próprio `relativo` */
  idBase = "",
): Promise<DocumentoRegistrado> {
  const todos = await listarDocumentos();
  const existente = todos.find(
    (d) => d.pastaId === pastaId && d.relativo.toLowerCase() === relativo.toLowerCase()
  );
  let modificado = Date.now();
  let bytes = 0;
  try {
    const arquivo = await handle.getFile();
    modificado = arquivo.lastModified || modificado;
    bytes = arquivo.size;
  } catch {
    /* o arquivo sumiu: o registro fica com o que sabemos */
  }
  if (existente) {
    existente.handle = handle;
    existente.nome = handle.name;
    existente.modificado = modificado;
    existente.bytes = bytes;
    await atualizarDocumento(existente);
    return existente;
  }
  const base = idBase || relativo || handle.name;
  let id = base;
  let n = 1;
  while (todos.some((d) => d.id === id)) id = `${base} (${++n})`;
  const entrada: DocumentoRegistrado = {
    id,
    handle,
    nome: handle.name,
    relativo,
    pastaId,
    modificado,
    bytes,
  };
  await transacionar(STORE_DOCS, "readwrite", (s) => s.put(entrada));
  todos.push(entrada);
  return entrada;
}

/** O documento já registrado com este caminho dentro da pasta (null se ainda não). */
export async function documentoPorCaminho(
  pastaId: string,
  relativo: string
): Promise<DocumentoRegistrado | null> {
  const todos = await listarDocumentos();
  const alvo = relativo.toLowerCase();
  return todos.find((d) => d.pastaId === pastaId && d.relativo.toLowerCase() === alvo) ?? null;
}

/** O documento de um id (null se não estiver mais registrado). */
export async function buscarDocumento(id: string): Promise<DocumentoRegistrado | null> {
  try {
    const db = await abrir();
    const r = await envolver(db.transaction(STORE_DOCS, "readonly").objectStore(STORE_DOCS).get(id));
    return (r as DocumentoRegistrado | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Todos os documentos registrados. */
export async function listarDocumentos(): Promise<DocumentoRegistrado[]> {
  if (cache) return cache;
  try {
    const db = await abrir();
    const r = await envolver(db.transaction(STORE_DOCS, "readonly").objectStore(STORE_DOCS).getAll());
    cache = (r as DocumentoRegistrado[]) ?? [];
    return cache;
  } catch {
    return [];
  }
}

/** Escreve de volta os dados do documento (o handle continua o mesmo). */
export async function atualizarDocumento(entrada: DocumentoRegistrado): Promise<void> {
  await transacionar(STORE_DOCS, "readwrite", (s) => s.put(entrada));
  if (cache) {
    const i = cache.findIndex((d) => d.id === entrada.id);
    if (i >= 0) cache[i] = entrada;
    else cache.push(entrada);
  }
}

/** Tira o documento do registro (o arquivo em si é apagado à parte). */
export async function apagarDocumento(id: string): Promise<void> {
  await transacionar(STORE_DOCS, "readwrite", (s) => s.delete(id));
  if (cache) cache = cache.filter((d) => d.id !== id);
}

// ---------- pastas ----------

/** Registra uma pasta que a pessoa concedeu. */
export async function registrarPasta(handle: FileSystemDirectoryHandle): Promise<PastaRegistrada> {
  const entrada: PastaRegistrada = { id: uid(), handle, nome: handle.name };
  await transacionar(STORE_PASTAS, "readwrite", (s) => s.put(entrada));
  return entrada;
}

export async function buscarPasta(id: string): Promise<PastaRegistrada | null> {
  try {
    const db = await abrir();
    const r = await envolver(db.transaction(STORE_PASTAS, "readonly").objectStore(STORE_PASTAS).get(id));
    return (r as PastaRegistrada | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function listarPastas(): Promise<PastaRegistrada[]> {
  try {
    const db = await abrir();
    const r = await envolver(db.transaction(STORE_PASTAS, "readonly").objectStore(STORE_PASTAS).getAll());
    return (r as PastaRegistrada[]) ?? [];
  } catch {
    return [];
  }
}

export async function apagarPasta(id: string): Promise<void> {
  await transacionar(STORE_PASTAS, "readwrite", (s) => s.delete(id));
}

/** Guarda a pasta escolhida para os rascunhos (o handle sobrevive ao recarregar). */
export async function guardarPastaDeRascunhos(handle: FileSystemDirectoryHandle): Promise<PastaRegistrada> {
  const entrada: PastaRegistrada = {
    id: ID_RASCUNHOS,
    handle,
    nome: handle.name || "Pasta dos rascunhos",
  };
  await transacionar(STORE_PASTAS, "readwrite", (s) => s.put(entrada));
  return entrada;
}

/** A pasta que a pessoa escolheu para os rascunhos (null = nunca escolheu). */
export async function pastaDeRascunhosSalva(): Promise<PastaRegistrada | null> {
  return await buscarPasta(ID_RASCUNHOS);
}

/** Esquece a pasta dos rascunhos (o handle sai do registro; os arquivos ficam). */
export async function esquecerPastaDeRascunhos(): Promise<void> {
  await apagarPasta(ID_RASCUNHOS);
}

/** A pasta "padrão" do app: a primeira que a pessoa concedeu (a do projeto). */
export async function pastaPadrao(): Promise<PastaRegistrada | null> {
  const pastas = await listarPastas();
  // a pasta dos rascunhos mora no mesmo armazém, mas não é a pasta do projeto
  return pastas.find((p) => p.id !== ID_RASCUNHOS) ?? null;
}
