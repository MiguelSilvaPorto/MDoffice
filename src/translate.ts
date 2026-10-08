// Núcleo da tradução PT-BR → inglês: entende a estrutura do Markdown, traduz só o texto
// (nunca código, links, imagens ou HTML) e guarda tudo num cache para ser rápido ao digitar.

// ---------- planejamento do Markdown ----------

export type Piece = { lit: string } | { seg: number };

interface PlanLine {
  parts: Piece[];
  /** Linha absorvida por um parágrafo mesclado (some na saída traduzida). */
  skip?: boolean;
  /** Original em português desta linha. */
  src: string;
  block: number;
}

export interface Plan {
  lines: PlanLine[];
  /** Texto (inline Markdown, em português) de cada trecho traduzível. */
  segs: string[];
}

const HAS_LETTER = /\p{L}/u;

/** Divide as células de uma linha de tabela (ignora `|` dentro de código ou escapado). */
function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let code = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && line[i + 1] === "|") {
      cur += "\\|";
      i++;
    } else if (c === "`") {
      let n = 1;
      while (line[i + n] === "`") n++;
      cur += "`".repeat(n);
      i += n - 1;
      code = code === n ? 0 : code === 0 ? n : code;
    } else if (c === "|" && !code) {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

const RX_FENCE = /^\s*(`{3,}|~{3,})/;
const RX_HTML_LINE = /^\s*(<\/?[a-zA-Z][^>]*>|<!--.*-->)\s*$/;
const RX_HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const RX_SETEXT = /^\s{0,3}(=+|-+)\s*$/;
const RX_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const RX_REFDEF = /^\s{0,3}\[[^\]]+\]:\s+\S+/;
const RX_QUOTE = /^(\s*(?:>\s?)+)/;
const RX_LIST = /^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/;
const RX_HEADING = /^(\s{0,3}#{1,6}\s+)/;

export function planMarkdown(markdown: string): Plan {
  const src = markdown.replace(/\r\n/g, "\n").split("\n");
  const plan: Plan = { lines: [], segs: [] };
  let block = 0;
  let inFence: { ch: string; len: number } | null = null;
  let inFront = false;
  let inTable = false;
  let afterList = false;
  let prevBlank = true;
  /** Parágrafo aberto que pode receber a próxima linha. */
  let open: { seg: number; pre: string } | null = null;

  const push = (parts: Piece[], line: string) => plan.lines.push({ parts, src: line, block });
  const addSeg = (text: string): number => plan.segs.push(text) - 1;

  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    const blank = line.trim() === "";
    const endPara = () => {
      open = null;
    };

    if (i === 0 && line.trim() === "---" && src.slice(1).some((l) => l.trim() === "---")) {
      inFront = true;
      push([{ lit: line }], line);
      continue;
    }
    if (inFront) {
      push([{ lit: line }], line);
      if (line.trim() === "---" || line.trim() === "...") inFront = false;
      continue;
    }

    const fence = RX_FENCE.exec(line);
    if (inFence) {
      push([{ lit: line }], line);
      if (fence && fence[1][0] === inFence.ch && fence[1].length >= inFence.len && line.trim() === fence[1]) inFence = null;
      continue;
    }
    if (fence) {
      if (prevBlank === false && !open) block++;
      endPara();
      inFence = { ch: fence[1][0], len: fence[1].length };
      push([{ lit: line }], line);
      continue;
    }

    if (blank) {
      endPara();
      inTable = false;
      afterList = false;
      block++;
      push([{ lit: line }], line);
      prevBlank = true;
      continue;
    }

    const wasBlank = prevBlank;
    prevBlank = false;

    // literais: HTML puro, linha divisória, referência, código indentado
    if (
      RX_HTML_LINE.test(line) ||
      RX_REFDEF.test(line) ||
      (RX_HR.test(line) && !open) ||
      (/^( {4}|\t)/.test(line) && wasBlank && !afterList)
    ) {
      endPara();
      push([{ lit: line }], line);
      continue;
    }
    if (RX_SETEXT.test(line) && open) {
      endPara();
      push([{ lit: line }], line);
      continue;
    }

    // tabelas: a linha seguinte é o separador (|---|---|) ou já estamos dentro de uma
    if (RX_TABLE_SEP.test(line) && line.includes("-") && (line.includes("|") || inTable)) {
      endPara();
      push([{ lit: line }], line);
      continue;
    }
    const next = src[i + 1] ?? "";
    if (line.includes("|") && (inTable || (RX_TABLE_SEP.test(next) && next.includes("|")))) {
      endPara();
      inTable = true;
      const cells = splitCells(line);
      const parts: Piece[] = [];
      cells.forEach((cell, k) => {
        if (k) parts.push({ lit: "|" });
        const t = cell.trim();
        if (!t || !HAS_LETTER.test(t)) {
          parts.push({ lit: cell });
          return;
        }
        const lead = cell.slice(0, cell.length - cell.trimStart().length);
        const trail = cell.slice(cell.trimEnd().length);
        parts.push({ lit: lead }, { seg: addSeg(t) }, { lit: trail });
      });
      push(parts, line);
      continue;
    }
    inTable = false;

    // prefixos: citação, lista, título
    let rest = line;
    let prefix = "";
    const quote = RX_QUOTE.exec(rest);
    if (quote) {
      prefix += quote[1];
      rest = rest.slice(quote[1].length);
    }
    const list = RX_LIST.exec(rest);
    const heading = !list ? RX_HEADING.exec(rest) : null;
    const marker = list ?? heading;
    if (marker) {
      prefix += marker[1];
      rest = rest.slice(marker[1].length);
    }
    const text = rest.trim();
    if (!text || !HAS_LETTER.test(text)) {
      endPara();
      afterList = !!list || (afterList && !!quote);
      push([{ lit: line }], line);
      continue;
    }

    const plain = !marker;
    // continuação do parágrafo anterior (linhas soltas viram uma frase só: melhor contexto)
    if (plain && open && open.pre === prefix) {
      plan.segs[open.seg] += " " + text;
      plan.lines.push({ parts: [], skip: true, src: line, block });
      if (/( {2,}|\\)$/.test(line)) endPara();
      continue;
    }
    afterList = !!list || (afterList && plain && /^\s+/.test(line));
    const seg = addSeg(text);
    const trail = rest.slice(rest.trimEnd().length);
    push([{ lit: prefix }, { seg }, { lit: heading ? "" : trail }], line);
    open = plain && !/( {2,}|\\)$/.test(line) ? { seg, pre: prefix } : null;
  }
  return plan;
}

/** Monta o Markdown final trocando cada trecho pela tradução (ou pelo original). */
export function renderPlan(plan: Plan, pick: (seg: number) => string): string {
  return plan.lines
    .filter((l) => !l.skip)
    .map((l) => l.parts.map((p) => ("lit" in p ? p.lit : pick(p.seg))).join(""))
    .join("\n");
}

/** Blocos (parágrafos, listas, tabelas…) em PT e EN, alinhados — base do modo bilíngue. */
export function planBlocks(plan: Plan, pick: (seg: number) => string): { pt: string; en: string }[] {
  const out = new Map<number, { pt: string[]; en: string[] }>();
  for (const l of plan.lines) {
    const entry = out.get(l.block) ?? { pt: [], en: [] };
    entry.pt.push(l.src);
    if (!l.skip) entry.en.push(l.parts.map((p) => ("lit" in p ? p.lit : pick(p.seg))).join(""));
    out.set(l.block, entry);
  }
  return [...out.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({ pt: v.pt.join("\n").trim(), en: v.en.join("\n").trim() }))
    .filter((b) => b.pt || b.en);
}

// ---------- proteção de trechos que não se traduzem ----------

export interface GlossaryEntry {
  /** Termo em português como aparece no texto. */
  pt: string;
  /** Tradução fixa; vazio = manter igual (não traduzir). */
  en: string;
}

interface Atom {
  text: string;
  kind: "atom" | "open" | "close";
  /** Havia espaço antes/depois do trecho no texto original? */
  sb: boolean;
  sa: boolean;
}

export interface Masked {
  masked: string;
  atoms: Atom[];
}

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Troca código, URLs e HTML por códigos curtos (ZQ0Z, ZQ1Z…).
 * No modo leve (padrão), negrito/itálico e o texto dos links seguem no texto — os tradutores
 * respeitam bem esses marcadores. No modo estrito, até os marcadores viram códigos.
 */
export function maskInline(text: string, glossary: GlossaryEntry[] = [], nested = false, strict = false): Masked {
  const atoms: Atom[] = [];
  let out = "";
  const emp: Record<string, boolean> = {};
  const gl = glossary.filter((g) => g.pt.trim()).sort((a, b) => b.pt.length - a.pt.length);
  const glRx = gl.length
    ? new RegExp(`^(?:${gl.map((g) => escapeRx(g.pt.trim())).join("|")})(?![\\p{L}\\p{N}_])`, "iu")
    : null;
  const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

  const put = (t: string, kind: Atom["kind"] = "atom", at = i, len = t.length, bare = false) => {
    const before = at === 0 ? !nested : /\s/.test(text[at - 1]);
    const afterCh = text[at + len];
    const after = afterCh === undefined ? !nested : /\s/.test(afterCh);
    atoms.push({ text: t, kind, sb: before, sa: after });
    out += bare ? `ZQ${atoms.length - 1}Z` : ` ZQ${atoms.length - 1}Z `;
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^(`+)(?:(?!\1)[\s\S])*?\1/.exec(rest))) {
      put(m[0]);
      i += m[0].length;
    } else if ((m = /^!\[[^\]]*\]\([^)]*\)/.exec(rest))) {
      put(m[0]);
      i += m[0].length;
    } else if (!strict && (m = /^\[([^\]]+)\]\(([^)]*)\)/.exec(rest))) {
      const inner = maskInline(m[1], glossary, true, false);
      const base = atoms.length;
      for (const a of inner.atoms) atoms.push(a);
      out += "[" + inner.masked.replace(/ZQ(\d+)Z/g, (_, n) => `ZQ${base + Number(n)}Z`) + "](";
      put(m[2], "atom", i + 3 + m[1].length, m[2].length, true);
      out += ")";
      i += m[0].length;
    } else if ((m = /^\[([^\]]+)\]\(([^)]*)\)/.exec(rest))) {
      put("[", "open", i, 1);
      const inner = maskInline(m[1], glossary, true);
      const base = atoms.length;
      for (const a of inner.atoms) atoms.push(a);
      out += " " + inner.masked.replace(/ZQ(\d+)Z/g, (_, n) => `ZQ${base + Number(n)}Z`) + " ";
      put(`](${m[2]})`, "close", i + 1 + m[1].length, m[2].length + 3);
      i += m[0].length;
    } else if ((m = /^<\/?[a-zA-Z][^>]*>/.exec(rest))) {
      put(m[0]);
      i += m[0].length;
    } else if ((m = /^(?:https?:\/\/|www\.)[^\s)>\]]+/.exec(rest))) {
      put(m[0]);
      i += m[0].length;
    } else if (strict && ((m = /^(\*\*|__|~~|\*)/.exec(rest)) || (rest[0] === "_" && (m = /^_/.exec(rest)) && !(isWord(text[i - 1]) && isWord(text[i + 1]))))) {
      const key = m![0];
      const opening = !emp[key];
      emp[key] = opening;
      put(key, opening ? "open" : "close");
      i += key.length;
    } else if (glRx && !isWord(text[i - 1]) && (m = glRx.exec(rest))) {
      const hit = gl.find((g) => g.pt.trim().toLowerCase() === m![0].toLowerCase());
      put(hit && hit.en.trim() ? hit.en.trim() : m[0]);
      i += m[0].length;
    } else {
      out += text[i];
      i++;
    }
  }
  return { masked: out.replace(/ {2,}/g, " ").trim(), atoms };
}

