// Operações sobre uma sugestão (usadas pelo editor Markdown e pelo do Word): consumir o que foi digitado e alternar opções.

import { type GhostSuggestion } from "./types";
import type { Outcome } from "../personal/feedback";

/** A pessoa digitou `typed` exatamente onde a sugestão estava: o que sobra da sugestão (ou null se acabou/não bate). */
export function consumeTyped(s: GhostSuggestion, typed: string): GhostSuggestion | null {
  if (s.replace) return null; // correção: qualquer letra nova a invalida
  const low = typed.toLowerCase();
  if (!typed || !s.text.toLowerCase().startsWith(low)) return null;
  const rest = s.text.slice(typed.length);
  if (!rest) return null;
  const pos = s.pos + typed.length;
  if (!s.alts) return { text: rest, pos, prev: s.prev, mode: s.mode };
  // as alternativas que continuam batendo com o que foi digitado
  const keep = s.alts.map((a, i) => i).filter((i) => s.alts![i].toLowerCase().startsWith(low) && s.alts![i].length > typed.length);
  const alts = keep.map((i) => s.alts![i].slice(typed.length));
  const altWords = s.altWords ? keep.map((i) => s.altWords![i]) : undefined;
  const alt = Math.max(0, alts.indexOf(rest));
  return { text: rest, pos, alts: alts.length ? alts : undefined, alt, altWords: alts.length ? altWords : undefined, prev: s.prev, mode: s.mode };
}

/** Troca para a próxima (dir = 1) ou anterior (dir = -1) opção. */
export function cycleSuggestion(s: GhostSuggestion, dir: 1 | -1): GhostSuggestion {
  if (!s.alts || s.alts.length < 2) return s;
  const n = s.alts.length;
  const alt = (((s.alt ?? 0) + dir) % n + n) % n;
  return { ...s, text: s.alts[alt], alt };
}

/** Indicador "2/3" quando há mais de uma opção. */
export function altLabel(s: GhostSuggestion): string | null {
  return s.alts && s.alts.length > 1 ? `${(s.alt ?? 0) + 1}/${s.alts.length}` : null;
}

/** O que aprender quando a pessoa aceita ou descarta a sugestão que está aparecendo. */
export function outcomeOf(s: GhostSuggestion): Outcome | null {
  const word = s.altWords?.[s.alt ?? 0];
  if (!word || !s.prev || !s.mode) return null;
  return { prev: s.prev, word, mode: s.mode };
}

/**
 * O par "o que estava escrito → o que o app propôs" de uma sugestão de CORREÇÃO
 * (o texto fantasma que troca a palavra recém-digitada), ou null quando não é correção.
 * `trecho` é o texto que a sugestão substitui, lido do documento antes da mudança
 * (`cur.pos - replace` até `cur.pos`).
 */
export function parDaCorrecao(s: GhostSuggestion, trecho: string): [string, string] | null {
  if (!s.replace) return null;
  const errado = trecho.trim();
  const certo = s.text.trim();
  if (!errado || !certo || errado.toLowerCase() === certo.toLowerCase()) return null;
  return [errado, certo];
}
