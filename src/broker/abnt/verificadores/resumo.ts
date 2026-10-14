// Verificadores do RESUMO e do ABSTRACT (NBR 6028 e NBR 14724).
//
// Regras que usam este arquivo: E09 (extensão do resumo), E10 (abstract presente),
// A01 (extensão 150–500 palavras), A02 (palavras-chave), A03 (resumo sem citação).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
//
// As decisões que valem a leitura:
//
// 1. E09 e A01 são o MESMO exame (`extensao-resumo`) declarado duas vezes: muda o id e a
//    norma, e o julgamento lê `regra.norma` para citar a norma certa — a contagem não pode
//    divergir entre as duas. A contagem exclui a linha "Palavras-chave:" (o rótulo é de
//    outro elemento do trabalho) e o número contado sai na mensagem.
// 2. Ausência (E10 e A02) só acusa com o resumo presente: sem bloco RESUMO o verificador é
//    silêncio — quem cobra a existência do resumo é a regra de estrutura (E01), e um aviso
//    de "falta o abstract" em qualquer texto solto seria falso positivo.
// 3. Aviso de ausência ancora no vizinho que existe — o fim do resumo, onde o elemento
//    entraria. O motor descarta aviso de trecho vazio; a âncora precisa ter conteúdo.
// 4. A03 procura só o padrão autor-data entre parênteses ("(Silva, 2020)"), o inequívoco;
//    "Autor (ano)" narrativo fica de fora de propósito (evita falso positivo em nomes).

import { contarPalavras, type Documento, type Linha, type Secao, type TipoLinha } from "../documento";
import type { RegraToml } from "../esquema";
import { opcaoNumero, type Aviso, type Verificador } from "./tipos";

/** "nbr6028:2021" → "[ABNT NBR 6028:2021]" — a mensagem cita a norma declarada na regra. */
function rotuloNorma(regra: RegraToml): string {
  const m = /^nbr([0-9]+)(?::([0-9]{4}))?$/.exec(regra.norma.trim());
  return m ? `[ABNT NBR ${m[1]}${m[2] ? `:${m[2]}` : ""}]` : "[ABNT]";
}

/** Linhas com conteúdo do corpo da seção (sem a linha do título e sem as vazias). */
function linhasDoCorpo(doc: Documento, secao: Secao): Linha[] {
  return doc.linhas.filter(
    (l) => l.from >= secao.corpoFrom && l.to <= secao.fimDoConteudo && l.tipo !== "vazio" && l.tipo !== "titulo"
  );
}

/** O que conta palavra e pode ter citação: prosa, lista, citação longa e tabela. */
function ehProsa(tipo: TipoLinha): boolean {
  return tipo === "texto" || tipo === "lista" || tipo === "citacao" || tipo === "tabela";
}

/**
 * O rótulo "Palavras-chave" no começo de uma linha ou de uma frase (aceita negrito,
 * citação e "Palavras chave" sem hífen). Captura o rótulo, o dois-pontos (se houver) e
 * o resto da linha, que são os termos.
 */
const ROTULO_PALAVRAS_CHAVE = /(?:^|[\n.!?]\s*)[*_>#\s]*(palavras?[-\s]?chaves?)\s*(:?)[ \t]*(.*)$/i;

/**
 * Citação autor-data entre parênteses: "(Silva, 2020)", "(SILVA; Costa, 2020)",
 * "(Silva et al., 2020a, p. 15)". O ano fica DENTRO do parêntese — é o padrão
 * inequívoco; o narrativo "Silva (2020)" fica de fora de propósito.
 */
const CITACAO_AUTOR_DATA =
  /\((?<citacao>[\p{Lu}][\p{L}'’-]*(?:\s+et\s+al\.?)?(?:\s*(?:;|e|&)\s*[\p{Lu}][\p{L}'’-]*(?:\s+et\s+al\.?)?)*\s*,\s*[0-9]{4}[a-z]?(?:\s*,\s*p\.\s*[0-9]+(?:-[0-9]+)?)?)\)/gu;

/** O fim do resumo com conteúdo — onde o elemento que falta entraria. */
function ancoraFimDoResumo(doc: Documento, secao: Secao): { from: number; to: number } {
  const linhas = linhasDoCorpo(doc, secao);
  const ultima = linhas[linhas.length - 1];
  if (ultima) return { from: ultima.from, to: ultima.to };
  return { from: secao.tituloFrom, to: secao.tituloTo };
}

/** O resumo conta o corpo em prosa, sem a linha "Palavras-chave:" e sem código/figuras. */
function contagemDoResumo(doc: Documento, secao: Secao): number {
  const linhas = linhasDoCorpo(doc, secao).filter((l) => ehProsa(l.tipo));
  const chaves = linhas.findIndex((l) => ROTULO_PALAVRAS_CHAVE.test(l.texto));
  let palavras = 0;
  for (let i = 0; i < linhas.length; i++) {
    if (i === chaves) continue;
    palavras += contarPalavras(linhas[i].texto);
  }
  return palavras;
}

