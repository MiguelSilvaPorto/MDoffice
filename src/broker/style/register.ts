// Registro (formal, neutro, informal) e “a gente”.

import type { RuleCtx } from "./types";
import { INFORMAL } from "../data/informal";
import { getTone } from "../tone";
import { aGenteFix } from "../data/aGente";

/** Registro informal → formal (respeita o tom). */
export function informalRegister({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // registro informal → formal
  for (const rule of getTone() === "informal" ? [] : INFORMAL) {
    if (getTone() === "neutro" && !rule.fix) continue;
    rule.rx.lastIndex = 0;
    while ((m = rule.rx.exec(mask)) !== null) {
      push(m.index, m.index + m[0].length, rule.message, rule.fix, rule.suggestion ? [rule.suggestion] : []);
    }
  }
}

/** “a gente” + verbo: corrige a frase inteira. */
export function aGente({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // “a gente” + verbo: corrige a frase inteira, com o verbo na pessoa certa
  const aGenteRx = /(?<![\p{L}])(a gente|A gente)([^\S\n]+([\p{L}]+))?/gu;
  while (getTone() === "formal" && (m = aGenteRx.exec(mask)) !== null) {
    const phrase = m[1];
    const verb = m[3];
    const quem = phrase[0] === "A" ? "Nós" : "nós";
    const plural = verb ? aGenteFix(verb) : null;
    if (verb && plural) {
      push(
        m.index,
        m.index + m[0].length,
        `“${phrase} ${verb}” é informal — em texto formal fica “${quem} ${plural}” (mesmo sentido)`,
        `${quem} ${plural}`,
        [`${quem} ${plural}`],
        true
      );
    } else {
      push(
        m.index,
        m.index + phrase.length,
        `“${phrase}” é informal — em texto formal use “${quem}” (ajuste o verbo)`,
        undefined,
        [],
        false
      );
    }
  }
}
