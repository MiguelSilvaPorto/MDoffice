// Histórico de versões: cópias do documento guardadas no próprio app (IndexedDB), por arquivo.
// Entram sozinhas de tempos em tempos quando o texto mudou, ou na hora com "Salvar versão".

export interface Version {
  id?: number;
  doc: string;
  at: number;
  text: string;
  /** Nome dado pelo usuário (versão marcada) ou motivo (ex.: "Antes de restaurar"). */
  label?: string;
  manual: boolean;
}

const DB_NAME = "mdc-history";
const STORE = "versions";
const AUTO_EVERY_MS = 5 * 60 * 1000;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((ok, fail) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("doc", "doc");
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

/** Versões do documento, da mais nova para a mais antiga. */
export async function listVersions(doc: string): Promise<Version[]> {
  try {
    const db = await open();
    const all = await wrap(db.transaction(STORE).objectStore(STORE).index("doc").getAll(key(doc)));
    return (all as Version[]).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export interface SnapOptions {
  manual?: boolean;
  label?: string;
  /** Quantas versões guardar por documento (as marcadas à mão têm prioridade). */
  max?: number;
  /** Ignora o intervalo mínimo entre versões automáticas. */
  force?: boolean;
}

/** Guarda uma versão se o texto mudou. Devolve true se gravou. */
export async function snapshot(doc: string, text: string, opts: SnapOptions = {}): Promise<boolean> {
  if (!doc || !text.trim()) return false;
  try {
    const list = await listVersions(doc);
    const last = list[0];
    if (last && last.text === text) {
      // mesma versão: só promove a marcada à mão
      if (opts.manual && !last.manual) {
        const db = await open();
        await wrap(db.transaction(STORE, "readwrite").objectStore(STORE).put({ ...last, manual: true, label: opts.label ?? last.label }));
      }
      return false;
    }
    if (!opts.manual && !opts.force && last && Date.now() - last.at < AUTO_EVERY_MS) return false;
    const db = await open();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    await wrap(store.add({ doc: key(doc), at: Date.now(), text, manual: !!opts.manual, label: opts.label } satisfies Version));
    await prune(doc, opts.max ?? 60);
    return true;
  } catch {
    return false;
  }
}

async function prune(doc: string, max: number): Promise<void> {
  const list = await listVersions(doc);
  if (list.length <= max) return;
  const db = await open();
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  // remove as mais antigas que NÃO foram marcadas à mão
  let extra = list.length - max;
  for (const v of [...list].reverse()) {
    if (extra <= 0) break;
    if (v.manual) continue;
    store.delete(v.id!);
    extra--;
  }
}

export async function removeVersion(id: number): Promise<void> {
  try {
    const db = await open();
    await wrap(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
  } catch {
    /* ignora */
  }
}

export async function clearHistory(doc: string): Promise<void> {
  for (const v of await listVersions(doc)) if (v.id !== undefined) await removeVersion(v.id);
}

export interface VersoesResumo {
  /** documentos com versões guardadas */
  docs: number;
  /** total de versões */
  versoes: number;
  /** tamanho aproximado (o texto é guardado como UTF-16) */
  bytes: number;
}

/** Resumo do histórico inteiro (para o painel de Armazenamento). */
export async function resumoVersoes(): Promise<VersoesResumo> {
  try {
    const db = await open();
    const all = (await wrap(db.transaction(STORE).objectStore(STORE).getAll())) as Version[];
    const docs = new Set<string>();
    let bytes = 0;
    for (const v of all) {
      docs.add(v.doc);
      bytes += (v.text?.length ?? 0) * 2;
    }
    return { docs: docs.size, versoes: all.length, bytes };
  } catch {
    return { docs: 0, versoes: 0, bytes: 0 };
  }
}

/** Apaga as versões de TODOS os documentos. Devolve quantas foram apagadas. */
export async function limparVersoesTudo(): Promise<number> {
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

/** O arquivo mudou de caminho (renomear / salvar como): leva o histórico junto. */
export async function moveHistory(from: string, to: string): Promise<void> {
  if (key(from) === key(to)) return;
  try {
    const list = await listVersions(from);
    if (!list.length) return;
    const db = await open();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    for (const v of list) store.put({ ...v, doc: key(to) });
  } catch {
    /* ignora */
  }
}

// ---------- diferença entre versões ----------

export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

/** Diferença por linhas (LCS): "del" = só na versão antiga, "add" = só na nova. */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  // corta o começo/fim iguais para a tabela ficar pequena
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const ma = a.slice(head, a.length - tail);
  const mb = b.slice(head, b.length - tail);
  const out: DiffLine[] = a.slice(0, head).map((text) => ({ kind: "same", text }));

  if (ma.length * mb.length > 4_000_000) {
    // documentos enormes: sem LCS, mostra bloco removido + bloco novo
    ma.forEach((text) => out.push({ kind: "del", text }));
    mb.forEach((text) => out.push({ kind: "add", text }));
  } else {
    const w = mb.length + 1;
    const t = new Uint32Array((ma.length + 1) * w);
    for (let i = ma.length - 1; i >= 0; i--) {
      for (let j = mb.length - 1; j >= 0; j--) {
        t[i * w + j] = ma[i] === mb[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < ma.length && j < mb.length) {
      if (ma[i] === mb[j]) {
        out.push({ kind: "same", text: ma[i] });
        i++;
        j++;
      } else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) out.push({ kind: "del", text: ma[i++] });
      else out.push({ kind: "add", text: mb[j++] });
    }
    while (i < ma.length) out.push({ kind: "del", text: ma[i++] });
    while (j < mb.length) out.push({ kind: "add", text: mb[j++] });
  }
  a.slice(a.length - tail).forEach((text) => out.push({ kind: "same", text }));
  return out;
}

// ---------- diferença lado a lado (duas colunas) ----------

/** Uma linha do diff lado a lado: `esq` = o que estava (antes), `dir` = o que ficou (depois). */
export interface LinhaDiff {
  esq: DiffLine | null;
  dir: DiffLine | null;
  kind: "same" | "mudanca" | "pulo";
}

/**
 * As linhas do diff em DUAS colunas (antes × depois): o que mudou é **pareado linha a linha**
 * (esquerda × direita, como nas ferramentas de diff), o contexto sai igual nos dois lados e o
 * trecho omitido vira um "pulo" (uma linha só para os dois). Devolve `[]` quando nada mudou —
 * o chamador põe a mensagem de "igual".
 */
export function linhasLadoALado(oldText: string, newText: string, contexto = 2): LinhaDiff[] {
  const lines = diffLines(oldText, newText);
  if (!lines.some((l) => l.kind !== "same")) return [];
  // mostra só o que mudou, com um pouco de contexto
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (l.kind !== "same") for (let k = Math.max(0, i - contexto); k <= Math.min(lines.length - 1, i + contexto); k++) keep.add(k);
  });
  const out: LinhaDiff[] = [];
  let i = 0;
  let gap = false;
  while (i < lines.length) {
    if (!keep.has(i)) {
      if (!gap) out.push({ esq: null, dir: null, kind: "pulo" });
      gap = true;
      i++;
      continue;
    }
    gap = false;
    if (lines[i].kind === "same") {
      out.push({ esq: lines[i], dir: lines[i], kind: "same" });
      i++;
      continue;
    }
    // bloco de mudança: junta os "del" e os "add" vizinhos e pareia um a um (o maior manda no número de linhas)
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].kind !== "same") {
      (lines[i].kind === "del" ? dels : adds).push(lines[i]);
      i++;
    }
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) out.push({ esq: dels[k] ?? null, dir: adds[k] ?? null, kind: "mudanca" });
  }
  return out;
}