/** Devolve os trechos protegidos. `null` se algum código se perdeu na tradução. */
export function unmaskInline(translated: string, atoms: Atom[]): string | null {
  const rx = /\s*ZQ\s*(\d+)\s*Z\s*/gi;
  const chunks: string[] = [];
  const ids: number[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(translated))) {
    chunks.push(translated.slice(last, m.index));
    ids.push(Number(m[1]));
    last = m.index + m[0].length;
  }
  chunks.push(translated.slice(last));
  if (ids.length !== atoms.length || new Set(ids).size !== atoms.length || ids.some((n) => !atoms[n])) return null;

  let out = chunks[0];
  ids.forEach((id, k) => {
    const a = atoms[id];
    const next = chunks[k + 1];
    out = out.replace(/\s+$/, "");
    if (a.sb && out) out += " ";
    out += a.text;
    if (a.sa && next && !/^[.,;:!?)\]]/.test(next.trimStart())) out += " ";
    out += next.replace(/^\s+/, "");
  });
  return out.replace(/ {2,}/g, " ").trim();
}

// ---------- melhora do inglês depois de traduzir ----------

export function polishEnglish(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:!?])(?=[A-Za-z])/g, "$1 ")
    .replace(/^([a-z])/, (c) => c.toUpperCase())
    .replace(/([.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    .trim();
}

// ---------- provedores ----------

export interface Provider {
  id: string;
  label: string;
  /** Traduz vários textos (já protegidos). Devolve na mesma ordem. */
  translate(texts: string[], signal: AbortSignal): Promise<string[]>;
}

export class QuotaError extends Error {
  constructor(msg = "O limite gratuito do tradutor online acabou por hoje.") {
    super(msg);
    this.name = "QuotaError";
  }
}

export class OfflineError extends Error {}

/** Quebra um texto em pedaços de até `max` caracteres, respeitando o fim das frases. */
export function chunkText(text: string, max = 420): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      out.push(cur.trim());
      cur = "";
    }
    if (s.length > max) {
      for (let k = 0; k < s.length; k += max) out.push(s.slice(k, k + max).trim());
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

/** MyMemory: gratuito, sem chave (com e-mail o limite diário sobe de 5 mil para 50 mil letras). */
export function myMemoryProvider(getEmail: () => string): Provider {
  const one = async (q: string, signal: AbortSignal): Promise<string> => {
    const params = new URLSearchParams({ q, langpair: "pt-BR|en-GB" });
    const email = getEmail().trim();
    if (email) params.set("de", email);
    let res: Response;
    try {
      res = await fetch(`https://api.mymemory.translated.net/get?${params}`, { signal });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new Error("Sem conexão com o tradutor online. Confira a internet ou use o modo offline.");
    }
    if (res.status === 429) throw new QuotaError();
    const data = (await res.json()) as { responseData?: { translatedText?: string }; quotaFinished?: boolean; responseStatus?: number | string };
    const text = data.responseData?.translatedText ?? "";
    if (data.quotaFinished || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(text)) throw new QuotaError();
    if (!text) throw new Error("O tradutor online não devolveu nada para este trecho.");
    return text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  };
  return {
    id: "online",
    label: "Online (MyMemory)",
    async translate(texts, signal) {
      const out: string[] = new Array(texts.length);
      let next = 0;
      const worker = async () => {
        while (next < texts.length) {
          const idx = next++;
          const parts = chunkText(texts[idx]);
          const done: string[] = [];
          for (const p of parts) done.push(await one(p, signal));
          out[idx] = done.join(" ");
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      return out;
    },
  };
}

// ---------- cache ----------

const CACHE_KEY = "mdc.tr-cache.v1";
const CACHE_MAX = 3000;

export class TranslationCache {
  private map = new Map<string, string>();
  private saveTimer: number | undefined;

  constructor() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) for (const [k, v] of JSON.parse(raw) as [string, string][]) this.map.set(k, v);
    } catch {
      /* cache vazio */
    }
  }

  get(key: string): string | undefined {
    return this.map.get(key);
  }

  set(key: string, value: string): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > CACHE_MAX) this.map.delete(this.map.keys().next().value as string);
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify([...this.map.entries()]));
      } catch {
        /* sem espaço: segue só em memória */
      }
    }, 1500);
  }

  clear(): void {
    this.map.clear();
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignora */
    }
  }
}

