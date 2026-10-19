// Previsão: olha o que vem antes do cursor e devolve a continuação mais provável, se houver confiança.
// Junta duas fontes: o modelo do idioma (model.ts) e o que a própria pessoa escreve no documento (documentIndex.ts).
// Sem o modelo carregado, cai no plano B (legacy.ts).

import { type Text } from "@codemirror/state";
import { type GhostSuggestion } from "./types";
import { DocumentIndex, SENTENCE_START } from "./documentIndex";
import { getLanguageModel, type LangModel, START, COMMA, NUMBER } from "./model";
import { predictLegacy } from "./legacy";
import { personalIndex } from "./memory";
import { preference, getGhostMode, minSuffixDelta, thresholdScale } from "../personal/feedback";
import { agreementFactor } from "./agreement";
import { fixTypo } from "./typo";

/**
 * Confiança mínima (0–1) para mostrar a sugestão. Ajustada medindo acertos em textos de teste
 * (veja eval-ghost). Com o modelo de idioma, a base antiga (prefix1 0,82 …) mostrava MUITA
 * sugestão errada: 49% de acerto em scripts/corpus-wikipedia.txt (o relato "a sugestão aparece
 * errada"). Esta base (medida no mesmo texto, sem aprender) sobe para ~74% de acerto com a
 * economia de teclas ainda em ~9% — mostra menos e mostra certo.
 */
/** Quanto o documento pesa na mistura com o modelo do idioma. */
export const MIX = { kNext: 4, kPrefix: 3, maxLambda: 0.8, personal: 0.5, /** peso de algo que apareceu só 1 vez (pode ser acaso) */ single: 0.5 };
/** Quanto vale uma contagem do documento: o 1 vale menos (pode ser acaso) e passar de 5 não aumenta (evita repetição em ciclo). */
const seen = (c: number): number => (c >= 2 ? Math.min(c, 5) : c * MIX.single);

export const THRESHOLDS = {
  /** próxima palavra, depois de um espaço */
  next: 0.45,
  /** continuar a sugestão com mais uma palavra (até 3 no total) */
  chain: 0.75,
  /** completar a palavra com 1 letra digitada / 2 / 3 ou mais */
  prefix1: 0.97,
  prefix2: 0.8,
  prefix3: 0.6,
  /** completar a palavra só vale a pena se faltar pelo menos isto de letras (o Tab também custa uma tecla) */
  minSuffix: 4,
  /** quantas palavras no máximo numa sugestão */
  maxWords: 3,
  /** oferece corrigir a palavra recém-digitada quando parece erro de digitação */
  typoFix: true,
  /** usa a regra de concordância de gênero e número */
  agreement: true,
  /** quantas opções oferecer (a primeira aparece; as outras trocam com Alt+Seta para baixo) */
  alternatives: 3,
  /** confiança mínima para uma alternativa */
  alt: 0.06,
};

/** Quantas letras, no mínimo, a sugestão de completar palavra precisa poupar (depende do modo de intensidade). */
const minChars = (): number => Math.max(1, THRESHOLDS.minSuffix + minSuffixDelta());

/**
 * Limiar já escalado pelo modo (discreto aperta, agressivo solta), com TETO em 0,98. É o critério da
 * PRÓXIMA palavra: ali a calibração não se sustenta (a taxa-base é baixa e o texto de ajuste não
 * cobre o assunto do documento), então fica a regra que já era medida no `eval-ghost`.
 */
const limiar = (t: number, mode: "next" | "prefix"): number => Math.min(0.98, t * thresholdScale(mode));

// ---------------------------------------------------------------- decisão calibrada

/**
 * A decisão de mostrar (e de continuar) uma sugestão é pelo **ganho esperado**:
 *
 *     P(acertar | evidências) × teclas poupadas ≥ custo de uma sugestão errada
 *
 * `P(acertar)` sai de uma regressão logística ajustada em `scripts/calibrar-ghost.mts` (no mesmo
 * tipo de texto do `eval-ghost`), em vez dos limiares fixos de antes — eles comparavam a
 * probabilidade NORMALIZADA entre as candidatas (0,45 / 0,6 / 0,8…), que não é a chance de
 * acertar: mexer neles sempre trocava precisão por cobertura (o relato "toda vez que arrumo fica
 * pior"). O custo do erro é a "intensidade" das Configurações.
 */
