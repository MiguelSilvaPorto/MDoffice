// Modelo de idioma do português (contagens de palavras e de sequências de 2–3 palavras), 100% local.
// Gerado por scripts/build-ngrams.mjs a partir de textos formais e guardado em public/ngrams/pt.json.
// Aqui só se LÊ o modelo: carrega o arquivo e responde "quais palavras costumam vir depois destas?".

/** Formato do arquivo (veja scripts/build-ngrams.mjs). */
export interface LangModelData {
  v: 1;
  /** Vocabulário: 0 = início de frase, 1 = vírgula, 2 = número; depois as palavras, da mais comum para a menos. */
  w: string[];
  /** Contagem de cada palavra. */
  n: number[];
  /** Ids de palavras que quase sempre levam inicial maiúscula (nomes próprios). */
  c: number[];
  /** Bigramas: id → [próxima, contagem, próxima, contagem, ...]. */
  b: Record<string, number[]>;
  /** Total de ocorrências de cada contexto de bigrama. */
  bt: Record<string, number>;
  /** Trigramas: "id1 id2" → [próxima, contagem, ...]. */
  t: Record<string, number[]>;
  /** Total de ocorrências de cada contexto de trigrama. */
  tt: Record<string, number>;
}

export const START = 0;
export const COMMA = 1;
export const NUMBER = 2;

export interface Succ {
  id: number;
  count: number;
}

export class LangModel {
  readonly words: string[];
  readonly idOf = new Map<string, number>();
  readonly caps: Set<number>;
  readonly total: number;
  /** Ids ordenados por ordem alfabética (para achar palavras pelo começo). */
  private readonly alpha: number[];

  constructor(readonly data: LangModelData) {
    this.words = data.w;
    data.w.forEach((w, i) => this.idOf.set(w, i));
    this.caps = new Set(data.c);
    let t = 0;
    for (let i = 3; i < data.n.length; i++) t += data.n[i];
    this.total = t || 1;
    this.alpha = Array.from({ length: data.w.length - 3 }, (_, i) => i + 3).sort((a, b) => (data.w[a] < data.w[b] ? -1 : data.w[a] > data.w[b] ? 1 : 0));
  }

  /** Probabilidade da palavra sozinha (sem contexto). */
  uniProb(id: number): number {
    return (this.data.n[id] ?? 0) / this.total;
  }

  private pairs(list: number[] | undefined): Succ[] {
    if (!list) return [];
    const out: Succ[] = [];
    for (let i = 0; i < list.length; i += 2) out.push({ id: list[i], count: list[i + 1] });
    return out;
  }

  /** Palavras que costumam vir depois de `a`, com a contagem. */
  bigram(a: number): { succ: Succ[]; total: number } {
    return { succ: this.pairs(this.data.b[a]), total: this.data.bt[a] ?? 0 };
  }

  /** Palavras que costumam vir depois de `a b`, com a contagem. */
  trigram(a: number, b: number): { succ: Succ[]; total: number } {
    const k = a + " " + b;
    return { succ: this.pairs(this.data.t[k]), total: this.data.tt[k] ?? 0 };
  }

  /** As palavras mais comuns que começam com `prefix` (em minúsculas). */
  withPrefix(prefix: string, limit = 60): number[] {
    const w = this.words;
    let lo = 0;
    let hi = this.alpha.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (w[this.alpha[mid]] < prefix) lo = mid + 1;
      else hi = mid;
    }
    const found: number[] = [];
    for (let i = lo; i < this.alpha.length && w[this.alpha[i]].startsWith(prefix); i++) found.push(this.alpha[i]);
    found.sort((x, y) => this.data.n[y] - this.data.n[x]);
    return found.slice(0, limit);
  }

  /** Escreve a palavra como deve aparecer (nomes próprios com inicial maiúscula). */
  display(id: number): string {
    const s = this.words[id];
    return this.caps.has(id) ? s[0].toUpperCase() + s.slice(1) : s;
  }
}

let current: LangModel | null = null;
let loading: Promise<void> | null = null;
const listeners: (() => void)[] = [];

export function getLanguageModel(): LangModel | null {
  return current;
}

export function setLanguageModel(data: LangModelData | null): void {
  current = data ? new LangModel(data) : null;
  for (const l of listeners.splice(0)) l();
}

/** Avisa quando o modelo terminar de carregar (para refazer a sugestão que ficou sem modelo). */
export function onLanguageModelReady(fn: () => void): void {
  if (current) fn();
  else listeners.push(fn);
}

/** Carrega o modelo do app (uma vez). Sem o arquivo, a sugestão continua com a base pequena embutida. */
export function loadLanguageModel(url = "/ngrams/pt.json"): Promise<void> {
  if (current) return Promise.resolve();
  loading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: LangModelData) => setLanguageModel(d))
    .catch((e) => {
      console.warn("Modelo de idioma da sugestão indisponível:", e);
      loading = null;
    });
  return loading;
}
