// Revisão profunda do documento inteiro: acha palavras que se repetem demais e propõe trocas por sinônimos que
// MANTÊM a forma (tempo verbal, plural, feminino) e CABEM no contexto (a palavra de antes e a de depois, segundo o modelo
// do idioma, o que a pessoa escreve e a concordância). Cada troca vem com o motivo. Roda em fatias (ver scheduler.ts).
//
// Regra de ouro: precisão antes de quantidade. Uma troca só é proposta quando
//  - a palavra tem sinônimo de confiança (lista curada) ou, no modo "mais opções", do dicionário amplo;
//  - a forma trocada existe de verdade no idioma e concorda com o artigo anterior;
//  - o contexto sustenta: a palavra nova costuma vir depois da anterior e/ou antes da seguinte, ou se comporta
//    como a original (mesmas palavras ao redor).

import { DocumentIndex } from "../ghost/documentIndex";
import { personalIndex } from "../ghost/memory";
import { agrees } from "../ghost/agreement";
import { getLanguageModel, START, type LangModel } from "../ghost/model";
import { ctxWords } from "../personal/rerank";
import { analyze, inflect, type Lemma } from "./morph";
import { hasSynonyms, posOf, synonymsOf } from "./thesaurus";

/** Um trecho contínuo de texto e a posição dele no documento (para voltar do texto à posição). */
export interface Segment {
  text: string;
  base: number;
}

export type Confidence = "alta" | "média";

export interface Proposal {
  id: string;
  /** posição no documento (início/fim da palavra original) */
  from: number;
  to: number;
  original: string;
  replacement: string;
  /** palavra-base que se repete */
  lemma: string;
  confidence: Confidence;
  /** nota da IA local: quanto a frase com a troca é mais (+) ou menos (−) natural que a original */
  lmDelta?: number;
  /** por que esta troca cabe aqui */
  reason: string;
  /** a frase em volta, para mostrar a troca em contexto */
  before: string;
  after: string;
}

export interface Group {
  lemma: string;
  /** a forma mais usada no texto */
  shown: string;
  count: number;
  /** uma a cada N palavras */
  every: number;
  proposals: Proposal[];
  why: string;
}

export interface DeepResult {
  groups: Group[];
  words: number;
  at: number;
  /** onde a IA local conferiu as trocas ("webgpu"), ou nada se ela não estava disponível */
  lm?: string;
}

export interface DeepOptions {
  model?: LangModel | null;
  /** inclui sinônimos do dicionário amplo (confiança média) */
  includeBroad?: boolean;
  maxGroups?: number;
}

/** Palavras de função / verbos auxiliares: repeti-los é normal e trocá-los quebra a frase. */
const SKIP = new Set(["para", "como", "mais", "menos", "pela", "pelo", "pelas", "pelos", "esta", "este", "essa", "esse", "isso", "isto", "quando", "onde", "entre", "sobre", "depois", "antes", "cada", "todo", "toda", "todos", "todas", "outro", "outra", "outros", "outras", "seja", "será", "está", "estão", "foram", "sendo", "pode", "podem", "deve", "devem", "tem", "têm", "vai", "vão", "ter", "ser", "estar", "haver", "porque"]);

