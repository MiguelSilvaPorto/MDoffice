// Verificadores de CITAÇÕES (NBR 10520:2023).
//
// Regras de texto: C01 (abnt.c01), C03 (abnt.c03) e C06 (abnt.c06) — vivem em
// `regras/*.toml`. Aqui entra só o que precisa do DOCUMENTO: C04 (abnt.c04),
// citação direta longa (mais de `limite` linhas), que não leva aspas — vai em
// bloco próprio com recuo de 4 cm, fonte menor e espaço simples.
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.

import { opcaoNumero, type Aviso, type Verificador } from "./tipos";

/** Aspas que o texto real usa: reta (Markdown puro) e as curvas do Word. */
function ehAspa(c: string): boolean {
  return c === '"' || c === "“" || c === "”";
}

interface ParDeAspas {
  abre: number;
  fecha: number;
}

/**
 * Casa as aspas em pares, na ordem em que aparecem (abre, fecha, abre, fecha…).
 * Aspa sem par no fim do texto é ignorada — citação aberta não se julga.
 */
function paresDeAspas(texto: string): ParDeAspas[] {
  const pares: ParDeAspas[] = [];
  let abre = -1;
  for (let i = 0; i < texto.length; i++) {
    if (!ehAspa(texto[i])) continue;
    if (abre < 0) abre = i;
    else {
      pares.push({ abre, fecha: i });
      abre = -1;
    }
  }
  return pares;
}

/** Quantas linhas o trecho ocupa (linhas físicas do Markdown). */
function linhasDoTrecho(texto: string, from: number, to: number): number {
  let quebras = 0;
  for (let i = from; i < to; i++) if (texto[i] === "\n") quebras++;
  return quebras + 1;
}

/** Primeiro caractere que não é marca de citação (`>`), espaço ou quebra. */
function primeiroConteudo(texto: string): number {
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === ">" || c === " " || c === "\t" || c === "\n" || c === "\r") continue;
    return i;
  }
  return -1;
}

export const VERIFICADORES: Record<string, Verificador> = {
  /**
   * C04 — citação direta longa (mais de `limite` linhas, padrão 3).
   *
   * Dois casos, os dois com a marca errada visível no Markdown:
   *
   * 1. Bloco (`>`), mais de `limite` linhas, que COMEÇA com aspas — é a citação
   *    longa transcrita com aspas: o bloco fica, as aspas saem.
   * 2. Texto corrido com um trecho entre aspas de mais de `limite` linhas — a
   *    citação devia virar bloco próprio, sem aspas.
   *
   * O critério é apertado de propósito: no bloco, só acusa quando a citação é o
   * PRÓPRIO bloco (a aspa abre o primeiro conteúdo); um bloco longo com uma aspa
   * curta dentro ("Segundo Silva (2020), “a educação…”") fica em paz — ali a
   * citação não é longa. Linhas dentro de cerca de código e tabelas/listas não
   * entram (a tipagem do modelo as separa). O que é do .docx (recuo, fonte,
   * espaçamento) não é julgado aqui.
   */
  "citacao-direta-longa": (doc, regra) => {
    const limite = opcaoNumero(regra, "limite", 3);
    const avisos: Aviso[] = [];
    for (const paragrafo of doc.paragrafos) {
      if (paragrafo.tipo !== "texto" && paragrafo.tipo !== "citacao") continue;
      const pares = paresDeAspas(paragrafo.texto);
      if (!pares.length) continue;

      for (const par of pares) {
        const linhas = linhasDoTrecho(paragrafo.texto, par.abre, par.fecha + 1);
        if (linhas <= limite) continue;

        // bloco: só quando a citação É o bloco (a aspa abre o primeiro conteúdo)
        if (paragrafo.tipo === "citacao" && par.abre !== primeiroConteudo(paragrafo.texto)) continue;

        const noBloco = paragrafo.tipo === "citacao";
        avisos.push({
          from: paragrafo.from + par.abre,
          to: paragrafo.from + par.fecha + 1,
          mensagem: noBloco
            ? `[ABNT NBR 10520:2023] Citação direta longa (mais de ${limite} linhas) em bloco não leva aspas: remova as aspas — o bloco fica com recuo de 4 cm, fonte menor e espaço simples`
            : `[ABNT NBR 10520:2023] Citação direta longa (mais de ${limite} linhas) em texto corrido: use um bloco próprio (linha começando com “>”), sem aspas, com recuo de 4 cm, fonte menor e espaço simples`,
        });
      }
    }
    return avisos;
  },
};