// ---------- o nome de uma alteração ----------

/** As seções "## Lâmina N" de uma apresentação projetada (vazio quando o texto não é uma). */
function secoesDeApresentacao(proj: string): string[] {
  return proj.split(/(?=^## Lâmina \d+)/m).filter((s) => /^## Lâmina \d+/.test(s));
}

/** "1 linha alterada" / "N linhas alteradas" — o nome nos documentos de texto. */
function nomeDeLinhas(antes: string, depois: string): string {
  const n = linhasLadoALado(antes, depois).filter((r) => r.kind === "mudanca").length;
  if (n === 0) return "Alteração sem mudança de texto";
  return n === 1 ? "1 linha alterada" : `${n} linhas alteradas`;
}

/**
 * O nome de uma alteração, em palavras (a lista de Alterações não mostra mais "+X −Y").
 *
 * Nas apresentações diz **qual lâmina** mudou — ou que a mudança foi **visual** (sem mexer no
 * texto: cores, formas, posição), o que é o caso de aplicar um modelo ou uma variante. Nos
 * documentos de texto, quantas linhas mudaram. `antes`/`depois` são os textos LEGÍVEIS (a
 * projeção de cada motor), nunca a serialização.
 */
export function nomeDaAlteracao(tipo: string, antes: string, depois: string): string {
  if (tipo === "ppt") {
    const a = secoesDeApresentacao(antes);
    const b = secoesDeApresentacao(depois);
    if (a.length || b.length) {
      if (b.length > a.length) {
        const n = b.length - a.length;
        return n === 1 ? "Nova lâmina" : `${n} lâminas novas`;
      }
      if (b.length < a.length) {
        const n = a.length - b.length;
        return n === 1 ? "Lâmina excluída" : `${n} lâminas excluídas`;
      }
      const mudadas = a.map((s, i) => (s === b[i] ? 0 : i + 1)).filter((i) => i > 0);
      if (!mudadas.length) return "Alteração visual (sem mudança de texto)";
      if (mudadas.length === 1) return `Lâmina ${mudadas[0]} alterada`;
      if (mudadas.length <= 3) return `Lâminas ${mudadas.slice(0, -1).join(", ")} e ${mudadas[mudadas.length - 1]} alteradas`;
      return `${mudadas.length} lâminas alteradas`;
    }
  }
  return nomeDeLinhas(antes, depois);
}
