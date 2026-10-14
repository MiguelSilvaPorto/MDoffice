// Registro (formal, neutro, informal): o catálogo informal → formal.
//
// Quem decide o que aparece é o TOM (tone.ts): cada padrão do catálogo declara o tom
// mínimo em que aparece — "neutro" para o caso claro ("pra" → "para") e "formal" para
// o que é opinião de estilo ("acho que" → "considera-se que"). O tom "informal" não
// opina sobre registro. Citações (`>`), siglas em caixa alta e e-mails ficam de fora.

import { INFORMAL } from "../data/informal";
import { getTone, type Tone } from "../tone";
import { abreFrase, emCitacao } from "./formalidade";
import type { RuleCtx } from "./types";

/** Nível de exigência: o padrão aparece quando o tom atual é pelo menos o mínimo dele. */
const NIVEL_TOM: Record<Tone, number> = { informal: 0, neutro: 1, formal: 2 };

/** Sigla em caixa alta (TB, PQ, VC…): quem escreve está abreviando outra coisa, não escrevendo internetês. */
const SIGLA = /^[\p{Lu}\d]{2,5}$/u;

/** O trecho está colado num arroba? (a máscara cobre URLs, mas não e-mails) */
function emEmail(mask: string, from: number, to: number): boolean {
  return mask[from - 1] === "@" || mask[to] === "@";
}

/** Registro informal → formal (catálogo por classe e por tom). */
export function informalRegister({ mask, push }: RuleCtx): void {
  const nivel = NIVEL_TOM[getTone()];
  if (nivel === 0) return; // informal não mexe no registro
  let m: RegExpExecArray | null;
  for (const rule of INFORMAL) {
    if (NIVEL_TOM[rule.tom] > nivel) continue;
    rule.rx.lastIndex = 0;
    while ((m = rule.rx.exec(mask)) !== null) {
      const from = m.index;
      const to = from + m[0].length;
      if (emCitacao(mask, from)) continue;
      if (emEmail(mask, from, to)) continue;
      if (rule.classe === "internetes" && SIGLA.test(m[0])) continue;
      // no começo da frase a troca já sai com maiúscula (a regra de maiúsculas
      // cuidaria só da palavra, e as duas entrariam em conflito no mesmo trecho)
      const inicio = abreFrase(mask, from);
      const fix = rule.fix ? (inicio ? rule.fix[0].toUpperCase() + rule.fix.slice(1) : rule.fix) : undefined;
      const sugestoes = (rule.sugestoes ?? []).map((s) => (inicio ? s[0].toUpperCase() + s.slice(1) : s));
      push(from, to, rule.message, fix, sugestoes, false, rule.classe);
    }
  }
}
