// Confusões do português: os erros que a distância de edição trata como "qualquer troca"
// mas que, na escrita, valem muito menos — c↔ç, s↔ç/z, x↔c/s, g↔j, e↔i, o↔u, m↔n, o h
// mudo, consoante dobrada e a tecla vizinha do ABNT2.
//
// Serve para duas coisas:
//   1. CUSTO — `distanciaPonderada` cobra menos por uma troca de classe (0,3-0,5 em vez
//      de 1), então o candidato que só difere por uma confusão conhecida sobe na frente;
//   2. VARIANTES — `variantesDeConfusao` propõe as grafias prováveis da palavra errada
//      (inclusive trocando pares de letras: "ss"↔"ç", "ch"↔"x"), que o corretor procura
//      direto no vocabulário — pega o caso em que o índice de trigramas não aproxima.
//
// Puro: tabelas e contas, sem DOM.

import { custoDeTecla } from "./teclado";

/** Custo de trocar uma letra pela outra quando são confundidas na escrita. */
const PARES: [string, string, number][] = [
  ["c", "ç", 0.3],
  ["s", "ç", 0.4],
  ["s", "z", 0.5],
  ["x", "c", 0.5],
  ["x", "s", 0.5],
  ["g", "j", 0.4],
  ["e", "i", 0.5],
  ["o", "u", 0.5],
  ["m", "n", 0.4],
];

const CUSTO_DO_PAR = (() => {
  const mapa = new Map<string, number>();
  for (const [a, b, custo] of PARES) {
    mapa.set(a + b, custo);
    mapa.set(b + a, custo);
  }
  return mapa;
})();

/** O "h" é mudo: aparece e desaparece sem mudar o som (hoje, úmido/umido). */
const CUSTO_H = 0.4;

/** Letra dobrada por engano (ou desdobrada): o erro é pequeno. */
const CUSTO_DOBRA = 0.4;

/** Inversão de duas letras vizinhas: erro clássico de digitação. */
const CUSTO_TRANSPOSICAO = 0.5;

/** Quanto custa trocar o caractere `a` pelo `b` (0 = igual, 1 = troca sem relação). */
export function custoDeTroca(a: string, b: string): number {
  if (a === b) return 0;
  return Math.min(CUSTO_DO_PAR.get(a + b) ?? 1, custoDeTecla(a, b));
}

/** Custo de apagar/inserir um caractere (o "h" mudo e as dobras são baratos). */
function custoDeInsercao(caractere: string, vizinho: string | undefined, seguinte: string | undefined): number {
  if (caractere === "h") return CUSTO_H;
  if (caractere === vizinho || caractere === seguinte) return CUSTO_DOBRA;
  return 1;
}

/**
 * Distância de edição PONDERADA (Damerau-Levenshtein com custos por classe): trocar uma
 * letra custa o que a confusão manda, inverter duas vizinhas custa meia edição, e o "h"
 * mudo/dobra de letra custa menos. Devolve `max + 1` quando passa do limite.
 */
export function distanciaPonderada(a: string, b: string, max: number): number {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > max) return max + 1;
  if (n === 0) return m <= max ? m : max + 1;
  if (m === 0) return n <= max ? n : max + 1;

  let anterior2 = new Float64Array(m + 1);
  let anterior1 = new Float64Array(m + 1);
  let atual = new Float64Array(m + 1);
  for (let j = 0; j <= m; j++) anterior1[j] = j;

  for (let i = 1; i <= n; i++) {
    const ca = a[i - 1];
    atual[0] = anterior1[0] + custoDeInsercao(ca, a[i - 2], a[i]);
    let melhorDaLinha = atual[0];
    for (let j = 1; j <= m; j++) {
      const cb = b[j - 1];
      const v = Math.min(
        anterior1[j] + custoDeInsercao(ca, a[i - 2], a[i]),
        atual[j - 1] + custoDeInsercao(cb, b[j - 2], b[j]),
        anterior1[j - 1] + custoDeTroca(ca, cb)
      );
      let melhor = v;
      // inversão de duas letras vizinhas (erro de digitação típico)
      if (i > 1 && j > 1 && ca === b[j - 2] && a[i - 2] === cb) {
        const v2 = anterior2[j - 2] + CUSTO_TRANSPOSICAO;
        if (v2 < melhor) melhor = v2;
      }
      atual[j] = melhor;
      if (melhor < melhorDaLinha) melhorDaLinha = melhor;
    }
    if (melhorDaLinha > max) return max + 1;
    const troca = anterior2;
    anterior2 = anterior1;
    anterior1 = atual;
    atual = troca;
  }
  return anterior1[m];
}

/** Trocas de PARES de letras que a escrita confunde (as duas direções). */
const PARES_DE_LETRAS: [string, string][] = [
  ["ss", "ç"],
  ["ss", "s"],
  ["sç", "ç"],
  ["xc", "ç"],
  ["ch", "x"],
  ["ç", "c"],
  ["ç", "ss"],
  ["x", "ch"],
  ["m", "n"],
  ["e", "i"],
  ["o", "u"],
  ["g", "j"],
  ["s", "z"],
];

/** Dobras que podem aparecer ou faltar. */
const DOBRAS: [string, string][] = [
  ["cc", "c"],
  ["ff", "f"],
  ["ll", "l"],
  ["mm", "m"],
  ["nn", "n"],
  ["pp", "p"],
  ["rr", "r"],
  ["tt", "t"],
  ["gg", "g"],
];

/**
 * Grafias prováveis da palavra errada, aplicando UMA confusão de cada vez (nas duas
 * direções). O corretor procura cada variante direto no vocabulário normalizado — como
 * a busca ignora acento, a troca de par e a de acento se compõem ("excessao" → "exceçao"
 * que, normalizado, casa com "exceção"). O limite existe para o custo continuar baixo.
 */
export function variantesDeConfusao(palavra: string, limite = 80): string[] {
  const base = palavra.toLowerCase();
  const out: string[] = [];
  const vistos = new Set<string>([base]);
  const trocar = (de: string, para: string) => {
    let i = base.indexOf(de);
    while (i >= 0 && out.length < limite) {
      const v = base.slice(0, i) + para + base.slice(i + de.length);
      if (!vistos.has(v)) {
        vistos.add(v);
        out.push(v);
      }
      i = base.indexOf(de, i + 1);
    }
  };
  for (const [de, para] of PARES_DE_LETRAS) trocar(de, para);
  for (const [de, para] of DOBRAS) trocar(de, para);
  return out;
}
