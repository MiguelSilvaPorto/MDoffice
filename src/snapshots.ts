// Log de alterações por patches (estilo commit): guarda a INSTRUÇÃO do que mudou, não o
// arquivo inteiro. É leve e desfaz tudo o que foi feito.
//
// Cada alteração vira um commit com o diff entre o texto anterior e o novo. A cada 20
// commits um deles vira "âncora": guarda o texto completo e serve de ponto de partida
// para reconstruir qualquer versão rápido.
//
// Vale para todos os motores: .md é texto puro e .docx/.pptx/.xlsx são serializados em
// JSON — para o log é tudo string.

export interface PatchOp {
  /** posição no texto ANTIGO (em caracteres), de onde a mudança começa */
  at: number;
  /** texto que estava no lugar e some ao aplicar */
  prev: string;
  /** texto que entra no lugar ao aplicar */
  next: string;
  /**
   * posição da MESMA mudança no texto NOVO.
   *
   * Guardar as duas posições é o que torna o desfazer exato: ao aplicar, cada posição
   * é medida no texto antigo; ao desfazer, no texto novo. Sem `atNext`, desfazer
   * depende de estimar o quanto o texto encurtou ou alongou — e erra.
   */
  atNext: number;
}

export interface Commit {
  id?: number;
  /** caminho do documento em minúsculas (o histórico acompanha renomeio/salvar como) */
  doc: string;
  at: number;
  /** mudanças desde o commit anterior */
  ops: PatchOp[];
  /** texto completo — só na âncora (a cada 20 commits) */
  text?: string;
  /** resumo curto: "+12 caracteres −3" */
  summary: string;
  manual: boolean;
  label?: string;
}

const DB_NAME = "mdc-commits";
const STORE = "commits";
/** um commit guarda o texto inteiro a cada 20 — ponto de partida para reconstruir */
export const ANCHOR_EVERY = 20;
/** commits guardados por documento (as âncoras e os marcados à mão têm prioridade) */
const MAX_COMMITS = 2000;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((ok, fail) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("doc", "doc");
        store.createIndex("docAt", ["doc", "at"]);
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
  }
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fail) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

const key = (path: string) => path.toLowerCase();

// ---------- diff: a instrução da mudança ----------

/**
 * Diff de caracteres entre dois textos.
 *
 * Vai do mais barato para o mais caro:
 *  1. prefixo e sufixo comuns saem de graça — é o caso de quase toda digitação, em que
 *     mudou uma palavra no meio e o resto é idêntico;
 *  2. o miolo pequeno é comparado caractere a caractere (LCS);
 *  3. miolo grande demais cai para "substitui tudo" — ainda reconstrói o texto certo,
 *     só ocupa mais espaço.
 *
 * Cada operação sai com a posição no texto antigo E no novo, e o trecho que ela declara
 * casa com o que está lá. É essa garantia que sustenta o desfazer.
 */
function diffChars(a: string, b: string): PatchOp[] {
  if (a === b) return [];

  // 1. o que é igual nas pontas
  let head = 0;
  const maxHead = Math.min(a.length, b.length);
  while (head < maxHead && a.charCodeAt(head) === b.charCodeAt(head)) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a.charCodeAt(a.length - 1 - tail) === b.charCodeAt(b.length - 1 - tail)
  ) {
    tail++;
  }
  const meioA = a.slice(head, a.length - tail);
  const meioB = b.slice(head, b.length - tail);
  if (!meioA && !meioB) return [];

  // 3. miolo grande: substitui inteiro (a tabela do LCS seria gigabytes)
  if (meioA.length * meioB.length > 4_000_000) {
    return [{ at: head, prev: meioA, next: meioB, atNext: head }];
  }

  // 2. LCS caractere a caractere
  const n = meioA.length;
  const m = meioB.length;
  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i * w + j] =
        meioA[i] === meioB[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    }
  }

  const ops: PatchOp[] = [];
  let posA = 0; // caracteres de meioA já percorridos
  let posB = 0; // caracteres de meioB já escritos
  let i = 0;
  let j = 0;
  let del = "";
  let ins = "";
  let iniA = 0;
  let iniB = 0;
  const fechar = () => {
    if (del !== ins) ops.push({ at: head + iniA, prev: del, next: ins, atNext: head + iniB });
    del = "";
    ins = "";
  };

  while (i < n && j < m) {
    if (meioA[i] === meioB[j]) {
      fechar(); // casou: encerra a troca em curso
      i++;
      j++;
      posA++;
      posB++;
      continue;
    }
    if (!del && !ins) {
      iniA = posA;
      iniB = posB;
    }
    // segue pelo caminho que preserva mais texto comum (a regra da própria tabela)
    if (t[(i + 1) * w + j] >= t[i * w + j + 1]) {
      del += meioA[i];
      i++;
      posA++;
    } else {
      ins += meioB[j];
      j++;
      posB++;
    }
  }
  if (i < n || j < m) {
    if (!del && !ins) {
      iniA = posA;
      iniB = posB;
    }
    while (i < n) {
      del += meioA[i++];
      posA++;
    }
    while (j < m) {
      ins += meioB[j++];
      posB++;
    }
  }
  fechar();
  return ops;
}

