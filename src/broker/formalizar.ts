// Formalizar o texto: o plano de trocas do registro informal → formal, com o risco de cada uma.
//
// O catálogo (`data/informal.ts`) e as regras de janela (`style/formalidade.ts`) já sabem ACHAR
// os marcadores; o que faltava era a operação de formalizar o texto inteiro de uma vez, mostrando
// antes/depois e deixando as trocas que dependem de sentido para o usuário decidir.
//
// O risco sai da mesma régua que o `stats.ts` já usa no MIP:
//   • "segura"  — o aviso tem correção pronta (`fix`): aplicar não muda o sentido;
//   • "sentido" — só há sugestões: a troca depende do contexto (mostra o risco e as alternativas);
//   • "manual"  — não há troca pronta (o aviso pede reformular): aparece na lista, sem caixa.
//
// Nada aqui conhece a interface: quem monta a janela é o `src/formalizar.ts`, e quem aplica ao
// documento é o app. Também não depende do tom escolhido: formalizar É sobre registrar — a
// varredura força o tom formal (como `marcadoresInformais`) e devolve o tom de antes.

import { achadosInformais, stats } from "./stats";
import type { ClasseMarcador, WritingIssue } from "./types";

export type RiscoTroca = "segura" | "sentido" | "manual";

export interface TrocaFormal {
  from: number;
  to: number;
  /** o trecho como está no texto */
  de: string;
  /** como fica (ausente quando o risco é "manual": o aviso não traz troca pronta) */
  para?: string;
  /** outras formas possíveis para a mesma troca (só no risco "sentido") */
  alternativas: string[];
  classe: ClasseMarcador;
  risco: RiscoTroca;
  /** a explicação do aviso (é o que a janela mostra no title da linha) */
  message: string;
}

/** Rótulo curto do risco (chip da lista). */
export const ROTULO_RISCO: Record<RiscoTroca, string> = {
  segura: "troca segura",
  sentido: "confira o sentido",
  manual: "reformule",
};

const RISCO_DE = (i: WritingIssue): RiscoTroca => {
  if (i.fix !== undefined) return "segura";
  return i.suggestions.length ? "sentido" : "manual";
};

/**
 * Todas as trocas que a formalização pode fazer num texto — já na ordem do texto.
 * A lista vem da mesma varredura que alimenta o MIP (`achadosInformais`), então o
 * internetês que outra regra já corrige também entra — e sempre no tom formal.
 */
export function trocasDeFormalizacao(texto: string): TrocaFormal[] {
  if (!texto.trim()) return [];
  return achadosInformais(texto)
    .filter((i) => i.from >= 0 && i.from < i.to && i.to <= texto.length)
    .map((i) => {
      const risco = RISCO_DE(i);
      const para = risco === "segura" ? i.fix : risco === "sentido" ? i.suggestions[0] : undefined;
      return {
        from: i.from,
        to: i.to,
        de: i.word,
        para,
        alternativas: i.suggestions.filter((s) => s !== para),
        classe: i.classe as ClasseMarcador,
        risco,
        message: i.message,
      };
    });
}

/** Uma troca que entrou, com os limites no original e no texto novo (a prévia pinta os dois). */
export interface TrocaAplicada {
  de: [number, number];
  para: [number, number];
}

export interface AplicacaoFormal {
  /** o texto com as trocas aplicadas */
  texto: string;
  /** cada troca que entrou, na ordem do texto */
  aplicadas: TrocaAplicada[];
}

/**
 * Aplica as trocas escolhidas e devolve o texto formalizado (mais onde cada troca caiu).
 * Duas trocas no mesmo trecho: vale a primeira (a lista já vem do `checkStyle`, que corta
 * repetições de posição).
 */
export function aplicarTrocas(texto: string, trocas: TrocaFormal[]): AplicacaoFormal {
  const aplicaveis = trocas
    .filter((t) => t.para !== undefined && t.para !== t.de && t.from >= 0 && t.to <= texto.length)
    .sort((a, b) => a.from - b.from);
  let saida = "";
  let fim = 0;
  const aplicadas: TrocaAplicada[] = [];
  for (const t of aplicaveis) {
    if (t.from < fim) continue; // sobreposição: a segunda perderia o pedaço já trocado
    saida += texto.slice(fim, t.from);
    const inicio = saida.length;
    saida += t.para;
    aplicadas.push({ de: [t.from, t.to], para: [inicio, saida.length] });
    fim = t.to;
  }
  return { texto: saida + texto.slice(fim), aplicadas };
}

/** MIP do texto (marcadores informais por mil palavras) — a mesma conta do painel de revisão. */
export function mipDe(texto: string): number {
  return stats(texto).mip;
}
