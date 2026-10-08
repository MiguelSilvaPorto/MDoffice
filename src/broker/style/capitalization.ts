// Maiúsculas no começo de frases e parágrafos.

import type { RuleCtx } from "./types";

/** Frase começando com minúscula. */
export function lowercaseAfterPeriod({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // frases começando com minúscula (depois de . ! ?)
  const lowerAfterRx = /([.!?])\s+([a-záàâãéêíóôõúç][\p{L}]*)/gu;
  while ((m = lowerAfterRx.exec(mask)) !== null) {
    const before = mask.slice(Math.max(0, m.index - 4), m.index + 1);
    if (/\b(etc|ex|pág|sr|sra|dr|dra|vs)\.$/i.test(before)) continue;
    const word = m[2];
    const start = m.index + m[1].length + m[0].slice(m[1].length).search(/\S/);
    push(start, start + word.length, "Comece a frase com maiúscula", word[0].toUpperCase() + word.slice(1), [], true);
  }
}

/** Início do texto ou de parágrafo com minúscula. */
export function paragraphStartLowercase({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // início do texto ou de um parágrafo começando com minúscula
  const paraStartRx = /(^|\n[^\S\n]*\n)[^\S\n]*(["“'«(]?)([a-záàâãéêíóôõúç][\p{L}]*)/gu;
  while ((m = paraStartRx.exec(mask)) !== null) {
    const word = m[3];
    const start = m.index + m[0].length - word.length;
    push(start, start + word.length, "Comece o parágrafo com maiúscula", word[0].toUpperCase() + word.slice(1), [], true);
  }
}
