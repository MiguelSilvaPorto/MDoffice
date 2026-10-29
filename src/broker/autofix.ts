// Política da correção automática: decide, numa varredura, o que pode ser aplicado sozinho.
// Puro (não toca no editor): o app chama e aplica o resultado numa única transação.

import { diag, janelaDe } from "./diag";
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
 * Marcadores de registro (gíria, internetês, contração, muleta…): são ESCOLHA de quem
 * escreve, não erro de forma. A varredura automática nunca os aplica — ficam como
 * sugestão no painel e no aviso. Era daqui que saía a "correção lixo" (“pra” → “para”,
 * “a gente teve” → “nós tivemos”) no meio da digitação.
 */
const CLASSES_REGISTRO = new Set(["giria", "internetes", "contracao", "muleta", "oralidade", "atenuacao", "redundancia", "vagueza", "cliche"]);

/**
 * O que a correção automática pode aplicar sozinha numa varredura:
 * - nunca toca a palavra sob o cursor;
 * - nunca reestrutura frase (classes "quebra-frase", "trecho-longo" e "frase-longa":
 *   só pelo aviso ou “Corrigir tudo”);
 * - o ponto final (classe "ponto-final") só entra no parágrafo do cursor quando ele está concluído.
 *
 * Cada decisão (aplicada ou barrada, com o motivo) vai para o log de diagnóstico quando ele está
 * ligado — é o que responde "por que o corretor tentou mexer nisso?".
 */
export function planejarVarredura(text: string, ctx: CtxVarredura): CorrecaoAuto[] {
  const out: CorrecaoAuto[] = [];
  for (const i of checkStyle(text) as WritingIssue[]) {
    if (i.fix === undefined) continue;
    const base = {
      gatilho: "pausa" as const,
      tipo: i.kind,
      regra: i.message,
      from: i.from,
      to: i.to,
      palavra: i.word,
      safe: i.safe,
      auto: i.auto,
      fix: i.fix,
      sugestao: i.suggestions[0],
      janela: janelaDe(text, i.from, i.to),
    };
    if (i.from < ctx.from || i.to > ctx.to) {
      diag({ ...base, veredito: "ignorado", motivo: "fora do trecho desta varredura" });
      continue;
    }
    if (i.from < ctx.pos && ctx.pos < i.to) {
      diag({ ...base, veredito: "ignorado", motivo: "a palavra sob o cursor nunca é tocada (pode estar pela metade)" });
      continue;
    }
    if (i.classe === "quebra-frase" || i.classe === "trecho-longo" || i.classe === "frase-longa") {
      diag({ ...base, veredito: "ignorado", motivo: `classe ${i.classe}: reestruturar frase só pelo aviso/“Corrigir tudo”` });
      continue;
    }
    if (i.classe && CLASSES_REGISTRO.has(i.classe)) {
      diag({ ...base, veredito: "ignorado", motivo: `registro (${i.classe}): é escolha de quem escreve, fica como sugestão` });
      continue;
    }
    if (i.classe === "escolha") {
      diag({ ...base, veredito: "ignorado", motivo: "sugestão de leitura/estilo: fica no aviso, não entra sozinha" });
      continue;
    }
    if (i.classe === "ponto-final" && i.from >= ctx.parFrom && i.to <= ctx.parTo && !ctx.parConcluido) {
      diag({ ...base, veredito: "ignorado", motivo: "parágrafo em digitação: o ponto só entra quando ele acaba" });
      continue;
    }
    if (i.classe === "ponto-final") {
      // O ponto entra como INSERÇÃO no fim da palavra, não como troca dela: assim ele
      // convive com outro aviso no mesmo trecho (o "app" internetês, por exemplo) sem
      // sumir — e sem apagar a palavra que a outra regra ainda vai decidir.
      diag({ ...base, veredito: "aplicado", motivo: "insere o ponto final do parágrafo" });
      out.push({ from: i.to, to: i.to, insert: "." });
      continue;
    }
    diag({ ...base, veredito: "aplicado", motivo: `vira “${i.fix}”` });
    out.push({ from: i.from, to: i.to, insert: i.fix });
  }
  return out;
}
