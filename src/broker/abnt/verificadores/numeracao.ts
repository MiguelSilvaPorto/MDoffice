// Verificadores de SUMÁRIO e NUMERAÇÃO (NBR 6027 e NBR 6024).
//
// Regras que usam este arquivo: S01 (o sumário bate com os títulos e a ordem), S02
// (pré-textuais fora do sumário), S03 (numeração decimal coerente com os níveis) e
// S04 (subseção única — sugestão de forma).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
//
// O formato do sumário que S01/S02 aceitam (e o porquê de cada exigência):
//
// - o sumário é a seção cujo título casa com o bloco `sumario`; os itens são as linhas
//   de lista ou de texto depois do título — uma linha por entrada;
// - cada item pode vir com marcação de lista (`- `), numeração (`1.2`), destaque
//   (`**…**`), link (`[1.1 Objetivo](#objetivo-geral)`), pontilhado e número de página
//   (`1.1 OBJETIVO ....... 5` — o pontilhado é o que identifica a página; dois espaços
//   sozinhos não bastam, senão um título que termina em número perderia o texto);
// - a comparação é pelo título NORMALIZADO (`normalizarTitulo`: sem numeração, sem
//   acento, caixa alta), então "1.2 Objetivo Geral" e "OBJETIVO GERAL" casam;
// - fora desse formato o verificador silencia: falso negativo é melhor que falso
//   positivo (a regra do projeto).
//
// Nenhum dos quatro devolve `fix`: reordenar/renumerar depende do que o autor quis
// dizer, e o grupo S não automatiza — S04 é `suggestion`; os outros são `warning` de
// conferência, nunca `auto`.

import type { Documento, Linha, Secao } from "../documento";
import { BLOCOS, normalizarTitulo, tituloCasa } from "../esquema";
import { opcaoNumero, type Aviso, type Verificador } from "./tipos";

/**
 * Elementos pré-textuais da NBR 14724 — os que a NBR 6027 tira do sumário.
 *
 * Ficam de fora `referencias`, `glossario`, `apendices` e `anexos` (pós-textuais):
 * os manuais divergem sobre listá-los, então acusá-los seria chute. E as listas
 * entram: a pesquisa registra que alguns modelos as incluem no sumário, mas isso é
 * divergência de instituição — quem decide é o perfil (off/soft/hard), não a regra.
 */
const PRE_TEXTUAIS = [
  "capa",
  "folha-de-rosto",
  "folha-de-aprovacao",
  "resumo",
  "abstract",
  "sumario",
  "lista-de-figuras",
  "lista-de-tabelas",
  "lista-de-siglas",
  "lista-de-abreviaturas",
  "lista-de-simbolos",
] as const;

/** As seções que pertencem a um bloco conhecido, com o nome do bloco. */
function blocoDaSecao(doc: Documento): Map<Secao, string> {
  const mapa = new Map<Secao, string>();
  for (const [nome, secoes] of Object.entries(doc.blocos)) for (const secao of secoes) mapa.set(secao, nome);
  return mapa;
}

/** O título normalizado casa com algum sinônimo dos blocos pedidos (todos, por padrão)? */
function casaAlgumBloco(chave: string, nomes: readonly string[] = Object.keys(BLOCOS)): boolean {
  for (const nome of nomes) for (const sinonimo of BLOCOS[nome]) if (tituloCasa(chave, sinonimo)) return true;
  return false;
}

interface ItemSumario {
  /** o item como ele será comparado: sem link, sem destaque, sem pontilhado e sem página */
  texto: string;
  /** título normalizado — a chave da comparação com `doc.secoes` */
  chave: string;
  /** começa com indicativo decimal ("1", "1.2", "1.2.3") */
  numerado: boolean;
  /** o item todo em caixa alta (forma de seção primária) */
  caixaAlta: boolean;
  from: number;
  to: number;
}