const WORD = /[\p{L}][\p{L}'-]*/gu;
const MIN_COUNT = 5;

interface Occ {
  lc: string;
  from: number;
  to: number;
  seg: number;
  /** posição dentro do texto do trecho */
  at: number;
  reading: Lemma;
}

/** A palavra `b` costuma vir logo depois de `a` no idioma? */
function follows(model: LangModel, a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ia = model.idOf.get(a);
  const ib = model.idOf.get(b);
  return ia !== undefined && ib !== undefined && model.bigram(ia).succ.some((s) => s.id === ib);
}

/** Depois de `a b`, costuma vir `c`? */
function triFollows(model: LangModel, a: string, b: string, c: string): boolean {
  const ia = model.idOf.get(a);
  const ib = model.idOf.get(b);
  const ic = model.idOf.get(c);
  return ia !== undefined && ib !== undefined && ic !== undefined && model.trigram(ia, ib).succ.some((s) => s.id === ic);
}

const DETERMINER_NEXT = new Set(["o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "mais", "menos", "muito", "muitos", "muitas", "outro", "outra", "outros", "outras", "todo", "toda", "todos", "todas", "seu", "sua", "seus", "suas"]);

/** As duas palavras depois de `pos`. */
function nextTwo(text: string, pos: number): string[] {
  const after = text.slice(pos, pos + 90);
  const stop = after.search(/[.!?\n;:]/);
  return ((stop >= 0 ? after.slice(0, stop) : after).match(/[\p{L}][\p{L}'-]*/gu) ?? []).slice(0, 2).map((w) => w.toLowerCase());
}

/** Quanto duas palavras se comportam igual (as mesmas palavras costumam vir depois): 0 a 1. */
function similarity(model: LangModel, a: string, b: string): number {
  const ia = model.idOf.get(a);
  const ib = model.idOf.get(b);
  if (ia === undefined || ib === undefined) return 0;
  const A = model.bigram(ia);
  const B = model.bigram(ib);
  if (!A.total || !B.total) return 0;
  const mb = new Map(B.succ.map((s) => [s.id, s.count / B.total]));
  let sim = 0;
  for (const s of A.succ) sim += Math.min(s.count / A.total, mb.get(s.id) ?? 0);
  return sim;
}

export function* analyzeDeep(segments: Segment[], opts: DeepOptions = {}): Generator<void, DeepResult> {
  const model = opts.model ?? getLanguageModel();
  const out: DeepResult = { groups: [], words: 0, at: Date.now() };
  if (!model) return out;
  const includeBroad = !!opts.includeBroad;
  const known = (l: string) => hasSynonyms(l, includeBroad);

  // ---- 1) lê todas as palavras e descobre de que palavra-base cada uma é forma
  const byLemma = new Map<string, Occ[]>();
  const readingCache = new Map<string, Lemma | null>();
  const docWords = new Map<string, number>();
  let words = 0;
  const readingOf = (lc: string): Lemma | null => {
    let r = readingCache.get(lc);
    if (r !== undefined) return r;
    // a própria palavra vem primeiro ("partida" é "partida", não uma forma de "partir")
    const all = analyze(lc, known).filter((x) => {
      const pos = posOf(x.lemma);
      if (!pos) return true; // só do dicionário amplo: sem classe conhecida
      if (pos === "v") return x.tag.kind === "verb";
      if (pos === "adv") return x.lemma === lc;
      return x.tag.kind === "noun";
    });
    all.sort((a, b) => Number(b.lemma === lc) - Number(a.lemma === lc));
    r = all[0] ?? null;
    readingCache.set(lc, r);
    return r;
  };
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    WORD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WORD.exec(seg.text)) !== null) {
      words++;
      const lc = m[0].toLowerCase();
      docWords.set(lc, (docWords.get(lc) ?? 0) + 1);
      if (lc.length < 4 || SKIP.has(lc)) continue;
      const reading = readingOf(lc);
      if (!reading) continue;
      // inicial maiúscula no meio da frase = nome próprio ("Primeiro de Janeiro"): não mexe
      if (m[0][0] !== m[0][0].toLowerCase() && m[0] !== m[0].toUpperCase() && ctxWords(seg.text, m.index, m.index + lc.length).prev.length > 0) continue;
      const occ: Occ = { lc, from: seg.base + m.index, to: seg.base + m.index + lc.length, seg: si, at: m.index, reading };
      let list = byLemma.get(reading.lemma);
      if (!list) byLemma.set(reading.lemma, (list = []));
      list.push(occ);
    }
    if (si % 20 === 19) yield;
  }
  out.words = words;
  if (words < 120) return out;

  // ---- 2) quais palavras-base se repetem mais do que o normal
  const docIdx = new DocumentIndex();
  docIdx.update(segments.map((s) => s.text).join("\n"));
  const minCount = Math.max(MIN_COUNT, Math.ceil(words / 400));
  const overused: [string, Occ[]][] = [];
  for (const [lemma, list] of byLemma) {
    if (list.length < minCount) continue;
    // palavra do ASSUNTO do texto (muito mais frequente aqui do que no idioma): repetir é natural
    const id = model.idOf.get(lemma);
    const general = id !== undefined ? Math.max(model.uniProb(id), 1e-6) : 1e-6;
    if (!posOf(lemma) && list.length / words / general > 25) continue; // (as da lista curada são sempre estilo)
    overused.push([lemma, list]);
  }
  overused.sort((a, b) => b[1].length - a[1].length);
  if ((globalThis as { __deepDebug?: boolean }).__deepDebug) console.log("[deep] palavras-base:", [...byLemma.entries()].filter(([, l]) => l.length >= 3).map(([k, l]) => k + ":" + l.length).join(" "), "| minCount", minCount, "| repetidas:", overused.map(([k, l]) => k + ":" + l.length).join(" "));
  yield;

  // ---- 3) para cada uma, escolhe onde trocar e por quê
  const used = new Map<string, number>(); // quantas vezes cada substituta já foi escolhida no texto todo
  const maxGroups = opts.maxGroups ?? 12;
  let steps = 0;
  for (const [lemma, list] of overused) {
    if (out.groups.length >= maxGroups) break;
    const keep = Math.max(2, Math.ceil(list.length * 0.45));
    const wantChange = Math.min(40, list.length - keep);
    if (wantChange < 1) continue;
    const pos = posOf(lemma);
    const cands = synonymsOf(lemma, includeBroad);
    const proposals: Proposal[] = [];
    const perCand = new Map<string, number>();
    for (let k = 0; k < list.length && proposals.length < wantChange; k++) {
      // espalha as trocas pelo texto todo (a 1ª ocorrência fica como está)
      if (Math.floor(((k + 1) * wantChange) / list.length) === Math.floor((k * wantChange) / list.length)) continue;
      const occ = list[k];
      const seg = segments[occ.seg];
      const { prev, next } = ctxWords(seg.text, occ.at, occ.at + occ.lc.length);
      const next2 = nextTwo(seg.text, occ.at + occ.lc.length)[1];
      const p1 = prev.length ? prev[prev.length - 1] : undefined;
      let best: { form: string; score: number; curated: boolean; sim: number } | null = null;
      for (const c of cands) {
        // a forma trocada, igual à original: mesmo tempo verbal, plural e feminino
        const form = pos === "adv" ? c.word : inflect(c.word, occ.reading.tag);
        if (!form || form === occ.lc) continue;
        const id = model.idOf.get(form);
        if (id === undefined || model.data.n[id] < 8) continue; // a forma tem que existir de verdade
        if ((docWords.get(form) ?? 0) >= 4) continue; // não troca um repetido por outro repetido
        if (occ.reading.tag.kind === "noun" && agrees(p1, form) === false) continue; // "a equipe" não vira "a time"
        const supPrev = follows(model, p1, form);
        const supNext = follows(model, form, next ?? undefined);
        const sim = similarity(model, occ.lc, form);
        // verbo: precisa combinar com o que ele rege ("fazer uma pesquisa" sim, "elaborar atendimentos" não)
        if (occ.reading.tag.kind === "verb" && next && next2 && !triFollows(model, form, next, next2) && !(follows(model, form, next) && DETERMINER_NEXT.has(next) === false)) continue;
        // o contexto precisa sustentar a troca
        const ok = c.curated ? supPrev || supNext || sim >= 0.25 : (supPrev || !p1) && (supNext || !next) && (supPrev || supNext) && sim >= 0.06;
        if (!ok) continue;
        const variety = 1 / (1 + (perCand.get(form) ?? 0) + 0.3 * (used.get(form) ?? 0));
        const score = (0.4 * Number(supPrev) + 0.4 * Number(supNext) + sim + 0.05 * Math.log1p(personalIndex.wordFreq.get(form) ?? 0)) * variety * (c.curated ? 1.5 : 1);
        if (!best || score > best.score) best = { form, score, curated: c.curated, sim };
      }
      if (!best) continue;
      perCand.set(best.form, (perCand.get(best.form) ?? 0) + 1);
      used.set(best.form, (used.get(best.form) ?? 0) + 1);
      const orig = seg.text.slice(occ.at, occ.at + occ.lc.length);
      proposals.push({
        id: `${lemma}:${occ.from}`,
        from: occ.from,
        to: occ.to,
        original: orig,
        replacement: matchCase(orig, best.form),
        lemma,
        confidence: best.curated ? "alta" : "média",
        reason: explain(model, p1, next, best.form, orig, docWords, best.sim),
        before: sentenceAround(seg.text, occ.at, -1),
        after: sentenceAround(seg.text, occ.at + occ.lc.length, 1),
      });
      if (++steps % 25 === 0) yield;
    }
    if (!proposals.length) continue;
    const forms = [...perCand.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => `“${w}”`);
    const counts = new Map<string, number>();
    for (const o of list) counts.set(o.lc, (counts.get(o.lc) ?? 0) + 1);
    const shown = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const every = Math.round(words / list.length);
    out.groups.push({
      lemma,
      shown,
      count: list.length,
      every,
      proposals,
      why: describeGroup(shown, list.length, every, proposals),
    });
    yield;
  }
  return out;
}

/** O texto que explica por que a palavra deve variar e o que se propõe. */
export function describeGroup(shown: string, count: number, every: number, proposals: Proposal[]): string {
  const uso = new Map<string, number>();
  for (const p of proposals) uso.set(p.replacement.toLowerCase(), (uso.get(p.replacement.toLowerCase()) ?? 0) + 1);
  const forms = [...uso.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => `“${w}”`);
  return `“${shown}” aparece ${count} vezes neste texto (uma a cada ${every} palavras). Para não ficar repetitivo, sugiro variar em ${proposals.length} ${proposals.length === 1 ? "trecho" : "trechos"}, usando ${listPt(forms.slice(0, 4))} — só onde a troca combina com a palavra de antes e a de depois, na mesma forma da original. ${proposals.length < count ? `As outras ${count - proposals.length} ficam como estão.` : ""}`.trim();
}

function listPt(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function matchCase(orig: string, repl: string): string {
  if (orig === orig.toUpperCase() && orig.length > 1) return repl.toUpperCase();
  if (orig[0] !== orig[0].toLowerCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
}

/** Até ~80 caracteres da frase, para um lado do ponto (dir = -1: antes; 1: depois). */
function sentenceAround(text: string, pos: number, dir: -1 | 1): string {
  if (dir === -1) {
    const s = text.slice(Math.max(0, pos - 90), pos);
    const cut = Math.max(s.lastIndexOf(". "), s.lastIndexOf("\n"), s.lastIndexOf("? "), s.lastIndexOf("! "));
    return s.slice(cut + 1).replace(/^\s+/, "");
  }
  const s = text.slice(pos, pos + 90);
  const m = /[.!?\n]/.exec(s);
  return m ? s.slice(0, m.index + (m[0] === "\n" ? 0 : 1)) : s;
}

/** O porquê desta troca, com fatos que a pessoa pode conferir. */
function explain(model: LangModel, p1: string | undefined, next: string | null, form: string, original: string, docWords: Map<string, number>, sim: number): string {
  const f = form.toLowerCase();
  const parts: string[] = [];
  if (follows(model, p1, f)) parts.push(`“${f}” costuma vir depois de “${p1}”`);
  if (follows(model, f, next ?? undefined)) parts.push(`${parts.length ? "e" : "“" + f + "” costuma vir"} antes de “${next}”`.replace(/^e e /, "e "));
  if (!parts.length && sim >= 0.06) parts.push(`“${f}” aparece nos mesmos contextos que “${original.toLowerCase()}” em textos em português`);
  const mine = personalIndex.wordFreq.get(f) ?? 0;
  if (mine >= 2) parts.push(`você já escreve “${f}” em outros textos (${mine} vezes)`);
  const here = docWords.get(f) ?? 0;
  parts.push(here ? `aqui ela aparece só ${here}×` : "ainda não aparece neste texto");
  void START;
  return `${parts.join("; ")}. É sinônimo de “${original.toLowerCase()}” na mesma forma, então a frase mantém o sentido.`;
}
