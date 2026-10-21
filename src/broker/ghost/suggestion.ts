// Operações sobre uma sugestão (usadas pelo editor Markdown e pelo do Word): consumir o que foi digitado e alternar opções.

import { type GhostSuggestion } from "./types";
import type { Outcome } from "../personal/feedback";

/** A pessoa digitou `typed` exatamente onde a sugestão estava: o que sobra da sugestão (ou null se acabou/não bate). */
export function consumeTyped(s: GhostSuggestion, typed: string): GhostSuggestion | null {
  if (s.replace) return null; // correção: qualquer letra nova a invalida
  const low = typed.toLowerCase();
  if (!typed) return null;
  // a parte firme já acabou: o que a pessoa digita vai comendo o palpite (" final" → "final")
  if (!s.text) {
    if (!s.extra || !s.extra.toLowerCase().startsWith(low)) return null;
    const restoDoPalpite = s.extra.slice(typed.length);
    return restoDoPalpite.trim() ? { text: "", extra: restoDoPalpite, pos: s.pos + typed.length } : null;
  }
  if (!s.text.toLowerCase().startsWith(low)) return null;
  const rest = s.text.slice(typed.length);
  const pos = s.pos + typed.length;
  // digitou a palavra inteira à mão: o palpite das próximas continua na tela
  if (!rest) return s.extra ? { text: "", extra: s.extra, pos } : null;
  if (!s.alts) return { text: rest, pos, extra: s.extra, prev: s.prev, mode: s.mode };
  // as alternativas que continuam batendo com o que foi digitado
  const keep = s.alts.map((a, i) => i).filter((i) => s.alts![i].toLowerCase().startsWith(low) && s.alts![i].length > typed.length);
  const alts = keep.map((i) => s.alts![i].slice(typed.length));
  const altWords = s.altWords ? keep.map((i) => s.altWords![i]) : undefined;
  const extras = s.extras ? keep.map((i) => s.extras![i]) : undefined;
  const alt = Math.max(0, alts.indexOf(rest));
  return { text: rest, pos, extra: s.extra, alts: alts.length ? alts : undefined, extras: alts.length ? extras : undefined, alt, altWords: alts.length ? altWords : undefined, prev: s.prev, mode: s.mode };
}

/** Troca para a próxima (dir = 1) ou anterior (dir = -1) opção. */
export function cycleSuggestion(s: GhostSuggestion, dir: 1 | -1): GhostSuggestion {
  if (!s.alts || s.alts.length < 2) return s;
  const n = s.alts.length;
  const alt = (((s.alt ?? 0) + dir) % n + n) % n;
  return { ...s, text: s.alts[alt], extra: s.extras?.[alt], alt };
}

/** O que o Tab insere e o que fica na tela depois dele. */
export interface Aceite {
  insert: string;
  /** o que sobra da sugestão (posição relativa: começa logo depois do que foi inserido) */
  rest: { text: string; extra?: string } | null;
  /**
   * a palavra que a sugestão propunha entrou (conta como aceite no aprendizado). Só a sugestão
   * original guarda `prev`/`mode`, e a primeira palavra dela é sempre a primeira a entrar.
   */
  primeiraInteira: boolean;
}

/**
 * Tab: aceita a parte firme. O palpite das próximas palavras fica na tela para a seta para a
 * direita. Sem parte firme (só sobrou o palpite), o Tab aceita a próxima palavra do palpite.
 */
export function aceiteDoTab(s: GhostSuggestion): Aceite | null {
  if (!s.text) return aceiteDaPalavra(s);
  return { insert: s.text, rest: s.extra?.trim() && !s.replace ? { text: "", extra: s.extra } : null, primeiraInteira: true };
}

/**
 * Seta para a direita (e Ctrl/Alt+Seta): aceita só a próxima palavra — da parte firme e, quando
 * ela acaba, do palpite. A palavra entra com o espaço da frente ("tado", depois " final").
 */
export function aceiteDaPalavra(s: GhostSuggestion): Aceite | null {
  if (s.replace) return aceiteDoTab({ ...s, extra: undefined });
  const firme = s.text;
  const m = /^\s*\S+/.exec(firme || s.extra || "");
  if (!m) return null;
  const insert = m[0];
  if (firme) {
    const resto = firme.slice(insert.length);
    const sobra = resto || s.extra?.trim() ? { text: resto, extra: s.extra } : null;
    return { insert, rest: sobra, primeiraInteira: true };
  }
  const resto = (s.extra ?? "").slice(insert.length);
  return { insert, rest: resto.trim() ? { text: "", extra: resto } : null, primeiraInteira: false };
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