/** Limpa o item cru do sumário: link, destaque, pontilhado com página e marcador de lista. */
function limparItem(bruto: string): string {
  let t = bruto.trim();
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // [1.1 Objetivo](#objetivo) → 1.1 Objetivo
  t = t.replace(/\*\*|__|`/g, ""); // **negrito**, __negrito__, `código`
  t = t.replace(/(^|\s)[*_](?=\S)/g, "$1").replace(/(\S)[*_](?=\s|$)/g, "$1"); // *ênfase*
  t = t.replace(/[.·•…_][\s.·•…_]*\d{1,4}\s*$/u, ""); // "1.1 OBJETIVO ....... 5" → "1.1 OBJETIVO"
  t = t.replace(/^\s*[-*+]\s+/, ""); // marcador de lista com bullet
  return t.trim();
}

function itemDeLinha(linha: Linha): ItemSumario {
  const texto = limparItem(linha.texto);
  return {
    texto,
    chave: normalizarTitulo(texto),
    numerado: /^\d{1,2}(?:\.\d{1,2})*[.)]?\s+\S/.test(texto),
    caixaAlta: /\p{L}/u.test(texto) && texto === texto.toUpperCase(),
    from: linha.from,
    to: linha.to,
  };
}

/** Os itens do sumário: as linhas de lista/texto dentro da seção de sumário. */
function itensDaSecao(doc: Documento, secao: Secao): ItemSumario[] {
  const itens: ItemSumario[] = [];
  for (const linha of doc.linhas) {
    if (linha.from < secao.corpoFrom || linha.to > secao.fimDoConteudo) continue;
    if (linha.tipo !== "lista" && linha.tipo !== "texto") continue;
    const item = itemDeLinha(linha);
    if (!item.chave) continue;
    itens.push(item);
  }
  return itens;
}

/** O pai estrutural: o último título anterior de nível menor (o ancestral mais próximo). */
function paiEstrutural(secoes: Secao[], i: number): number {
  const nivel = secoes[i].nivel;
  for (let j = i - 1; j >= 0; j--) if (secoes[j].nivel < nivel) return j;
  return -1;
}

/** O indicativo decimal de um título ("1", "1.2", "10.3.4"), ou null. */
const NUMERO_SECAO = /^(\d{1,2}(?:\.\d{1,2})*)\.?\s+\S/;

function numeroDoTitulo(titulo: string): string | null {
  return NUMERO_SECAO.exec(titulo.trim())?.[1] ?? null;
}

/**
 * S01 — o sumário bate com os títulos do corpo (presença, grafia e ordem).
 *
 * Sem sumário no documento é silêncio: quem cobra o elemento é a regra do grupo E
 * (E01). Sumário sem nenhum item reconhecível também: o usuário acabou de criar o
 * título e ainda vai preencher — cobrar aí seria ruído. A ausência só é cobrada até
 * `profundidade` (opção do TOML, padrão 3): quase nenhum manual exige listar a
 * seção quaternária, e os que exigem ajustam a opção.
 */
const sumarioBateTitulos: Verificador = (doc, regra) => {
  const profundidade = opcaoNumero(regra, "profundidade", 3);
  const sumarios = doc.blocos.sumario ?? [];
  if (!sumarios.length) return [];
  const itens = sumarios.flatMap((secao) => itensDaSecao(doc, secao));
  if (!itens.length) return [];

  const blocos = blocoDaSecao(doc);
  const cobraveis = doc.secoes.filter(
    (secao) => !blocos.has(secao) && secao.nivel <= profundidade && Boolean(normalizarTitulo(secao.titulo))
  );

  const posicao = new Map<Secao, number>();
  doc.secoes.forEach((secao, i) => posicao.set(secao, i));
  const pos = (secao: Secao): number => posicao.get(secao) ?? -1;

  const porChave = new Map<string, Secao[]>();
  for (const secao of cobraveis) {
    const chave = normalizarTitulo(secao.titulo);
    const lista = porChave.get(chave);
    if (lista) lista.push(secao);
    else porChave.set(chave, [secao]);
  }
  const chavesDoDocumento = new Set(doc.secoes.map((secao) => normalizarTitulo(secao.titulo)));

  // Casa item a item, preferindo a seção que mantém a ordem do documento (o sumário
  // pode repetir um título em capítulos diferentes: "2 Objetivos" e "3 Objetivos").
  const avisos: Aviso[] = [];
  const usadas = new Set<Secao>();
  const semSecao: ItemSumario[] = [];
  let ultima = -1;
  for (const item of itens) {
    const chaves = [item.chave];
    const semPagina = item.chave.replace(/\s+\d{1,4}$/, "");
    if (semPagina && semPagina !== item.chave) chaves.push(semPagina);

    const candidatas: Secao[] = [];
    for (const chave of chaves) {
      for (const secao of porChave.get(chave) ?? []) {
        if (!usadas.has(secao) && !candidatas.includes(secao)) candidatas.push(secao);
      }
    }
    if (!candidatas.length) {
      semSecao.push(item);
      continue;
    }
    const adiante = candidatas.filter((secao) => pos(secao) > ultima);
    const escolhida = adiante.length
      ? adiante.reduce((a, b) => (pos(a) <= pos(b) ? a : b))
      : candidatas[0];
    usadas.add(escolhida);
    if (!adiante.length && ultima >= 0) {
      avisos.push({
        from: item.from,
        to: item.to,
        mensagem: `[ABNT NBR 6027:2012] Entrada fora de ordem no sumário: no documento, “${escolhida.titulo}” aparece antes das entradas anteriores — reordene o sumário na ordem das seções do texto.`,
      });
    }
    ultima = pos(escolhida);
  }

  // Seção do texto que o sumário não lista — o caso "subseção ausente → atualizar".
  for (const secao of cobraveis) {
    if (usadas.has(secao)) continue;
    avisos.push({
      from: secao.tituloFrom,
      to: secao.tituloTo,
      mensagem: `[ABNT NBR 6027:2012] O sumário não lista esta seção: inclua “${secao.titulo}” no sumário, na mesma ordem e grafia do documento.`,
    });
  }

  // Entrada do sumário sem título correspondente — sobra de versão antiga.
  for (const item of semSecao) {
    if (item.chave.length > 120) continue; // uma frase não é entrada de sumário
    const semPagina = item.chave.replace(/\s+\d{1,4}$/, "");
    if (chavesDoDocumento.has(item.chave) || (semPagina !== item.chave && chavesDoDocumento.has(semPagina))) continue;
    if (casaAlgumBloco(item.chave)) continue; // pré-textuais (S02) e pós-textuais ficam em paz
    if (!item.numerado && !item.caixaAlta) continue; // não tem forma de entrada de seção
    avisos.push({
      from: item.from,
      to: item.to,
      mensagem: `[ABNT NBR 6027:2012] Esta entrada do sumário não corresponde a nenhum título do documento: confira a grafia ou remova “${item.texto}” do sumário.`,
    });
  }

  return avisos;
};

/** S02 — elementos pré-textuais (RESUMO, ABSTRACT, listas…) não entram no sumário. */
const sumarioSemPretextuais: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const secao of doc.blocos.sumario ?? []) {
    for (const item of itensDaSecao(doc, secao)) {
      if (!casaAlgumBloco(item.chave, PRE_TEXTUAIS)) continue;
      avisos.push({
        from: item.from,
        to: item.to,
        mensagem: `[ABNT NBR 6027:2012] Elemento pré-textual não deve constar no sumário: remova a entrada “${item.texto}” (o sumário relaciona as divisões do texto).`,
      });
    }
  }
  return avisos;
};

/**
 * S03 — numeração progressiva (NBR 6024): o indicativo decimal continua o da seção
 * superior e não desce mais níveis do que a estrutura de títulos alcança.
 *
 * O que NÃO é verificado aqui (para não chutar): a sequência dos irmãos ("3.1" e
 * depois "3.3"), o reinício e a ausência de indicativo. A comparação é só entre uma
 * seção numerada e o pai estrutural dela (o último título anterior de nível menor)
 * quando o pai também tem indicativo — sem série para continuar, o verificador
 * silencia.
 */
const numeracaoProgressiva: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  const numeros = doc.secoes.map((secao) => numeroDoTitulo(secao.titulo));
  for (let i = 0; i < doc.secoes.length; i++) {
    const numero = numeros[i];
    if (!numero) continue;
    const p = paiEstrutural(doc.secoes, i);
    if (p < 0) continue;
    const numeroPai = numeros[p];
    if (!numeroPai) continue;
    const secao = doc.secoes[i];
    const pai = doc.secoes[p];
    const faixa = { from: secao.tituloFrom, to: secao.tituloTo };
    if (!numero.startsWith(`${numeroPai}.`)) {
      avisos.push({
        ...faixa,
        mensagem: `[ABNT NBR 6024:2012] A numeração “${numero}” não continua a da seção superior “${numeroPai}” (${pai.titulo}): renumere para “${numeroPai}.x” — ou ponha esta seção no mesmo nível de “${numeroPai}”, se ela não for subseção.`,
      });
      continue;
    }
    const niveis = numero.slice(numeroPai.length + 1).split(".");
    if (niveis.length > 1) {
      avisos.push({
        ...faixa,
        mensagem: `[ABNT NBR 6024:2012] “${numero}” desce mais níveis do que a estrutura de títulos: sob “${numeroPai}”, use “${numeroPai}.x” (falta a subseção intermediária).`,
      });
    }
  }
  return avisos;
};

/**
 * S04 — sem subseção única (confiança baixa: é convenção de manual, não regra dura).
 *
 * Só vale entre seções com indicativo decimal: sem numeração o documento não está
 * seguindo a 6024, e o aviso seria ruído em qualquer README. Também ignora
 * pré/pós-textuais (referências com uma subseção não é "seção dividida").
 */
const subsecaoUnica: Verificador = (doc) => {
  const blocos = blocoDaSecao(doc);
  const filhas = new Map<Secao, Secao[]>();
  for (let i = 0; i < doc.secoes.length; i++) {
    const p = paiEstrutural(doc.secoes, i);
    if (p < 0) continue;
    const pai = doc.secoes[p];
    const secao = doc.secoes[i];
    if (blocos.has(pai) || blocos.has(secao)) continue;
    const lista = filhas.get(pai);
    if (lista) lista.push(secao);
    else filhas.set(pai, [secao]);
  }
  const avisos: Aviso[] = [];
  for (const [pai, lista] of filhas) {
    if (lista.length !== 1) continue;
    const filha = lista[0];
    if (!numeroDoTitulo(pai.titulo) || !numeroDoTitulo(filha.titulo)) continue;
    avisos.push({
      from: filha.tituloFrom,
      to: filha.tituloTo,
      mensagem: `[ABNT NBR 6024:2012] Subseção única: “${filha.titulo}” é a única subseção de “${pai.titulo}” — a divisão de uma seção pede pelo menos duas subseções; junte o texto à seção superior ou crie a subseção irmã.`,
    });
  }
  return avisos;
};

export const VERIFICADORES: Record<string, Verificador> = {
  "sumario-bate-titulos": sumarioBateTitulos,
  "sumario-sem-pretextuais": sumarioSemPretextuais,
  "numeracao-progressiva": numeracaoProgressiva,
  "subsecao-unica": subsecaoUnica,
};
