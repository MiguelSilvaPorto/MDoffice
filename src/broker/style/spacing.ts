// Espaços e pontuação: abreviações, repetições, espaços duplos e colados.

import type { RuleCtx } from "./types";
import { ABBREVIATIONS, GLUED } from "../data/abbreviations";

/** Abreviações de internet e palavras coladas (“derrepente”). */
export function abbreviationsAndGlued({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  const wordRx = /[\p{L}]+/gu;
  while ((m = wordRx.exec(mask)) !== null) {
    const raw = m[0];
    const lower = raw.toLowerCase();
    const replacement = ABBREVIATIONS[lower];
    if (replacement && raw === lower) {
      push(m.index, m.index + raw.length, `“${raw}” → “${replacement}” (abreviação de internet)`, replacement, [replacement], true);
      continue;
    }
    const glued = GLUED[lower];
    if (glued && glued !== lower && raw === lower) {
      push(m.index, m.index + raw.length, `“${raw}” parece junto — escreva “${glued}”`, glued, [glued], true);
    }
  }
}

/** Palavras repetidas (“de de”). */
export function repeatedWords({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // palavras repetidas (“de de”)
  const repeatRx = /\b([\p{L}]{2,})\s+\1\b/giu;
  while ((m = repeatRx.exec(mask)) !== null) {
    const whole = m[0];
    const single = m[1];
    push(m.index, m.index + whole.length, `Repetição: “${single} ${single}”`, single, [single], true);
  }
}

/** Espaços duplos. */
export function doubleSpaces({ text, mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // espaços duplos
  const doubleSpaceRx = /[^\S\n]{2,}/g;
  while ((m = doubleSpaceRx.exec(mask)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    const after = /^[\p{L}\d]+/u.exec(text.slice(end))?.[0];
    if (after) {
      // inclui a palavra seguinte para o aviso ficar visível e substituível
      push(start, end + after.length, "Espaços extras", ` ${after}`, [], true);
    } else if (start > 0) {
      push(start - 1, end, "Espaços extras", text.slice(start - 1, start), [], true);
    }
  }
}

/** Espaço antes de pontuação. */
export function spaceBeforePunct({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // espaço antes de pontuação
  const spaceBeforeRx = /\s+([,.;:!?])/g;
  while ((m = spaceBeforeRx.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, `Espaço antes de “${m[1]}”`, m[1], [], true);
  }
}

/** Falta de espaço depois de vírgula, ponto e vírgula e dois-pontos. */
export function spaceAfterPunct({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // falta de espaço depois da pontuação
  const noSpaceRx = /([,;:])(?=[\p{L}])/gu;
  while ((m = noSpaceRx.exec(mask)) !== null) {
    push(m.index, m.index + 1, `Falta um espaço depois de “${m[1]}”`, `${m[1]} `, [], true);
  }
}

/** Falta de espaço depois de . ! ? (“fim.Começo”). */
export function spaceAfterSentence({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // falta de espaço depois de . ! ? quando a próxima frase começa em maiúscula ("fim.Começo", "oi!Tudo")
  const semEspacoFim = /(?<=[\p{Ll}\d)”"])([.!?])(?=[\p{Lu}])/gu;
  while ((m = semEspacoFim.exec(mask)) !== null) {
    // siglas e abreviações com ponto (S.A., U.S.A.) não entram: a letra antes do ponto é maiúscula ali
    push(m.index, m.index + 1, `Falta um espaço depois de “${m[1]}”`, `${m[1]} `, [], true);
  }
}

/** Pontuação repetida (!!! / ???). */
export function repeatedPunct({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // pontuação repetida (!!! / ???)
  const repeatedPunct = /([!?])\1{2,}/g;
  while ((m = repeatedPunct.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, "Pontuação repetida demais", m[1], [], true);
  }
}