export const VERIFICADORES: Record<string, Verificador> = {
  /** E09 (NBR 14724) e A01 (NBR 6028): o mesmo exame, declarado duas vezes. */
  "extensao-resumo": (doc, regra) => {
    const minimo = opcaoNumero(regra, "minimo", 150);
    const maximo = opcaoNumero(regra, "maximo", 500);
    const rotulo = rotuloNorma(regra);
    const avisos: Aviso[] = [];
    for (const secao of doc.blocos.resumo ?? []) {
      const palavras = contagemDoResumo(doc, secao);
      if (palavras >= minimo && palavras <= maximo) continue;
      const linhas = linhasDoCorpo(doc, secao);
      const primeira = linhas[0];
      const ultima = linhas[linhas.length - 1];
      const ancora =
        primeira && ultima ? { from: primeira.from, to: ultima.to } : { from: secao.tituloFrom, to: secao.tituloTo };
      let mensagem: string;
      if (palavras === 0) {
        mensagem =
          `${rotulo} O resumo está sem texto — escreva o resumo em um parágrafo único ` +
          `(${minimo} a ${maximo} palavras para trabalhos acadêmicos: finalidade, metodologia, resultados e conclusões).`;
      } else {
        const plural = palavras === 1 ? "palavra" : "palavras";
        const fora =
          palavras > maximo
            ? `acima do máximo de ${maximo} palavras para trabalhos acadêmicos; enxugar o texto`
            : `abaixo do mínimo de ${minimo} palavras para trabalhos acadêmicos; desenvolver o resumo (finalidade, metodologia, resultados e conclusões)`;
        mensagem =
          `${rotulo} O resumo tem ${palavras} ${plural} — ${fora}. ` +
          `A contagem considera o corpo do resumo e exclui a linha “Palavras-chave:”.`;
      }
      avisos.push({ ...ancora, mensagem });
    }
    return avisos;
  },

  /** E10 (NBR 14724): sem resumo no documento é silêncio; com resumo, cobra o abstract. */
  "abstract-presente": (doc, regra) => {
    const rotulo = rotuloNorma(regra);
    const resumos = doc.blocos.resumo ?? [];
    if (!resumos.length) return [];
    const abstracts = doc.blocos.abstract ?? [];
    if (!abstracts.length) {
      const ancora = ancoraFimDoResumo(doc, resumos[resumos.length - 1]);
      return [
        {
          ...ancora,
          mensagem:
            `${rotulo} O ABSTRACT (resumo em língua estrangeira) não foi encontrado — ` +
            `inclua-o logo depois do RESUMO, com o mesmo conteúdo traduzido.`,
        },
      ];
    }
    const avisos: Aviso[] = [];
    for (const secao of abstracts) {
      if (linhasDoCorpo(doc, secao).length) continue;
      avisos.push({
        from: secao.tituloFrom,
        to: secao.tituloTo,
        mensagem: `${rotulo} O ABSTRACT está sem texto — traduza o resumo para a língua estrangeira (normalmente o inglês).`,
      });
    }
    return avisos;
  },

  /** A02 (NBR 6028): "Palavras-chave:" presente e no formato; ausente, ancora no fim do resumo. */
  "palavras-chave-resumo": (doc, regra) => {
    const rotulo = rotuloNorma(regra);
    const avisos: Aviso[] = [];
    for (const secao of doc.blocos.resumo ?? []) {
      const linha = linhasDoCorpo(doc, secao).find((l) => ROTULO_PALAVRAS_CHAVE.test(l.texto));
      if (!linha) {
        const ancora = ancoraFimDoResumo(doc, secao);
        avisos.push({
          from: ancora.from,
          to: ancora.to,
          mensagem:
            `${rotulo} O resumo não tem o rótulo “Palavras-chave:” — inclua-o logo depois do texto do resumo, ` +
            `com os termos (normalmente de 3 a 5) separados por ponto e vírgula.`,
        });
        continue;
      }
      const m = ROTULO_PALAVRAS_CHAVE.exec(linha.texto);
      if (!m) continue;
      const problemas: string[] = [];
      const nucleo = m[1].split(/[-\s]/)[0]; // "Palavras" | "Palavra"
      if (!/s$/i.test(nucleo)) problemas.push("o rótulo vai no plural (“Palavras-chave:”)");
      if (m[2] !== ":") problemas.push("o rótulo termina com dois-pontos");
      if (contarPalavras(m[3]) === 0) problemas.push("os termos vêm depois dos dois-pontos");
      if (!problemas.length) continue;
      avisos.push({
        from: linha.from,
        to: linha.to,
        mensagem: `${rotulo} O rótulo das palavras-chave está fora do formato — ${problemas.join("; ")}.`,
      });
    }
    return avisos;
  },

  /** A03 (NBR 6028): o resumo não leva citação autor-data. */
  "resumo-sem-citacao": (doc, regra) => {
    const rotulo = rotuloNorma(regra);
    const avisos: Aviso[] = [];
    for (const secao of doc.blocos.resumo ?? []) {
      for (const linha of linhasDoCorpo(doc, secao)) {
        if (!ehProsa(linha.tipo)) continue;
        CITACAO_AUTOR_DATA.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CITACAO_AUTOR_DATA.exec(linha.texto)) !== null) {
          const de = linha.from + m.index;
          avisos.push({
            from: de,
            to: de + m[0].length,
            mensagem:
              `${rotulo} O resumo não leva citação (“${m[0]}”) — reescreva a frase com as ideias do autor, ` +
              `sem a remissão à fonte aqui (a citação fica no corpo do trabalho).`,
          });
        }
      }
    }
    return avisos;
  },
};
