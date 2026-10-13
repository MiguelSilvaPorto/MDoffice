// Concordância verbal: casos em que o verbo não acompanha o sujeito.
//
// Só entram aqui as regras em que a forma certa é determinada pela ESTRUTURA da
// frase, sem depender de sentido nem de vocabulário — por isso dá para aplicá-las
// com segurança e explicar cada uma.

import type { RuleCtx } from "./types";

/**
 * "Fazem dois anos que..." → "Faz dois anos que...".
 *
 * O verbo "fazer" indicando TEMPO DECORRIDO é impessoal: fica sempre na terceira
 * pessoa do singular, mesmo com quantidade no plural. É diferente de "eles fazem
 * dois anos de curso", em que "fazer" tem sujeito e concorda com ele — por isso a
 * regra só dispara quando a quantidade vem logo depois do verbo e é seguida de
 * uma unidade de tempo, que é a construção impessoal.
 */
export function fazerImpessoal({ mask, push }: RuleCtx): void {
  const unidades = "ano|anos|mês|meses|dia|dias|semana|semanas|hora|horas|minuto|minutos|década|décadas";
  const quantidades = "um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|cinquenta|cem|cento|mil|\\d+";
  const rx = new RegExp(`(?<![\\p{L}])(fazem)(\\s+(?:${quantidades})\\s+(?:${unidades}))(?![\\p{L}])`, "giu");
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    const verbo = m[1];
    const resto = m[2];
    const correcao = `faz${resto}`;
    push(
      m.index,
      m.index + m[0].length,
      `“${verbo}” com tempo decorrido fica no singular: “${correcao}” (o verbo não tem sujeito aqui)`,
      correcao,
      [correcao]
    );
  }
}
