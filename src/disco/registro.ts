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

/** Registra um documento (o handle vem de uma escolha da pessoa) e devolve o registro. */
export async function registrarDocumento(
  handle: FileSystemFileHandle,
  pastaId: string,
  relativo: string,
): Promise<DocumentoRegistrado> {
  let modificado = Date.now();
  let bytes = 0;
  try {
    const arquivo = await handle.getFile();
    modificado = arquivo.lastModified || modificado;
    bytes = arquivo.size;
  } catch {
    /* o arquivo sumiu: o registro fica com o que sabemos */
  }
  const entrada: DocumentoRegistrado = {
    id: uid(),
    handle,
    nome: handle.name,
    relativo,
    pastaId,
    modificado,
    bytes,
  };
  await transacionar(STORE_DOCS, "readwrite", (s) => s.put(entrada));
  return entrada;
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
  try {
    const db = await abrir();
    const r = await envolver(db.transaction(STORE_DOCS, "readonly").objectStore(STORE_DOCS).getAll());
    return (r as DocumentoRegistrado[]) ?? [];
  } catch {
    return [];
  }
}

/** Escreve de volta os dados do documento (o handle continua o mesmo). */
export async function atualizarDocumento(entrada: DocumentoRegistrado): Promise<void> {
  await transacionar(STORE_DOCS, "readwrite", (s) => s.put(entrada));
}

/** Tira o documento do registro (o arquivo em si é apagado à parte). */
export async function apagarDocumento(id: string): Promise<void> {
  await transacionar(STORE_DOCS, "readwrite", (s) => s.delete(id));
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

/** A pasta "padrão" do app: a primeira que a pessoa concedeu (a do projeto). */
export async function pastaPadrao(): Promise<PastaRegistrada | null> {
  const pastas = await listarPastas();
  return pastas[0] ?? null;
}
