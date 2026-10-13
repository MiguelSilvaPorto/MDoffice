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

/** Quanto o contexto sustenta esta palavra (0 = sem evidência — o modelo só guarda as sucessoras mais comuns, então "sem dado" não é "não combina"). */
export function evidence(model: LangModel, doc: DocumentIndex | null, prev: string[], next: string | null, word: string): number {
  const id = model.idOf.get(word);
  let ev = 0;
  if (id !== undefined && id >= 3) {
    const ids = prev.map((w) => model.idOf.get(w) ?? -1);
    const c2 = prev.length ? ids[ids.length - 1] : START;
    const c1 = prev.length > 1 ? ids[0] : START;
    const tri = c2 >= 0 && c1 >= 0 ? model.trigram(prev.length > 1 ? c1 : START, c2) : { succ: [], total: 0 };
    const bi = c2 >= 0 ? model.bigram(c2) : { succ: [], total: 0 };
    const p3 = tri.total ? (tri.succ.find((s) => s.id === id)?.count ?? 0) / tri.total : 0;
    const p2 = bi.total ? (bi.succ.find((s) => s.id === id)?.count ?? 0) / bi.total : 0;
    ev += 0.55 * p3 + 0.45 * p2;
    if (next) {
      const nid = model.idOf.get(next);
      if (nid !== undefined) {
        const b = model.bigram(id);
        ev += 0.25 * (b.total ? (b.succ.find((x) => x.id === nid)?.count ?? 0) / b.total : 0);
      }
    }
  }
  // o que a pessoa escreve: usa mais, sugere mais
  const seen = (personalIndex.wordFreq.get(word) ?? 0) + (doc?.wordFreq.get(word) ?? 0);
  return ev + 0.03 * Math.log1p(seen);
}

/**
 * Devolve as sugestões do corretor, com a que o contexto mais sustenta na frente — mas só quando a evidência é clara:
 * a melhor pelo contexto precisa ter sustentação própria e pelo menos o dobro da que o dicionário pôs em primeiro.
 * Sem evidência, a ordem do dicionário fica como está. A classe do erro só desempata (±0,03): sozinha não promove.
 */
export function rerankSuggestions(text: string, from: number, to: number, suggestions: string[], doc: DocumentIndex | null = null): string[] {
  const model = getLanguageModel();
  if (!model || suggestions.length < 2) return suggestions;
  const { prev, next } = ctxWords(text, from, to);
  const errado = text.slice(from, to);
  const ev = suggestions.map((s) => evidence(model, doc, prev, next, s.toLowerCase()) + bonusDaClasse(errado, s));
  let best = 0;
  ev.forEach((v, i) => {
    if (v > ev[best]) best = i;
  });
  if (best === 0 || ev[best] < 0.03 || ev[best] < 2 * ev[0] + 0.01) return suggestions;
  return [suggestions[best], ...suggestions.filter((_, i) => i !== best)];
}
