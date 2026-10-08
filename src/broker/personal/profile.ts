// Perfil de escrita da pessoa: como ela escreve (tamanho das frases, vírgulas, como abre as frases, palavras preferidas).
// É aprendido dos documentos Markdown e Word, só neste computador, e usado na revisão ("seu estilo") e nas sugestões.
// Guarda números, não textos: cada documento vira uma amostra pequena que SUBSTITUI a anterior quando o documento muda.

const KEY = "mdc.profile";
const MAX_DOCS = 80;
const MIN_WORDS_FOR_RULES = 400; // com menos que isso o perfil ainda não é confiável

/** Faixas do tamanho de frase (em palavras): 0–4, 5–9, … 60+. */
const BIN = 5;
const BINS = 13;

export interface Sample {
  words: number;
  sentences: number;
  commas: number;
  chars: number;
  /** histograma do tamanho das frases */
  lens: number[];
  /** como as frases começam: primeira palavra → quantas vezes (só as 40 mais comuns) */
  openers: Record<string, number>;
  at: number;
}

const WORD = /[\p{L}][\p{L}'-]*/gu;

/** Lê um texto e resume o jeito de escrever. (Ignora código, tabelas e linhas de título.) */
export function analyzeText(text: string): Sample {
  const lens = new Array<number>(BINS).fill(0);
  const openers: Record<string, number> = {};
  let words = 0;
  let sentences = 0;
  let commas = 0;
  let chars = 0;
  let fence = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence || /^\s*(#|\||[-*_]{3,}\s*$|!\[|<)/.test(line)) continue;
    const prose = line.replace(/^\s*(?:[-*+>]\s+|\d+[.)]\s+)/, "").replace(/`[^`]*`|\[([^\]]*)\]\([^)]*\)/g, "$1");
    for (const sent of prose.split(/(?<=[.!?…])\s+/)) {
      const w = sent.match(WORD);
      if (!w || w.length < 3) continue;
      sentences++;
      words += w.length;
      chars += w.reduce((a, x) => a + x.length, 0);
      commas += (sent.match(/,/g) ?? []).length;
      lens[Math.min(BINS - 1, Math.floor(w.length / BIN))]++;
      const first = w[0].toLowerCase();
      openers[first] = (openers[first] ?? 0) + 1;
    }
  }
  const top = Object.entries(openers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);
  return { words, sentences, commas, chars, lens, openers: Object.fromEntries(top), at: Date.now() };
}

let docs: Record<string, Sample> = load();
let timer: number | undefined;
let cache: Summary | null = null;

function load(): Record<string, Sample> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Sample>) : {};
  } catch {
    return {};
  }
}

/** Aprende (ou atualiza) um documento. Chame junto com a memória das sugestões. */
export function learnDocument(id: string, text: string): void {
  if (text.length < 300) return;
  const s = analyzeText(text);
  if (s.words < 60) return;
  docs[id] = s;
  const ids = Object.keys(docs);
  if (ids.length > MAX_DOCS) {
    ids.sort((a, b) => docs[a].at - docs[b].at);
    for (const old of ids.slice(0, ids.length - MAX_DOCS)) delete docs[old];
  }
  cache = null;
  if (typeof window === "undefined") return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(docs));
    } catch {
      /* sem espaço: continua só em memória */
    }
  }, 2500);
}

export function forgetProfile(): void {
  docs = {};
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
}

export interface Summary {
  /** documentos analisados e palavras no total */
  docs: number;
  words: number;
  sentences: number;
  /** média de palavras por frase */
  avgSentence: number;
  /** tamanho de frase que 90% das frases da pessoa não passam */
  p90: number;
  /** vírgulas a cada 100 palavras */
  commasPer100: number;
  /** tamanho médio das palavras (letras) */
  avgWordLen: number;
  /** as palavras com que ela mais abre frases */
  openers: [string, number][];
  /** já há dados suficientes para a revisão usar o perfil */
  ready: boolean;
}

export function profileSummary(): Summary {
  if (cache) return cache;
  const all = Object.values(docs);
  let words = 0;
  let sentences = 0;
  let commas = 0;
  let chars = 0;
  const lens = new Array<number>(BINS).fill(0);
  const openers: Record<string, number> = {};
  for (const d of all) {
    words += d.words;
    sentences += d.sentences;
    commas += d.commas;
    chars += d.chars;
    d.lens.forEach((n, i) => (lens[i] += n));
    for (const [w, n] of Object.entries(d.openers)) openers[w] = (openers[w] ?? 0) + n;
  }
  let acc = 0;
  let p90 = 0;
  for (let i = 0; i < BINS; i++) {
    acc += lens[i];
    if (sentences && acc / sentences >= 0.9) {
      p90 = (i + 1) * BIN - 1;
      break;
    }
  }
  cache = {
    docs: all.length,
    words,
    sentences,
    avgSentence: sentences ? words / sentences : 0,
    p90: p90 || BINS * BIN,
    commasPer100: words ? (commas / words) * 100 : 0,
    avgWordLen: words ? chars / words : 0,
    openers: Object.entries(openers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6),
    ready: words >= MIN_WORDS_FOR_RULES && sentences >= 25,
  };
  return cache;
}
