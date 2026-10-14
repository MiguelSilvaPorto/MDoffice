// Política da correção automática: decide, numa varredura, o que pode ser aplicado sozinho.
// Puro (não toca no editor): o app chama e aplica o resultado numa única transação.

import { checkStyle } from "./style";
import type { WritingIssue } from "./types";

export interface CorrecaoAuto {
  from: number;
  to: number;
  insert: string;
}

export interface CtxVarredura {
  /** posição do cursor */
  pos: number;
  /** limites da varredura (documento inteiro na pausa; um parágrafo no gatilho de parágrafo) */
  from: number;
  to: number;
  /** parágrafo em que o cursor está (para decidir o ponto final) */
  parFrom: number;
  parTo: number;
  /** o parágrafo em foco está concluído? (cursor no fim dele / parágrafo acima já fechado) */
  parConcluido: boolean;
}

/**
 * O que a correção automática pode aplicar sozinha numa varredura:
 * - nunca toca a palavra sob o cursor;
 * - nunca reestrutura frase (classes "quebra-frase", "trecho-longo" e "frase-longa":
 *   só pelo aviso ou “Corrigir tudo”);
 * - o ponto final (classe "ponto-final") só entra no parágrafo do cursor quando ele está concluído.
 */
export function planejarVarredura(text: string, ctx: CtxVarredura): CorrecaoAuto[] {
  const out: CorrecaoAuto[] = [];
  for (const i of checkStyle(text) as WritingIssue[]) {
    if (i.fix === undefined) continue;
    if (i.from < ctx.from || i.to > ctx.to) continue;
    if (i.from < ctx.pos && ctx.pos < i.to) continue; // dentro da palavra sob o cursor: não se mexe
    if (i.classe === "quebra-frase" || i.classe === "trecho-longo" || i.classe === "frase-longa") continue; // reestruturar frase só quando a pessoa pede
    if (i.classe === "ponto-final" && i.from >= ctx.parFrom && i.to <= ctx.parTo && !ctx.parConcluido) continue;
    out.push({ from: i.from, to: i.to, insert: i.fix });
  }
  return out;
}