export const CALIB = {
  /** pesos de [1, logit(p), prefixo?, letras/4, pSelf−p, começo?, documento, nomePróprio] */
  w: [-1.8779, 0.3267, -0.299, 1.2468, -1.3148, -0.3969, 1.5371, -2.7874] as number[],
  /** custo (em teclas) de mostrar uma sugestão errada, por intensidade (medido no calibrar-ghost) */
  custo: { discreto: 2.2, equilibrado: 1.4, agressivo: 1.2 } as Record<string, number>,
  /**
   * Piso de P(acertar): o ganho cresce com o tamanho da sugestão, mas o incômodo de uma sugestão
   * errada não — sem o piso, uma candidata longa e improvável passaria só por "render mais".
   */
  pMin: { discreto: 0.5, equilibrado: 0.38, agressivo: 0.3 } as Record<string, number>,};

/** logit com corte para não estourar em p = 0/1. */
const logit = (p: number): number => {
  const q = Math.max(1e-4, Math.min(1 - 1e-4, p));
  return Math.log(q / (1 - q));
};

/** As evidências do ponto, na ordem de `CALIB.w`. (O comprimento NÃO entra: ele é o ganho, não a chance.) */
function evidencias(p: number, pSelf: number, prefixLen: number, lambda: number, sentenceStart: boolean, capsMismatch: boolean): number[] {
  return [1, logit(p), prefixLen > 0 ? 1 : 0, Math.min(1, prefixLen / 4), Math.max(0, pSelf - p), sentenceStart ? 1 : 0, lambda, capsMismatch ? 1 : 0];
}

