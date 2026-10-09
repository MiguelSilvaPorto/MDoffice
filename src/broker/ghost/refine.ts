// A IA local ajuda a escolher a sugestão enquanto se digita.
//
// Quando a pessoa faz uma pausa curta no MEIO de uma palavra ("resulta|"), o n-grama já deu os melhores candidatos
// ("resultados", "resultado", "resultar"…) e a IA lê o começo da frase e diz qual combina mais. No teste (texto de
// escritório, 3 letras digitadas), o n-grama sozinho acerta 45% na primeira escolha e com a IA 71%; só mostrando quando a
// IA tem 70% de certeza ou mais, acerta 85% e ainda mostra em 80% dos casos.
//
// Só vale a pena para completar palavra: para a PRÓXIMA palavra a IA não é precisa o bastante (mesmo com 90% de certeza
// acerta 38%), então ali a sugestão continua só do n-grama.
//
// Custos: precisa da IA local e da GPU; uma chamada curta por pausa; se não houver IA, nada muda.

import type { DocumentIndex } from "./documentIndex";
import type { GhostSuggestion } from "./types";
import { candidatesAt, completionSuffix, minSuffixChars } from "./predict";
import { scoreSentences } from "../llm/client";
import { llmTypingOn } from "../llm/config";

export const REFINE = {
  /** peso da IA na mistura com o n-grama (0 = só n-grama, 1 = só IA) */
  alpha: 0.75,
  /** certeza mínima (0–1) para a IA mandar na sugestão */
  minQ: 0.7,
  /** quantas candidatas o n-grama entrega para a IA escolher */
  k: 6,
  /** quanto do texto antes da palavra a IA lê (letras) */
  ctxChars: 110,
  /** certeza mínima para uma alternativa aparecer (Alt+Seta) */
  altQ: 0.12,
  /** só refina com pelo menos isto de letras digitadas na palavra */
  minPrefix: 2,
  /** pausa (ms) sem digitar antes de pedir à IA */
  pauseMs: 450,
};

/** Só uma consulta à IA por vez: uma nova pausa não empilha trabalho enquanto a anterior roda. */
let busy = false;

/** O trecho do texto que a IA lê: as últimas letras antes da palavra, começando numa palavra inteira. */
function trimContext(context: string): string {
  if (context.length <= REFINE.ctxChars) return context;
  const t = context.slice(-REFINE.ctxChars);
  const sp = t.indexOf(" ");
  return sp > 0 ? t.slice(sp + 1) : t;
}

/**
 * Pede à IA para escolher entre as candidatas do n-grama no ponto do cursor.
 * Devolve a sugestão melhorada, ou null se não há o que mudar (IA indisponível, pouca certeza, mesma sugestão que já aparece).
 * `before` é o texto da linha até o cursor; `current` é a sugestão que aparece agora.
 */
export async function refineSuggestion(before: string, pos: number, index: DocumentIndex, current: GhostSuggestion | null): Promise<GhostSuggestion | null> {
  if (busy || !llmTypingOn()) return null;
  const pt = candidatesAt(before, index, REFINE.k);
  if (!pt || pt.mode !== "prefix" || !pt.prefix || pt.prefix.length < REFINE.minPrefix || pt.list.length < 2) return null;
  const ctx = trimContext(pt.context);
  busy = true;
  let scores: number[] | null;
  try {
    scores = await scoreSentences(pt.list.map((c) => ctx + c.word));
  } finally {
    busy = false;
  }
  if (!scores) return null;

  // mistura log-linear: IA (alpha) + n-grama; depois vira probabilidade entre as candidatas
  const v = pt.list.map((c, i) => REFINE.alpha * scores![i] + (1 - REFINE.alpha) * Math.log(Math.max(c.p, 1e-9)));
  const mx = Math.max(...v);
  const e = v.map((x) => Math.exp(x - mx));
  const z = e.reduce((a, b) => a + b, 0);
  const ranked = pt.list.map((c, i) => ({ c, q: e[i] / z })).sort((a, b) => b.q - a.q);

  const best = ranked[0];
  if (best.q < REFINE.minQ) return null; // a IA não tem certeza: fica a sugestão do n-grama como estava
  const min = minSuffixChars();
  const texts: { text: string; lc: string }[] = [];
  for (const r of ranked) {
    if (r !== best && r.q < REFINE.altQ) break;
    const suffix = completionSuffix(pt.prefix, r.c);
    if (suffix.length < min) {
      if (r === best) return null; // faltam poucas letras: a pessoa termina digitando
      continue;
    }
    texts.push({ text: suffix, lc: r.c.lc });
    if (texts.length >= 3) break;
  }
  if (!texts.length) return null;
  // já é essa a sugestão que está aparecendo: nada a trocar
  if (current && !current.replace && current.text === texts[0].text && (current.alts?.length ?? 1) === texts.length) return null;
  return {
    text: texts[0].text,
    pos,
    alts: texts.map((t) => t.text),
    altWords: texts.map((t) => t.lc),
    prev: pt.prev,
    mode: "prefix",
    alt: 0,
  };
}
