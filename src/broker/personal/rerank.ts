// Reordena as sugestões do corretor pelo CONTEXTO: entre "resultado", "resultados" e "resultada", vale a que o modelo
// do idioma e o que a pessoa costuma escrever dizem que cabe depois da palavra anterior e antes da seguinte.
// Quem manda continua sendo o dicionário (a ordem dele pesa); o contexto desempata e corrige quando está claro.
// A CLASSE do erro entra como desempate fino: um candidato cuja classe (transposição, tecla vizinha, acento…)
// é a que a pessoa costuma aceitar sobe um pouco, mesmo sem o par exato ter aparecido antes.

import { getLanguageModel, START, type LangModel } from "../ghost/model";
import { personalIndex } from "../ghost/memory";
import type { DocumentIndex } from "../ghost/documentIndex";
import { bonusDaClasse } from "../spell/classeErro";

const WORD = /[\p{L}][\p{L}'-]*/gu;

export function ctxWords(text: string, from: number, to: number): { prev: string[]; next: string | null } {
  // só a frase atual: corta no último ponto antes e no primeiro depois
  const before = text.slice(Math.max(0, from - 160), from);
  const cut = Math.max(before.lastIndexOf(". "), before.lastIndexOf("\n"), before.lastIndexOf("? "), before.lastIndexOf("! "));
  const prev = (before.slice(cut + 1).match(WORD) ?? []).map((w) => w.toLowerCase()).slice(-2);
  const after = text.slice(to, to + 80);
  const stop = after.search(/[.!?\n]/);
  const nx = (stop >= 0 ? after.slice(0, stop) : after).match(WORD);
  return { prev, next: nx && /^\s*[\p{L}]/u.test(after) ? nx[0].toLowerCase() : null };
}

/** Evidência de CONTEXTO da palavra (0 = sem dado — o modelo só guarda as sucessoras mais comuns, então "sem dado" não é "não combina"). */
export function evidenciaDeContexto(model: LangModel, prev: string[], next: string | null, word: string): number {
  const id = model.idOf.get(word);
  if (id === undefined || id < 3) return 0;
  const ids = prev.map((w) => model.idOf.get(w) ?? -1);
  const c2 = prev.length ? ids[ids.length - 1] : START;
  const c1 = prev.length > 1 ? ids[0] : START;
  const tri = c2 >= 0 && c1 >= 0 ? model.trigram(prev.length > 1 ? c1 : START, c2) : { succ: [], total: 0 };
  const bi = c2 >= 0 ? model.bigram(c2) : { succ: [], total: 0 };
  const p3 = tri.total ? (tri.succ.find((s) => s.id === id)?.count ?? 0) / tri.total : 0;
  const p2 = bi.total ? (bi.succ.find((s) => s.id === id)?.count ?? 0) / bi.total : 0;
  let ev = 0.55 * p3 + 0.45 * p2;
  if (next) {
    const nid = model.idOf.get(next);
    if (nid !== undefined) {
      const b = model.bigram(id);
      if (b.total) ev += 0.25 * ((b.succ.find((x) => x.id === nid)?.count ?? 0) / b.total);
    }
  }
  return ev;
}

/** Contexto + o que a pessoa escreve (usa mais, sugere mais). */
export function evidence(model: LangModel, doc: DocumentIndex | null, prev: string[], next: string | null, word: string): number {
  // o que a pessoa escreve: usa mais, sugere mais
  const seen = (personalIndex.wordFreq.get(word) ?? 0) + (doc?.wordFreq.get(word) ?? 0);
  return evidenciaDeContexto(model, prev, next, word) + 0.03 * Math.log1p(seen);
}

/** Piso de evidência de CONTEXTO para o rerank mexer na ordem (abaixo disto é ruído). */
export const PISO_CONTEXTO = 0.06;

/** Quantas vezes a evidência da candidata precisa superar a do 1º do dicionário. */
export const FATOR_CONTEXTO = 3;

/** Margem fixa somada ao fator (evita promover quando o 1º do dicionário tem ~nada). */
export const MARGEM_CONTEXTO = 0.02;

/**
 * A ordem final das sugestões, dada a evidência de contexto e os bônus de cada uma.
 * Pura, para o teste provar a régua sem o modelo inteiro:
 *   • quem manda é o contexto — o candidato com o maior total (contexto + bônus) é o
 *     escolhido, mas ele só PROMOVE se o contexto dele for claro: piso próprio e pelo
 *     menos `FATOR_CONTEXTO` vezes o contexto do 1º do dicionário, mais a margem.
 *   • sem isso, a ordem do dicionário fica como está (o corretor não chuta).
 */
export function ordemPorContexto(suggestions: string[], ctx: number[], bonus: number[]): string[] {
  if (suggestions.length < 2 || ctx.length !== suggestions.length) return suggestions;
  let best = 0;
  suggestions.forEach((_, i) => {
    if (ctx[i] + (bonus[i] ?? 0) > ctx[best] + (bonus[best] ?? 0)) best = i;
  });
  if (best === 0) return suggestions;
  if (ctx[best] < PISO_CONTEXTO) return suggestions;
  if (ctx[best] < FATOR_CONTEXTO * ctx[0] + MARGEM_CONTEXTO) return suggestions;
  return [suggestions[best], ...suggestions.filter((_, i) => i !== best)];
}

/**
 * Devolve as sugestões do corretor, com a que o contexto mais sustenta na frente — quando (e só
 * quando) a evidência de contexto é clara. A régua está em `ordemPorContexto`; a medição de
 * `docs/medicao-corretor.md` mostrou que promoção por contexto fraco fazia o corretor perder
 * acerto ("messmo" → "mesh", "revissão" → "previsão"): por isso o piso e o fator são altos.
 */
export function rerankSuggestions(text: string, from: number, to: number, suggestions: string[], doc: DocumentIndex | null = null): string[] {
  const model = getLanguageModel();
  if (!model || suggestions.length < 2) return suggestions;
  const { prev, next } = ctxWords(text, from, to);
  const errado = text.slice(from, to);
  const ctx = suggestions.map((s) => evidenciaDeContexto(model, prev, next, s.toLowerCase()));
  const bonus = suggestions.map((s) => bonusDaClasse(errado, s) + 0.03 * Math.log1p((personalIndex.wordFreq.get(s.toLowerCase()) ?? 0) + (doc?.wordFreq.get(s.toLowerCase()) ?? 0)));
  return ordemPorContexto(suggestions, ctx, bonus);
}