// ---------- offline (modelo local) ----------

export interface OfflineStatus {
  state: "idle" | "loading" | "ready" | "error";
  /** 0–100 enquanto baixa o modelo. */
  progress: number;
  message: string;
}

const OFFLINE_KEY = "mdc.tr-offline-ready";

export class OfflineEngine {
  private worker: Worker | null = null;
  private nextId = 1;
  private waiting = new Map<number, { ok: (v: string[]) => void; fail: (e: Error) => void }>();
  private files = new Map<string, number>();
  status: OfflineStatus = { state: "idle", progress: 0, message: "" };
  onStatus: ((s: OfflineStatus) => void) | null = null;

  /** O modelo já foi baixado neste computador alguma vez? */
  get downloaded(): boolean {
    try {
      return localStorage.getItem(OFFLINE_KEY) === "1";
    } catch {
      return false;
    }
  }

  private set(s: Partial<OfflineStatus>): void {
    this.status = { ...this.status, ...s };
    this.onStatus?.(this.status);
  }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL("./translate.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; id?: number; out?: string[]; message?: string; p?: { status?: string; file?: string; progress?: number } };
      if (m.type === "progress" && m.p) {
        if (this.status.state === "error") return;
        if (m.p.status === "progress" && m.p.file) {
          this.files.set(m.p.file, m.p.progress ?? 0);
          const vals = [...this.files.values()];
          const pct = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
          this.set({ state: "loading", progress: Math.round(pct), message: `Baixando o modelo de tradução… ${Math.round(pct)}%` });
        } else if (m.p.status === "ready" || m.p.status === "done") {
          this.set({ state: "loading", message: "Preparando o modelo…" });
        }
      } else if (m.type === "ready") {
        try {
          localStorage.setItem(OFFLINE_KEY, "1");
        } catch {
          /* ignora */
        }
        this.set({ state: "ready", progress: 100, message: "Modelo offline pronto." });
      } else if (m.type === "result" && m.id !== undefined) {
        this.waiting.get(m.id)?.ok(m.out ?? []);
        this.waiting.delete(m.id);
      } else if (m.type === "error") {
        const err = new Error(m.message ?? "Falha no tradutor offline.");
        this.set({ state: "error", message: `Tradutor offline falhou: ${m.message ?? ""}` });
        if (m.id !== undefined) {
          this.waiting.get(m.id)?.fail(err);
          this.waiting.delete(m.id);
        } else for (const w of this.waiting.values()) w.fail(err);
      }
    };
    w.onerror = (ev) => {
      this.set({ state: "error", message: `Tradutor offline falhou: ${ev.message}` });
    };
    this.worker = w;
    return w;
  }

  /** Começa a baixar/carregar o modelo (pode demorar na primeira vez). */
  warmUp(): void {
    if (this.status.state === "loading" || this.status.state === "ready") return;
    this.set({ state: "loading", progress: 0, message: "Preparando o tradutor offline…" });
    this.ensure().postMessage({ type: "load" });
  }

  provider(): Provider {
    return {
      id: "offline",
      label: "Offline (no seu PC)",
      translate: (texts, signal) => {
        if (this.status.state !== "ready") this.warmUp();
        const id = this.nextId++;
        return new Promise<string[]>((ok, fail) => {
          this.waiting.set(id, { ok, fail });
          signal.addEventListener("abort", () => {
            this.waiting.delete(id);
            fail(new DOMException("cancelado", "AbortError"));
          });
          this.ensure().postMessage({ type: "translate", id, texts });
        });
      },
    };
  }
}