/** P(acertar | evidências), calibrada. */
export function probAcerto(x: readonly number[]): number {
  let z = 0;
  for (let i = 0; i < x.length && i < CALIB.w.length; i++) z += CALIB.w[i] * x[i];
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

/** O custo (em teclas) de uma sugestão errada, no modo escolhido. */
export function custoDoModo(): number {
  return CALIB.custo[getGhostMode()] ?? 1;
}

/** O piso de P(acertar), no modo escolhido. */
export function pisoDoModo(): number {
  return CALIB.pMin[getGhostMode()] ?? 0.35;
}

/** O ganho esperado de mostrar a sugestão: teclas poupadas × chance de acertar. */
export function ganhoEsperado(x: readonly number[], keys: number): number {
  return probAcerto(x) * keys;
}

/** O ajuste do aprendizado do uso na decisão, num intervalo curto (não derruba a sugestão). */
function fatorPreferencia(prev: string, lc: string): number {
  return Math.max(0.75, Math.min(1.25, preference(prev, lc)));
}

/** A decisão sobre um P já com o ajuste do aprendizado: passa do piso e o ganho paga o custo? */
export function decidir(p: number, keys: number): boolean {
  return p >= pisoDoModo() && p * keys >= custoDoModo();
}

/** A decisão direto das evidências (com o fator opcional). */
export function valeMostrar(x: readonly number[], keys: number, fator = 1): boolean {
  return decidir(probAcerto(x) * fator, keys);
}

/** Analisa a linha e a posição do cursor e devolve a sugestão de texto fantasma, se houver. */
export function predictCompletion(doc: Text, pos: number, index: DocumentIndex): GhostSuggestion | null {
  const line = doc.lineAt(pos);
  const col = pos - line.from;
  return predictFromLine(line.text.slice(0, col), line.text.slice(col), pos, index);
}

/**
 * Previsão sem depender do CodeMirror: recebe o texto da linha/parágrafo antes e depois do cursor.
 * (O editor do Word usa esta versão.)
 */
export function predictFromLine(before: string, after: string, pos: number, index: DocumentIndex): GhostSuggestion | null {
  // cursor no meio de uma palavra (pa|lavra): não atrapalha
  if (/^[\p{L}0-9_-]/u.test(after)) return null;
  if (before.trim() === "") return null;
  if (before.trim().startsWith("```")) return null;
  const model = getLanguageModel();
  if (!model) return predictLegacy(before, after, pos, index);
  const r = predictWithModel(model, before, index, THRESHOLDS.alternatives);
  if (r?.replace) return { text: r.texts[0], pos, replace: r.replace }; // correção do que foi digitado: sem alternativas nem aprendizado
  return r ? { text: r.texts[0], pos, alts: r.texts, altWords: r.words, prev: r.prev, mode: r.mode } : null;
}

// ---------------------------------------------------------------- contexto

const WORD = /[A-Za-zÀ-ÿ]+(?:-[A-Za-zÀ-ÿ]+)*|\d+(?:[.,]\d+)*|,/g;

interface Ctx {
  /** palavras anteriores (minúsculas; número = "#"; vírgula = ",") — sem a palavra que está sendo digitada */
  tokens: string[];
  /** a palavra que está sendo digitada (como foi digitada), ou null se acabou de dar espaço */
  prefix: string | null;
  /** o cursor está no começo de uma frase */
  sentenceStart: boolean;
  /** a palavra que acabou de ser terminada com espaço (como foi digitada), se houver */
  justTyped: { word: string; spaces: number; mid: boolean } | null;
}

function readContext(before: string): Ctx | null {
  const endsLetter = /[\p{L}0-9_-]$/u.test(before);
  const endsSpace = /\s$/.test(before);
  if (!endsLetter && !endsSpace) return null;
  // só a frase atual conta
  let seg = before;
  const rx = /[.!?;:()…]+(?:\s+|$)/g;
  let m: RegExpExecArray | null;
  let cut = 0;
  while ((m = rx.exec(before))) cut = m.index + m[0].length;
  if (cut > 0) seg = before.slice(cut);
  // linha de lista/título/tabela do Markdown: ignora os símbolos do começo
  seg = seg.replace(/^\s*(?:[-*+>]\s+|\d+[.)]\s+|#{1,6}\s+|\|\s*)/, "");
  const raw = seg.match(WORD) ?? [];
  const toks = raw.map((w) => (/^\d/.test(w) ? "#" : w === "," ? "," : w.toLowerCase()));
  let prefix: string | null = null;
  if (endsLetter) {
    const last = raw[raw.length - 1];
    if (!last || /^\d/.test(last) || !before.endsWith(last)) return null;
    prefix = last;
    toks.pop();
  }
  // palavra recém-terminada: "resultdo " (letras seguidas de espaço), para oferecer a correção
  let justTyped: Ctx["justTyped"] = null;
  if (endsSpace) {
    const jm = /([\p{L}][\p{L}'-]*)(\s+)$/u.exec(before);
    if (jm) justTyped = { word: jm[1], spaces: jm[2].length, mid: toks.length > 1 };
  }
  return { tokens: toks, prefix, sentenceStart: cut > 0 ? toks.length === 0 : false, justTyped };
}

// ---------------------------------------------------------------- pontuação

interface Cand {
  lc: string;
  id: number;
  display: string;
  pc: number;
  pd: number;
}

interface Ranked {
  best: Cand;
  p: number;
  /** probabilidade da própria palavra digitada estar completa (modo prefixo) */
  pSelf: number;
  /** quanto do documento entrou na mistura (0 = só o modelo do idioma) */
  lambda: number;
}

/** Fontes de evidência: o documento aberto (peso 1) e a memória dos outros documentos (peso 0,5). */
function sourcesOf(index: DocumentIndex): [DocumentIndex, number][] {
  return index === personalIndex ? [[index, 1]] : [[index, 1], [personalIndex, MIX.personal]];
}

function docMaps(sources: [DocumentIndex, number][], t1: string | undefined, t2: string | undefined) {
  // as chaves guardam a grafia original: junta por minúsculas
  const fold = (pick: (i: DocumentIndex) => Map<string, number> | undefined): Map<string, number> => {
    const out = new Map<string, number>();
    for (const [idx, w] of sources) {
      const m = pick(idx);
      if (m) for (const [word, c] of m) out.set(word.toLowerCase(), (out.get(word.toLowerCase()) ?? 0) + seen(c) * w);
    }
    return out;
  };
  return {
    tri: fold((i) => (t1 && t2 ? i.trigrams.get(`${t1} ${t2}`) : undefined)),
    bi: fold((i) => (t2 ? i.bigrams.get(t2) : undefined)),
  };
}

const sum = (m: Map<string, number>): number => {
  let s = 0;
  for (const c of m.values()) s += c;
  return s;
};


/**
 * Evita sugestões em ciclo ("casa casa casa", "o projeto de o projeto de"): zera repetir a palavra anterior e
 * enfraquece o que acabaria repetindo uma sequência ou uma palavra já muito usada nas últimas palavras.
 */
function repeatPenalty(tokens: string[], w: string): number {
  const n = tokens.length;
  if (n === 0 || w.length < 1) return 1;
  if (tokens[n - 1] === w) return 0;
  const recent = tokens.slice(-24);
  let f = 1;
  let uses = 0;
  for (const t of recent) if (t === w) uses++;
  if (uses >= 3) f *= 0.15;
  else if (uses === 2) f *= 0.6;
  if (n >= 2) {
    const a = tokens[n - 2];
    const b = tokens[n - 1];
    for (let i = 0; i + 2 < recent.length; i++) if (recent[i] === a && recent[i + 1] === b && recent[i + 2] === w) { f *= 0.05; break; }
  }
  return f;
}

/** Escolhe a melhor palavra para o contexto (e o prefixo digitado, se houver). */
/** As `k` palavras mais prováveis, da melhor para a pior. */
function rank(model: LangModel, index: DocumentIndex, tokens: string[], prefix: string | null, k = 1): Ranked[] {
  const idOf = (w: string | undefined): number => (w === undefined ? START : w === "," ? COMMA : w === "#" ? NUMBER : (model.idOf.get(w) ?? -1));
  const t2 = tokens.length ? tokens[tokens.length - 1] : undefined;
  const t1 = tokens.length > 1 ? tokens[tokens.length - 2] : undefined;
  const c2 = idOf(t2);
  const c1 = tokens.length > 1 ? idOf(t1) : START;
  // com 1 palavra só, o contexto de trigrama é "<s> palavra"
  const tri = tokens.length >= 1 && c1 >= 0 && c2 >= 0 ? model.trigram(tokens.length === 1 ? START : c1, c2) : { succ: [], total: 0 };
  const bi = c2 >= 0 || tokens.length === 0 ? model.bigram(tokens.length === 0 ? START : c2) : { succ: [], total: 0 };
  // no documento, o começo da frase é o contexto "<s>"
  const sources = sourcesOf(index);
  const originalOf = (lc: string): string | undefined => sources.map(([i]) => i.originalCase.get(lc)).find(Boolean);
  const doc = docMaps(sources, tokens.length >= 2 ? t1 : tokens.length === 1 ? SENTENCE_START : undefined, tokens.length >= 1 ? t2 : SENTENCE_START);
  const lowPrefix = prefix?.toLowerCase() ?? null;

  const cands = new Map<string, Cand>();
  const add = (lc: string, id: number, display?: string): Cand => {
    let c = cands.get(lc);
    if (!c) cands.set(lc, (c = { lc, id, display: display ?? (id >= 0 ? model.display(id) : lc), pc: 0, pd: 0 }));
    return c;
  };
  const okPrefix = (lc: string) => lowPrefix === null || lc.startsWith(lowPrefix);

  // ----- modelo do idioma
  const triMap = new Map(tri.succ.map((s) => [s.id, s.count]));
  const biMap = new Map(bi.succ.map((s) => [s.id, s.count]));
  const consider = (id: number) => {
    if (id < 3) return;
    const lc = model.words[id];
    if (!okPrefix(lc)) return;
    const c = add(lc, id);
    const p3 = tri.total > 0 ? (triMap.get(id) ?? 0) / tri.total : 0;
    const p2 = bi.total > 0 ? (biMap.get(id) ?? 0) / bi.total : 0;
    const p1 = model.uniProb(id);
    c.pc = tri.total > 0 ? 0.5 * p3 + 0.35 * p2 + 0.15 * p1 : 0.8 * p2 + 0.2 * p1;
  };
  for (const s of tri.succ) consider(s.id);
  for (const s of bi.succ) consider(s.id);
  if (lowPrefix !== null) for (const id of model.withPrefix(lowPrefix)) consider(id);

  // ----- o que a pessoa escreve no documento
  const docT3 = sum(doc.tri);
  const docT2 = sum(doc.bi);
  let ev = docT3 * 2 + docT2;
  if (lowPrefix === null) {
    for (const [lc, n] of doc.tri) add(lc, model.idOf.get(lc) ?? -1, originalOf(lc)).pd += (docT3 > 0 ? (docT2 > 0 ? 0.65 : 1) * n / docT3 : 0);
    for (const [lc, n] of doc.bi) add(lc, model.idOf.get(lc) ?? -1, originalOf(lc)).pd += docT2 > 0 ? (docT3 > 0 ? 0.35 : 1) * n / docT2 : 0;
  } else {
    // palavras do documento que começam com o prefixo (a própria palavra em digitação, se só apareceu 1 vez, não conta)
    let freqSum = 0;
    const byPrefix: [string, number][] = [];
    const freq = new Map<string, number>();
    for (const [idx, w] of sources) for (const [lc, n] of idx.wordFreq) if (lc.startsWith(lowPrefix)) freq.set(lc, (freq.get(lc) ?? 0) + seen(n) * w);
    for (const [lc, n] of freq) {
      if (lc === lowPrefix && n <= 1) continue;
      byPrefix.push([lc, n]);
      freqSum += n;
    }
    const ctxTot = [...doc.tri, ...doc.bi].filter(([lc]) => okPrefix(lc)).reduce((a, [, n]) => a + n, 0);
    ev = freqSum + 2 * ctxTot;
    const triTot = [...doc.tri].filter(([lc]) => okPrefix(lc)).reduce((a, [, n]) => a + n, 0);
    const biTot = [...doc.bi].filter(([lc]) => okPrefix(lc)).reduce((a, [, n]) => a + n, 0);
    for (const [lc, n] of byPrefix) {
      const c = add(lc, model.idOf.get(lc) ?? -1, originalOf(lc));
      const pu = n / freqSum;
      const ct = triTot > 0 ? (doc.tri.get(lc) ?? 0) / triTot : biTot > 0 ? (doc.bi.get(lc) ?? 0) / biTot : 0;
      c.pd = ctxTot > 0 ? 0.65 * ct + 0.35 * pu : pu;
    }
  }
  if (!cands.size) return [];

  // ----- mistura: quanto mais evidência no documento, mais peso ele tem
  const lambda = Math.min(MIX.maxLambda, ev / (ev + (lowPrefix === null ? MIX.kNext : MIX.kPrefix)));
  let pcSum = 0;
  let pdSum = 0;
  for (const c of cands.values()) {
    pcSum += c.pc;
    pdSum += c.pd;
  }
  const norm = lowPrefix !== null; // com prefixo: probabilidade entre as palavras que começam assim
  const scored: { c: Cand; p: number }[] = [];
  let pSelf = 0;
  for (const c of cands.values()) {
    const a = norm ? (pcSum > 0 ? c.pc / pcSum : 0) : c.pc;
    const d = norm ? (pdSum > 0 ? c.pd / pdSum : 0) : c.pd;
    let p = (1 - lambda) * a + lambda * d;
    // quem digita em minúsculas raramente quer um nome próprio
    if (lowPrefix !== null && prefix![0] === prefix![0].toLowerCase() && c.id >= 0 && model.caps.has(c.id)) p *= 0.4;
    if (lowPrefix !== null && c.lc === lowPrefix) {
      pSelf = p;
      continue; // a própria palavra completa: não há o que sugerir
    }
    // O aprendizado do uso (aceitas/recusadas) NÃO entra aqui: ele ajusta a decisão final, num
    // intervalo curto (0,75–1,25). Antes ele multiplicava a probabilidade crua e, como a
    // calibração foi ajustada sem ele, uma sequência de recusas derrubava P(acertar) e a sugestão
    // sumia justamente para quem mais precisava dela.
    if (THRESHOLDS.agreement) p *= agreementFactor(tokens[tokens.length - 1], c.lc); // concordância de gênero e número
    p *= repeatPenalty(tokens, c.lc);
    if (p <= 0) continue;
    scored.push({ c, p });
  }
  scored.sort((x, y) => y.p - x.p);
  return scored.slice(0, k).map((x) => ({ best: x.c, p: x.p, pSelf, lambda }));
}

/** Sugestão principal + alternativas (da mais para a menos provável). A primeira é a que aparece em cinza. */
function predictWithModel(model: LangModel, before: string, index: DocumentIndex, k = 1): { texts: string[]; words: string[]; prev: string; mode: "next" | "prefix"; replace?: number } | null {
  const ctx = readContext(before);
  if (!ctx) return null;
  const T = THRESHOLDS;
  const prev0 = ctx.tokens.length ? ctx.tokens[ctx.tokens.length - 1] : SENTENCE_START;
  const typoFix = (): { texts: string[]; words: string[]; prev: string; mode: "next"; replace: number } | null => {
    const jt = ctx.justTyped;
    if (!T.typoFix || !jt) return null;
    // nome próprio no meio da frase (inicial maiúscula): não mexe
    if (jt.mid && jt.word[0] !== jt.word[0].toLowerCase() && jt.word !== jt.word.toUpperCase()) return null;
    const fixed = fixTypo(model, jt.word.toLowerCase());
    if (!fixed) return null;
    const upper = jt.word === jt.word.toUpperCase() && jt.word.length > 1;
    const cap = jt.word[0] !== jt.word[0].toLowerCase();
    const text = upper ? fixed.toUpperCase() : cap ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
    // troca a palavra e mantém o espaço que a pessoa digitou
    return { texts: [text + " ".repeat(jt.spaces)], words: [fixed], prev: prev0, mode: "next", replace: jt.word.length + jt.spaces };
  };
  // o contexto de uma palavra com erro é pouco confiável: a correção vem antes de qualquer previsão
  const fixFirst = typoFix();
  if (fixFirst) return fixFirst;
  const list = rank(model, index, ctx.tokens, ctx.prefix, k);
  if (!list.length) return null;
  const out: string[] = [];
  const words: string[] = [];
  for (let i = 0; i < list.length; i++) {
    let text = suggestFrom(model, index, ctx, list[i], i === 0);
    // faltam poucas letras: digitar custa quase o mesmo que o Tab, então a sugestão só atrapalha
    if (text && ctx.prefix !== null && text.trimEnd().length < minChars()) text = null;
    if (i === 0) {
      if (!text) return null;
      out.push(text);
      words.push(list[i].best.lc);
    } else if (text && list[i].p >= T.alt && !out.includes(text)) {
      out.push(text);
      words.push(list[i].best.lc);
    }
  }
  return { texts: out, words, prev: prev0, mode: ctx.prefix !== null ? "prefix" : "next" };
}

/** Monta o texto a sugerir a partir de uma palavra escolhida (ou nada, se o ganho não pagar o custo). */
function suggestFrom(model: LangModel, index: DocumentIndex, ctx: Ctx, first: Ranked, main: boolean): string | null {
  const T = THRESHOLDS;
  const words: string[] = [];
  let tokens = ctx.tokens;
  const prev = ctx.tokens.length ? ctx.tokens[ctx.tokens.length - 1] : SENTENCE_START;
  if (ctx.prefix !== null) {
    const n = ctx.prefix.length;
    let disp = first.best.display;
    if (ctx.prefix === ctx.prefix.toUpperCase() && n > 1) disp = disp.toUpperCase();
    else if (ctx.prefix[0] !== ctx.prefix[0].toLowerCase() && disp[0] === disp[0].toLowerCase() && first.best.id >= 0 && model.caps.has(first.best.id)) disp = disp[0].toUpperCase() + disp.slice(1);
    const suffix = disp.slice(n);
    if (!suffix) return null;
    const capsMismatch = ctx.prefix[0] === ctx.prefix[0].toLowerCase() && first.best.id >= 0 && model.caps.has(first.best.id);
    // completar palavra: a chance calibrada (é o que a régua mede e o que mais aparece)
    const prob = probAcerto(evidencias(first.p, first.pSelf, n, first.lambda, ctx.sentenceStart, capsMismatch)) * fatorPreferencia(prev, first.best.lc);
    if (main && !decidir(prob, suffix.length)) return null;
    words.push(suffix);
    tokens = [...tokens, first.best.lc];
    if (!main) return suffix;
  } else {
    let w = first.best.display;
    if (ctx.sentenceStart) w = w[0].toUpperCase() + w.slice(1);
    // próxima palavra: a regra já validada (a calibração não se sustenta aqui — taxa-base baixa)
    if (main && first.p < limiar(T.next, "next")) return null;
    words.push(w);
    tokens = [...tokens, first.best.lc];
    if (!main) return w;
  }
  // a corrente segue o limiar já validado de 0,75 no n-grama: ela é RARA (a calibração dela exigiria
  // muitos dados que quase não existem) e multiplicar as chances deixava a corrente impossível.
  while (words.length < T.maxWords) {
    const nx = rank(model, index, tokens, null)[0];
    if (!nx || nx.p < T.chain) break;
    words.push(nx.best.display);
    tokens = [...tokens, nx.best.lc];
  }
  return ctx.prefix !== null ? words[0] + (words.length > 1 ? " " + words.slice(1).join(" ") : "") : words.join(" ");
}

/**
 * O ponto de decisão SEM os cortes: a sugestão que apareceria e as evidências dela. É o que o
 * `scripts/calibrar-ghost.mts` lê para ajustar `CALIB.w` e o que o avaliador usa para medir.
 */
export function pontoCru(before: string, index: DocumentIndex): { text: string; keys: number; x: number[]; p: number; pSelf: number; lambda: number; prefixLen: number; sentenceStart: boolean } | null {
  const model = getLanguageModel();
  if (!model) return null;
  const ctx = readContext(before);
  if (!ctx) return null;
  const list = rank(model, index, ctx.tokens, ctx.prefix, 1);
  if (!list.length) return null;
  const first = list[0];
  if (ctx.prefix !== null) {
    const n = ctx.prefix.length;
    let disp = first.best.display;
    if (ctx.prefix === ctx.prefix.toUpperCase() && n > 1) disp = disp.toUpperCase();
    else if (ctx.prefix[0] !== ctx.prefix[0].toLowerCase() && disp[0] === disp[0].toLowerCase() && first.best.id >= 0 && model.caps.has(first.best.id)) disp = disp[0].toUpperCase() + disp.slice(1);
    const suffix = disp.slice(n);
    if (!suffix) return null;
    const capsMismatch = ctx.prefix[0] === ctx.prefix[0].toLowerCase() && first.best.id >= 0 && model.caps.has(first.best.id);
    return { text: suffix, keys: suffix.length, x: evidencias(first.p, first.pSelf, n, first.lambda, ctx.sentenceStart, capsMismatch), p: first.p, pSelf: first.pSelf, lambda: first.lambda, prefixLen: n, sentenceStart: ctx.sentenceStart };
  }
  let w = first.best.display;
  if (ctx.sentenceStart) w = w[0].toUpperCase() + w.slice(1);
  return { text: w, keys: w.length + 1, x: evidencias(first.p, first.pSelf, 0, first.lambda, ctx.sentenceStart, false), p: first.p, pSelf: first.pSelf, lambda: first.lambda, prefixLen: 0, sentenceStart: ctx.sentenceStart };
}

/** Uma candidata do n-grama (com a chance dela). */
export interface RerankCand {
  /** a palavra como deve aparecer */
  word: string;
  /** a palavra em minúsculas */
  lc: string;
  p: number;
  /** id no modelo do idioma (-1 se só existe no documento) */
  id: number;
}

/** O ponto do cursor visto como uma escolha entre candidatas (para a IA local reordenar). */
export interface RerankPoint {
  mode: "next" | "prefix";
  /** o que foi digitado da palavra atual (modo prefixo) */
  prefix: string | null;
  /** o texto antes da palavra atual (sem o prefixo) */
  context: string;
  /** a palavra anterior (para aprender com o uso) */
  prev: string;
  list: RerankCand[];
}

/**
 * Candidatas do n-grama para o ponto do cursor, sem os cortes de confiança. A IA local reordena essa lista
 * (ver refine.ts) e o experimento que mede o ganho (scripts/) usa a mesma função.
 */
export function candidatesAt(before: string, index: DocumentIndex, k = 8): RerankPoint | null {
  const model = getLanguageModel();
  if (!model) return null;
  const ctx = readContext(before);
  if (!ctx) return null;
  const list = rank(model, index, ctx.tokens, ctx.prefix, k);
  if (!list.length) return null;
  return {
    mode: ctx.prefix === null ? "next" : "prefix",
    prefix: ctx.prefix,
    context: ctx.prefix === null ? before : before.slice(0, before.length - ctx.prefix.length),
    prev: ctx.tokens.length ? ctx.tokens[ctx.tokens.length - 1] : SENTENCE_START,
    list: list.map((r) => ({ word: r.best.display, lc: r.best.lc, p: r.p, id: r.best.id })),
  };
}

/** O texto que falta para completar `prefix` com a candidata (respeita MAIÚSCULAS e nomes próprios). */
export function completionSuffix(prefix: string, cand: RerankCand): string {
  const model = getLanguageModel();
  const n = prefix.length;
  let disp = cand.word;
  if (prefix === prefix.toUpperCase() && n > 1) disp = disp.toUpperCase();
  else if (prefix[0] !== prefix[0].toLowerCase() && disp[0] === disp[0].toLowerCase() && cand.id >= 0 && model?.caps.has(cand.id)) disp = disp[0].toUpperCase() + disp.slice(1);
  return disp.slice(n);
}

/** Quantas letras, no mínimo, uma sugestão de completar palavra precisa poupar (já considera o modo de intensidade). */
export const minSuffixChars = minChars;