/** Diff do documento inteiro. */
export function diffText(oldText: string, newText: string): PatchOp[] {
  if (oldText === newText) return [];
  if (!oldText) return [{ at: 0, prev: "", next: newText, atNext: 0 }];
  if (!newText) return [{ at: 0, prev: oldText, next: "", atNext: 0 }];
  return diffChars(oldText, newText);
}

/**
 * Aplica as operações: o texto antigo vira o novo.
 *
 * As posições de cada operação são medidas no texto de origem e não se sobrepõem, então
 * uma varredura com cursor basta.
 */
export function applyOps(text: string, ops: PatchOp[]): string {
  if (!ops.length) return text;
  let out = "";
  let cursor = 0;
  for (const op of ops) {
    const inicio = Math.min(op.at, text.length);
    if (inicio > cursor) out += text.slice(cursor, inicio);
    cursor = Math.min(inicio + op.prev.length, text.length);
    out += op.next;
  }
  if (cursor < text.length) out += text.slice(cursor);
  return out;
}

/**
 * Inverte as operações: o texto novo volta ao anterior (desfazer).
 *
 * Cada operação sabe onde sua mudança está no texto NOVO (`atNext`), então basta varrer
 * de trás para frente trocando `next` por `prev` — cada posição continua válida porque
 * cada uma se refere ao texto que ela realmente mede.
 */
export function revertOps(text: string, ops: PatchOp[]): string {
  if (!ops.length) return text;
  let out = text;
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    const inicio = Math.min(op.atNext, out.length);
    out = out.slice(0, inicio) + op.prev + out.slice(inicio + op.next.length);
  }
  return out;
}

/** Resumo curto da mudança ("+12 −3"). */
export function summarize(ops: PatchOp[]): string {
  let entrou = 0;
  let saiu = 0;
  for (const op of ops) {
    entrou += op.next.length;
    saiu += op.prev.length;
  }
  const partes: string[] = [];
  if (entrou) partes.push(`+${entrou}`);
  if (saiu) partes.push(`−${saiu}`);
  return partes.length ? partes.join(" ") : "sem mudança de texto";
}

// ---------- gravação ----------

export interface RecordOpts {
  manual?: boolean;
  label?: string;
  /** Resumo pronto (texto legível); sem ele, o resumo sai dos patches da serialização. */
  resumo?: string;
}

/**
 * Guarda a alteração num commit (ou na âncora, a cada 20). Devolve o id gravado.
 */
export async function recordCommit(
  doc: string,
  oldText: string,
  newText: string,
  opts: RecordOpts = {}
): Promise<number | null> {
  if (!doc || oldText === newText) return null;
  try {
    const lista = await listCommits(doc);
    // commits desde a última âncora
    let desdeAncora = 0;
    for (let k = lista.length - 1; k >= 0; k--) {
      if (lista[k].text !== undefined) break;
      desdeAncora++;
    }
    const ehAncora = opts.manual || desdeAncora >= ANCHOR_EVERY - 1;
    const ops = ehAncora ? [] : diffText(oldText, newText);
    if (!ehAncora && !ops.length) return null;

    const db = await open();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    const commit: Commit = {
      doc: key(doc),
      at: Date.now(),
      ops,
      text: ehAncora ? newText : undefined,
      summary: ehAncora ? "marco do documento" : opts.resumo || summarize(ops),
      manual: !!opts.manual,
      label: opts.label,
    };
    const id = await wrap(store.add(commit));
    await prune(doc);
    return id as number;
  } catch {
    return null;
  }
}

