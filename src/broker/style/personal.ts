// Regras que usam o perfil de escrita da PESSOA (aprendido dos documentos dela), em vez de limites fixos.

import { profileSummary } from "../personal/profile";
import type { RuleCtx } from "./types";

/** Frase bem mais longa do que a pessoa costuma escrever. */
export function personalLongSentence({ mask, push }: RuleCtx): void {
  const prof = profileSummary();
  if (!prof.ready) return;
  const limit = Math.max(prof.p90 + 15, 32);
  const rx = /[^.!?…\n]+[.!?…]*/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    const sent = m[0];
    const n = (sent.match(/[\p{L}][\p{L}'-]*/gu) ?? []).length;
    if (n <= limit) continue;
    const start = m.index + (sent.length - sent.trimStart().length);
    push(
      start,
      start + Math.min(sent.trim().length, 40),
      `Frase de ${n} palavras — bem mais longa que o seu normal (você costuma escrever ${Math.round(prof.avgSentence)} por frase, e 90% das suas têm até ${prof.p90}). Que tal dividir em duas?`,
      undefined,
      [],
      false
    );
  }
}
