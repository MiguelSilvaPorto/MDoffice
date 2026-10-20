// Correção formal do texto: restaura acentos/cedilha, insere pontuação, acerta
// espaçamento e maiúsculas — e nada mais. NÃO troca palavras.
//
// A regra é estrutural, não uma lista de exceções: uma correção só entra se o
// "esqueleto" (letras e números, sem acento, sem pontuação, em minúsculas) do que
// entra for igual ao do trecho e se o número de palavras for o mesmo. Assim
// "voce"→"você" e "casa,mas"→"casa, mas" passam; "vc"→"você", "mano"→"rapaz" e
// "posteriormente"→"depois" ficam de fora (são escolha de palavra, não de forma).
//
// É o que o comando "Formatar texto" aplica: o texto pode ficar mais formal na
// forma, mas as escolhas de quem escreveu (gíria, vocabulário) continuam de pé.

import { diag, janelaDe } from "./diag";
import type { WritingIssue } from "./types";

export interface CorrecaoFormal {
  from: number;
  to: number;
  insert: string;
}

const RE_ACENTOS = /[\u0300-\u036f]/g;
const RE_NAO_ALFA = /[^\p{Letter}\p{Number}]/gu;
const RE_PALAVRA = /[\p{Letter}\p{Number}]+/gu;

/** Só as letras e números, sem acento, sem pontuação, em minúsculas. */
export function esqueleto(texto: string): string {
  return texto.normalize("NFD").replace(RE_ACENTOS, "").toLowerCase().replace(RE_NAO_ALFA, "");
}

/** Quantas palavras (sequências de letras/números) o trecho tem. */
export function contarPalavras(texto: string): number {
  return (texto.match(RE_PALAVRA) ?? []).length;
}

/** Classes que reestruturam a frase: nunca entram na correção formal. */
const CLASSES_ESTRUTURAIS = new Set(["quebra-frase", "trecho-longo", "frase-longa"]);

/**
 * As correções que a ação formal pode aplicar. `texto` é o texto atual (para ler o
 * trecho de cada aviso) e `issues` é o resultado da verificação dele.
 */
export function planejarCorrecaoFormal(texto: string, issues: readonly WritingIssue[]): CorrecaoFormal[] {
  const out: CorrecaoFormal[] = [];
  for (const i of issues) {
    // ortografia: a correção confiável (`auto`) ou, quando a regra só pergunta
    // ("faltou o acento?"), a forma certa do dicionário (`fix`) — a ação formal
    // pode responder por ela, desde que não troque a palavra (o filtro abaixo).
    const insert = i.kind === "spell" ? i.auto ?? i.fix : i.fix;
    if (insert === undefined) continue;
    const base = {
      gatilho: "formatar" as const,
      tipo: i.kind,
      regra: i.message,
      from: i.from,
      to: i.to,
      palavra: i.word,
      safe: i.safe,
      auto: i.auto,
      fix: i.fix,
      sugestao: i.suggestions[0],
      janela: janelaDe(texto, i.from, i.to),
    };
    if (i.classe && CLASSES_ESTRUTURAIS.has(i.classe)) {
      diag({ ...base, veredito: "ignorado", motivo: `classe ${i.classe}: reestrutura a frase` });
      continue;
    }
    if (i.classe === "escolha") {
      diag({ ...base, veredito: "ignorado", motivo: "sugestão de leitura/estilo: a correção formal não decide isso" });
      continue;
    }
    const trecho = texto.slice(i.from, i.to);
    if (esqueleto(insert) !== esqueleto(trecho) || contarPalavras(insert) !== contarPalavras(trecho)) {
      diag({
        ...base,
        veredito: "ignorado",
        motivo: `troca de palavra (“${trecho}” → “${insert}”): a correção formal não mexe no vocabulário`,
      });
      continue;
    }
    diag({ ...base, veredito: "aplicado", motivo: `forma: “${trecho}” → “${insert}”` });
    out.push({ from: i.from, to: i.to, insert });
  }
  return semSobreposicao(out);
}

/** Aplica as correções de trás para frente, descartando o que sobrepõe. */
export function aplicarCorrecoes(texto: string, correcoes: readonly CorrecaoFormal[]): string {
  let saida = texto;
  let fim = Number.POSITIVE_INFINITY;
  for (const c of [...correcoes].sort((a, b) => b.from - a.from)) {
    if (c.to > fim) continue;
    saida = saida.slice(0, c.from) + c.insert + saida.slice(c.to);
    fim = c.from;
  }
  return saida;
}

/** Quando dois avisos se sobrepõem, fica o maior (a correção mais completa). */
export function semSobreposicao(correcoes: CorrecaoFormal[]): CorrecaoFormal[] {
  const safe: CorrecaoFormal[] = [];
  for (const c of [...correcoes].sort((a, b) => a.from - b.from || b.to - a.to)) {
    const ultimo = safe[safe.length - 1];
    if (ultimo && c.from < ultimo.to) {
      if (c.to - c.from > ultimo.to - ultimo.from) safe[safe.length - 1] = c;
      continue;
    }
    safe.push(c);
  }
  return safe;
}

export interface ResultadoFormal {
  texto: string;
  mudancas: number;
  rodadas: number;
}

/**
 * Aplica a correção formal até estabilizar: uma correção abre caminho para a
 * seguinte (o ponto final permite maiúscula, a vírgula permite espaço…).
 * `verificar` é injetado para o app usar o `checkText` com os ignorados da pessoa
 * e o teste usar o mesmo caminho sem depender do editor.
 */
export async function corrigirFormal(
  texto: string,
  verificar: (t: string) => Promise<readonly WritingIssue[]>,
  maxRodadas = 6
): Promise<ResultadoFormal> {
  let atual = texto;
  let mudancas = 0;
  let rodadas = 0;
  for (let r = 0; r < maxRodadas; r++) {
    rodadas++;
    const issues = await verificar(atual);
    const correcoes = planejarCorrecaoFormal(atual, issues);
    if (!correcoes.length) break;
    const proximo = aplicarCorrecoes(atual, correcoes);
    if (proximo === atual) break;
    atual = proximo;
    mudancas += correcoes.length;
  }
  return { texto: atual, mudancas, rodadas };
}