/** Commits do documento, do mais antigo para o mais novo. */
export async function listCommits(doc: string): Promise<Commit[]> {
  try {
    const db = await open();
    const all = await wrap(db.transaction(STORE).objectStore(STORE).index("doc").getAll(key(doc)));
    return (all as Commit[]).sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}

/** Texto do documento tal como estava num commit (reconstrói a partir da âncora). */
export async function textAtCommit(doc: string, id: number): Promise<string | null> {
  const lista = await listCommits(doc);
  const i = lista.findIndex((c) => c.id === id);
  if (i < 0) return null;

  // âncora mais próxima ANTES do commit (é o ponto de partida)
  let base = "";
  let j = i;
  while (j >= 0) {
    if (lista[j].text !== undefined) {
      base = lista[j].text!;
      break;
    }
    j--;
  }
  if (j < 0) {
    // sem âncora antes: usa a primeira depois (o log está incompleto)
    for (let k = i + 1; k < lista.length; k++) if (lista[k].text !== undefined) return lista[k].text!;
    return null;
  }
  let texto = base;
  for (let k = j + 1; k <= i; k++) texto = applyOps(texto, lista[k].ops);
  return texto;
}

/** Quantos commits o documento tem. */
export async function countCommits(doc: string): Promise<number> {
  try {
    const db = await open();
    return await wrap(db.transaction(STORE).objectStore(STORE).index("doc").count(key(doc)));
  } catch {
    return 0;
  }
}

/** Remove os commits antigos, preservando âncoras, marcados à mão e os mais recentes. */
async function prune(doc: string): Promise<void> {
  const lista = await listCommits(doc);
  if (lista.length <= MAX_COMMITS) return;
  let aApagar = lista.length - MAX_COMMITS;
  const db = await open();
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  for (const c of lista) {
    if (aApagar <= 0) break;
    if (c.manual || c.text !== undefined) continue; // âncoras e marcados ficam
    if (c.id !== undefined) store.delete(c.id);
    aApagar--;
  }
}

/** Apaga todos os commits de um documento. */
export async function clearCommits(doc: string): Promise<void> {
  for (const c of await listCommits(doc)) if (c.id !== undefined) await removeCommit(c.id);
}

export interface LogResumo {
  /** documentos com log guardado */
  docs: number;
  /** total de commits */
  commits: number;
  /** tamanho aproximado (patches e âncoras em UTF-16) */
  bytes: number;
}

/** Resumo do log de alterações inteiro (para o painel de Armazenamento). */
export async function resumoLog(): Promise<LogResumo> {
  try {
    const db = await open();
    const all = (await wrap(db.transaction(STORE).objectStore(STORE).getAll())) as Commit[];
    const docs = new Set<string>();
    let bytes = 0;
    for (const c of all) {
      docs.add(c.doc);
      for (const op of c.ops) bytes += ((op.prev?.length ?? 0) + (op.next?.length ?? 0)) * 2;
      bytes += (c.text?.length ?? 0) * 2;
    }
    return { docs: docs.size, commits: all.length, bytes };
  } catch {
    return { docs: 0, commits: 0, bytes: 0 };
  }
}

/** Apaga o log de alterações de TODOS os documentos. Devolve quantos commits saíram. */
export async function limparLogTudo(): Promise<number> {
  try {
    const db = await open();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    const total = await wrap<number>(store.count());
    await wrap(store.clear());
    return total;
  } catch {
    return 0;
  }
}

export async function removeCommit(id: number): Promise<void> {
  try {
    const db = await open();
    await wrap(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
  } catch {
    /* ignora */
  }
}

/** O arquivo mudou de caminho (renomear / salvar como): leva o log junto. */
export async function moveCommits(from: string, to: string): Promise<void> {
  if (key(from) === key(to)) return;
  try {
    const lista = await listCommits(from);
    if (!lista.length) return;
    const db = await open();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    for (const c of lista) store.put({ ...c, doc: key(to) });
  } catch {
    /* ignora */
  }
}

/**
 * Serializa o log inteiro para um arquivo (vai para a pasta de backup, junto da âncora).
 * É o que permite reconstruir o histórico depois de limpar os dados do app.
 */
export function exportCommits(commits: Commit[]): string {
  return JSON.stringify({ v: 1, exportado: Date.now(), commits });
}

/** Lê o log exportado do backup (mesmo formato de `exportCommits`). */
export function importCommits(json: string): Commit[] {
  try {
    const dados = JSON.parse(json) as { commits?: Commit[] };
    if (!Array.isArray(dados.commits)) return [];
    return dados.commits.filter((c) => c && typeof c.at === "number" && Array.isArray(c.ops));
  } catch {
    return [];
  }
}