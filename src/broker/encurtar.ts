// Sugere trocas que ENCURTAM um trecho sem quebrar o nexo: perífrases ("com o objetivo de" → "para")
// e palavras longas com equivalente curto ("posteriormente" → "depois"). Curado à mão — nada entra
// sozinho: são chips ("Encurtar: …") para quem escreve escolher.
//
// A comparação é palavra a palavra sobre uma varredura só: o motor roda a cada pausa, e uma
// regex por entrada custaria mais que a checagem inteira.

import type { TrocaTrecho } from "./types";
import { ENCURTAMENTOS } from "./data/encurtamentos";

/** Teto de análise: um trecho gigante (documento sem pontuação) não precisa ser varrido inteiro. */
const MAX_ANALISE = 1500;

interface Palavra {
  texto: string;
  inicio: number;
  fim: number;
  baixo: string;
}

/** As palavras do trecho, com posição — uma varredura só. */
function palavrasDe(trecho: string): Palavra[] {
  const out: Palavra[] = [];
  for (const m of trecho.matchAll(/[\p{L}\d][\p{L}\d']*/gu)) {
    const inicio = m.index ?? 0;
    out.push({ texto: m[0], inicio, fim: inicio + m[0].length, baixo: m[0].toLowerCase() });
  }
  return out;
}

/** Casa a sequência de palavras a partir de `i`? Devolve o fim (em caracteres) quando casa. */
function casaSequencia(palavras: Palavra[], i: number, alvo: string[]): number | null {
  if (i + alvo.length > palavras.length) return null;
  for (let k = 0; k < alvo.length; k++) if (palavras[i + k].baixo !== alvo[k]) return null;
  return palavras[i + alvo.length - 1].fim;
}

interface Entrada {
  partes: string[];
  longa: string;
  curta: string;
  /** a troca termina numa preposição ("é capaz de", "no sentido de") */
  terminaEmPreposicao: boolean;
}

/** As trocas indexadas pela primeira palavra. */
const POR_PALAVRA = new Map<string, Entrada[]>();
for (const [longa, curta] of ENCURTAMENTOS) {
  const partes = longa.split(" ");
  const lista = POR_PALAVRA.get(partes[0]) ?? [];
  lista.push({ partes, longa, curta, terminaEmPreposicao: /(de|do|da|dos|das|a|o|para)$/.test(longa) });
  POR_PALAVRA.set(partes[0], lista);
}

/** Mantém a caixa da primeira letra ("Posteriormente" → "Depois"). */
function comCaixa(original: string, troca: string): string {
  const primeira = original[0];
  if (primeira && primeira === primeira.toUpperCase() && primeira !== primeira.toLowerCase()) {
    return troca[0].toUpperCase() + troca.slice(1);
  }
  return troca;
}

/**
 * Palavras que, logo depois da troca, pedem que ela NÃO aconteça: "é capaz de tudo" não vira
 * "pode tudo", "no sentido de algo" não vira "para algo". Vale só para trocas que terminam
 * numa preposição (as de capacidade, de assunto, de finalidade).
 */
const COMPLEMENTO_NAO_VERBAL = new Set([
  "tudo", "nada", "algo", "alguém", "ninguém", "qualquer", "quaisquer", "muito", "muita", "muitos", "muitas",
  "pouco", "pouca", "poucos", "poucas", "mais", "menos", "isto", "isso", "aquilo", "este", "esta", "esse",
  "essa", "aquele", "aquela", "ele", "ela", "eles", "elas", "eu", "nós", "você", "vocês",
]);

/**
 * Trocas que encurtam o trecho, das que mais economizam para as menores, sem sobreposição.
 * `max` limita quantas voltam (o popup e o F7 mostram todas).
 */
export function encurtarTrecho(text: string, from: number, to: number, max = 3): TrocaTrecho[] {
  const trecho = text.slice(from, Math.min(to, from + MAX_ANALISE));
  const palavras = palavrasDe(trecho);
  const candidatos: { from: number; to: number; para: string; rotulo: string; ganho: number }[] = [];

  for (let i = 0; i < palavras.length; i++) {
    for (const { partes, longa, curta, terminaEmPreposicao } of POR_PALAVRA.get(palavras[i].baixo) ?? []) {
      const fim = casaSequencia(palavras, i, partes);
      if (fim === null) continue;
      const proxima = palavras[i + partes.length]?.baixo ?? "";
      if (terminaEmPreposicao && COMPLEMENTO_NAO_VERBAL.has(proxima)) continue; // "é capaz de tudo"
      const original = trecho.slice(palavras[i].inicio, fim);
      const para = comCaixa(original, curta);
      const ganho = original.length - para.length;
      if (ganho < 2) continue;
      candidatos.push({
        from: from + palavras[i].inicio,
        to: from + fim,
        para,
        rotulo: `“${original}” → “${para}”`,
        ganho,
      });
    }
  }

  candidatos.sort((a, b) => b.ganho - a.ganho || a.from - b.from);
  const out: TrocaTrecho[] = [];
  for (const c of candidatos) {
    if (out.length >= max) break;
    if (out.some((o) => c.from < o.to && o.from < c.to)) continue; // sobrepõe uma troca já escolhida
    out.push({ from: c.from, to: c.to, para: c.para, rotulo: c.rotulo });
  }
  return out;
}
