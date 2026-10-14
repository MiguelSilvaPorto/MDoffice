// Candidatos para DIVIDIR um trecho comprido: onde dá para entrar vírgula (ou ponto)
// sem quebrar a frase. Cada candidato sabe o próprio trecho e o que inserir.
//
// Tudo é resolvido sobre a LISTA DE PALAVRAS do trecho (uma varredura só): o motor roda a
// cada pausa, e uma dúzia de regexes grandes custaria mais que a checagem inteira.
//
// O motor é conservador: só entra onde quase sempre pede pontuação — subordinante que
// abre oração, expressão adverbial, "e" com sujeito novo e pronome-sujeito. Quem
// escolhe é quem escreve: nada aqui é aplicado sozinho.

import type { DivisorTrecho } from "../types";
import { ADVERBIAIS_VIRGULA } from "../data/phrases";
import { ANTES_DO_PRONOME, CONTINUA_EXPRESSAO } from "./punctuation";

export interface Candidato extends DivisorTrecho {
  confianca: "alta" | "media";
}

/** Teto de análise: um trecho gigante (documento sem pontuação) não precisa ser varrido inteiro. */
const MAX_ANALISE = 1500;

const PRONOMES = new Set(["a gente", "vocês", "você", "eles", "elas", "nós", "ele", "ela", "eu", "tu"]);

/** Subordinantes que abrem oração: num trecho comprido, quase sempre pedem a vírgula antes. */
const SUBORDINANTES: [string, "alta" | "media"][] = [
  ["porque", "alta"],
  ["pois", "alta"],
  ["já que", "alta"],
  ["uma vez que", "alta"],
  ["visto que", "alta"],
  ["embora", "alta"],
  ["ainda que", "alta"],
  ["mesmo que", "alta"],
  ["para que", "alta"],
  ["enquanto", "alta"],
  ["quando", "alta"],
  ["se", "media"],
];

/** Palavras que, antes da conjunção, fazem o encaixe ("e porque…", "era para que…", "é porque…"): a vírgula não entra. */
const ANTES_DA_CONJUNCAO = new Set([
  "e", "ou", "nem", "mas", "só", "mesmo", "até", "para", "por", "de", "em",
  // formas do verbo "ser": "era para que…", "é porque…" são construções coladas
  "é", "era", "foi", "são", "eram", "foram", "será", "seria", "seja", "fosse",
]);

interface Palavra {
  texto: string;
  inicio: number;
  fim: number;
  baixo: string;
}

/** As palavras do trecho, com posição — uma varredura só para todas as regras. */
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

const porPrimeiraPalavra = <T>(entradas: [string, T][]): Map<string, { partes: string[]; valor: T }[]> => {
  const mapa = new Map<string, { partes: string[]; valor: T }[]>();
  for (const [frase, valor] of entradas) {
    const partes = frase.split(" ");
    const lista = mapa.get(partes[0]) ?? [];
    lista.push({ partes, valor });
    mapa.set(partes[0], lista);
  }
  return mapa;
};

const CONJUNCOES = porPrimeiraPalavra(SUBORDINANTES);
const ADVERBIAIS = porPrimeiraPalavra(ADVERBIAIS_VIRGULA.map((e): [string, true] => [e, true]));

/** A palavra antes do pronome termina uma expressão adverbial? (aí a vírgula do adverbial cuida) */
function depoisDeAdverbial(palavras: Palavra[], i: number): boolean {
  for (const { partes } of ADVERBIAIS.get(palavras[i - 1]?.baixo ?? "") ?? []) {
    if (i >= partes.length && casaSequencia(palavras, i - partes.length, partes) !== null) return true;
  }
  return false;
}

/**
 * Candidatos de divisão dentro de [from, to): a posição, o que inserir e o rótulo.
 * Vêm em ordem de leitura; a confiança separa o que é quase certo do que é sugestão.
 */
export function divisoresDoTrecho(text: string, from: number, to: number): Candidato[] {
  const trecho = text.slice(from, Math.min(to, from + MAX_ANALISE));
  const palavras = palavrasDe(trecho);
  const out: Candidato[] = [];

  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i];

    // 1) pronome-sujeito que abre oração nova → nova frase (a quebra "clássica")
    if (
      PRONOMES.has(p.baixo) &&
      i >= 8 && // a oração já se desenvolveu
      !(i > 0 && ANTES_DO_PRONOME.has(palavras[i - 1].baixo)) &&
      !depoisDeAdverbial(palavras, i)
    ) {
      const espaco = p.inicio - 1;
      if (/\s/.test(trecho[espaco] ?? "")) {
        out.push({
          from: from + espaco,
          to: from + p.fim,
          insert: `. ${p.texto[0].toUpperCase()}${p.texto.slice(1)}`,
          rotulo: `nova frase antes de “${p.baixo}”`,
          confianca: "alta",
        });
      }
    }

    // 2) subordinante que abre oração → vírgula antes
    for (const { partes, valor } of CONJUNCOES.get(p.baixo) ?? []) {
      const fim = casaSequencia(palavras, i, partes);
      if (fim === null || i < 4) continue; // cedinho demais não é "trecho comprido"
      if (ANTES_DA_CONJUNCAO.has(palavras[i - 1]?.baixo ?? "")) continue; // "e porque…" já é o encaixe
      const espaco = p.inicio - 1;
      if (!/\s/.test(trecho[espaco] ?? "") || !/\s/.test(trecho[fim] ?? "")) continue;
      out.push({
        from: from + espaco,
        to: from + fim,
        insert: `, ${trecho.slice(p.inicio, fim)}`,
        rotulo: `vírgula antes de “${partes.join(" ")}”`,
        confianca: valor,
      });
    }

    // 3) "e" com pronome-sujeito (troca de sujeito) → vírgula antes
    if (p.baixo === "e" && i > 0 && PRONOMES.has(palavras[i + 1]?.baixo ?? "") && /[\p{Ll}\d]/u.test(trecho[p.inicio - 2] ?? "")) {
      out.push({
        from: from + p.inicio - 1,
        to: from + p.fim,
        insert: `, ${p.texto}`,
        rotulo: "vírgula antes de “e” (oração nova)",
        confianca: "media",
      });
    }

    // 4) expressão adverbial no meio do trecho → vírgula depois
    for (const { partes } of ADVERBIAIS.get(p.baixo) ?? []) {
      const fim = casaSequencia(palavras, i, partes);
      if (fim === null || i < 2) continue; // abrindo a frase, quem cuida é a regra própria
      if (trecho[fim] === ",") continue; // já tem a vírgula
      if (!palavras[i + partes.length]) continue; // precisa continuar com uma palavra
      if (CONTINUA_EXPRESSAO.has(palavras[i + partes.length].baixo)) continue; // "no começo de tudo": a vírgula entraria no lugar errado
      out.push({
        from: from + p.inicio,
        to: from + fim,
        insert: `${trecho.slice(p.inicio, fim)},`,
        rotulo: `vírgula depois de “${partes.join(" ")}”`,
        confianca: "alta",
      });
    }
  }

  return out;
}
