// Sinônimos para a revisão profunda, em dois níveis de confiança:
//  - ALTA: a lista escolhida a dedo (curated.ts), com a classe de cada palavra;
//  - MÉDIA: o dicionário aberto do LibreOffice (public/ngrams/syn-pt.json), mais amplo e mais ruidoso. Só vale se o
//    contexto sustentar a troca dos dois lados, e a tela os esconde por padrão.

import { SYNONYMS } from "../data/synonyms";
import { CURATED, type Curated } from "./curated";

export type Pos = Curated["pos"];

export interface SynCand {
  word: string;
  /** de alta confiança (lista escolhida a dedo) */
  curated: boolean;
}

let broad: Record<string, string[]> | null = null;
let loading: Promise<void> | null = null;

export function setThesaurus(data: Record<string, string[]> | null): void {
  broad = data;
}

/** Carrega o dicionário amplo (uma vez). Sem ele, a revisão usa só a lista de alta confiança. */
export function loadThesaurus(url = "/ngrams/syn-pt.json"): Promise<void> {
  if (broad) return Promise.resolve();
  loading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: Record<string, string[]>) => setThesaurus(d))
    .catch((e) => {
      console.warn("Dicionário de sinônimos indisponível:", e);
      loading = null;
    });
  return loading;
}

/** Classe da palavra quando ela está na lista escolhida a dedo (ou deduzida pelo infinitivo, na lista antiga). */
export function posOf(lemma: string): Pos | null {
  const c = CURATED[lemma];
  if (c) return c.pos;
  return null;
}

export function hasSynonyms(lemma: string, includeBroad = true): boolean {
  return !!CURATED[lemma] || (includeBroad && (!!SYNONYMS[lemma] || !!broad?.[lemma]));
}

/** Sinônimos de `lemma` (palavras simples), os de alta confiança primeiro. */
export function synonymsOf(lemma: string, includeBroad = true): SynCand[] {
  const out: SynCand[] = [];
  const seen = new Set<string>([lemma]);
  const add = (w: string, curated: boolean) => {
    if (/\s/.test(w) || seen.has(w)) return;
    seen.add(w);
    out.push({ word: w, curated });
  };
  for (const w of CURATED[lemma]?.syn ?? []) add(w, true);
  // a lista antiga (sem classe gramatical) e o dicionário amplo só entram no modo "mais opções", como confiança média
  if (includeBroad && !CURATED[lemma]) for (const w of SYNONYMS[lemma] ?? []) add(w, false);
  if (includeBroad) for (const w of broad?.[lemma] ?? []) add(w, false);
  return out;
}
