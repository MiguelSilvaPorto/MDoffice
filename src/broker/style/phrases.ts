// Expressões que soam melhor de outro jeito.

import type { RuleCtx } from "./types";
import { PHRASES, INTRO_CONNECTIVES } from "../data/phrases";

/** Expressões que soam melhor de outro jeito. */
export function phrases({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // expressões
  for (const phrase of PHRASES) {
    phrase.rx.lastIndex = 0;
    while ((m = phrase.rx.exec(mask)) !== null) {
      push(m.index, m.index + m[0].length, phrase.message, phrase.fix, [phrase.fix]);
    }
  }
}
