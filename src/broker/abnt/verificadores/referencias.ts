// Verificadores da LISTA de referências (NBR 6023) — a lista como um todo.
//
// Regras que usam este arquivo: R01 (a lista existe), R02 (ordem alfabética pela chave
// do primeiro sobrenome), R11 (citação ↔ referência, o cruzamento), R12 (destaque
// tipográfico uniforme no mesmo campo).
//
// A forma de CADA tipo de referência (R03–R10) mora em ./referencias-tipos.ts — outro
// trabalho; os dois arquivos não se misturam.
//
// As três decisões de precisão, todas na mesma direção (falso positivo é pior que falso
// negativo — a confiança do catálogo manda):
//
// 1. R01 só cobra a lista quando o documento mostra que é um trabalho: tem citação
//    autor-data ou um elemento pré/pós-textual do gênero (resumo, sumário, capa…). Nota
//    solta, rascunho e lista de compras não viram aviso.
// 2. R02/R12 só contam as entradas que PARECEM referência (têm ano ou "s.d."); um
//    parágrafo solto no meio da lista não entra na conta nem quebra a ordem.
// 3. R11 compara de forma folgada DE PROPÓSITO: uma citação só é acusada quando o
//    sobrenome não aparece em NENHUMA entrada com o mesmo ano. SOBRENOME composto,
//    entidade/sigla, "et al." e várias obras do mesmo autor casam por palavra — o que
//    deixa escapar ligação errada às vezes, mas não acusa ligação certa.
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.

import { maskNonProse } from "../../mask";
import { ancoraNoFim, type Documento, type Faixa } from "../documento";
import type { Aviso, Verificador } from "./tipos";

// ---------------------------------------------------------------- utilidades

/** Sem acento, minúsculo, só letras/números: é o que o colador e as buscas comparam. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ano de quatro dígitos no intervalo em que um trabalho pode ter sido publicado. */
const ANO = /(?:^|[^0-9])((?:1[5-9]|[2-9][0-9])[0-9]{2})(?![0-9])/g;

function anosDe(texto: string): Set<string> {
  const anos = new Set<string>();
  for (const m of texto.matchAll(ANO)) anos.add(m[1]);
  return anos;
}

/** "s.d."/"S. D." — a referência sem data, que a 6023 aceita. */
const SEM_DATA = /\bs\s*\.\s*d\s*\./i;

/** Trecho curto para a mensagem: uma linha, sem espaços dobrados. */
function trecho(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > 60 ? `${limpo.slice(0, 57)}…` : limpo;
}

// ---------------------------------------------------------------- a chave da entrada

/** Marcador de item de lista ("- ", "1. ", "2) ") no começo da entrada. */
const MARCA_LISTA = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;
/** Enfeite de Markdown/aspas no começo do campo (o `**` de "**SILVA**, João."). */
const MARCA_ENFEITE = /^[\s>*_`"'“”‘’]+/;
/** Fecha o enfeite do campo: o `**` que sobra de "SILVA**, João". */
const FECHA_ENFEITE = /[\s*_`"'“”‘’]+$/u;

/**
 * Artigos e preposições que abrem título — quando a entrada começa por eles e não tem
 * vírgula de autoria, a chave é incerta (a norma alfabeta por sobrenome/entidade, e o
 * título pode ou não contar o artigo). Melhor não opinar.
 */
const PALAVRAS_NEUTRAS = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas", "an", "the",
  "le", "la", "les", "el", "los", "las", "der", "die",
]);

/**
 * A chave de ordenação de uma entrada: o primeiro sobrenome (ou o primeiro elemento da
 * entidade), o campo antes da vírgula/ponto que fecha a autoria.
 *
 * Devolve `null` quando não dá para saber com segurança — o que é a resposta certa para
 * entrada por título, fragmento ("[S.l.: s.n.]") e parágrafo que nem é referência: quem
 * não sabe a chave não entra na conta.
 */
function chaveDaEntrada(texto: string): string | null {
  const limpo = texto.replace(MARCA_LISTA, "").replace(MARCA_ENFEITE, "").replace(/\s+/g, " ").trim();
  if (!limpo) return null;

  // o primeiro campo termina na vírgula da autoria, no ponto de fim de campo ou num
  // separador que não faz parte do nome (; : | ( ?)
  let fim = limpo.length;
  let virgula = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (c === ",") {
      fim = i;
      virgula = true;
      break;
    }
    if (c === ";" || c === ":" || c === "|" || c === "(" || c === "?") {
      fim = i;
      break;
    }
    if (c === "." && (i + 1 >= limpo.length || limpo[i + 1] === " ")) {
      fim = i;
      break;
    }
  }

  let chave = limpo.slice(0, fim).trim().replace(FECHA_ENFEITE, "").trim();
  chave = chave.replace(/[\s,;]*et\s*al\.?$/i, "").trim(); // "SILVA et al." → "SILVA"
  if (!chave || !/^\p{L}/u.test(chave)) return null;

  const palavras = chave.split(/\s+/);
  if (palavras.length > 8) return null; // não é campo de autoria; é frase
  if (!virgula && PALAVRAS_NEUTRAS.has(normalizar(palavras[0]))) return null;
  return chave;
}

// ---------------------------------------------------------------- o destaque do título

/** Latinismos que a 6023:2025 quer em itálico — não são o destaque do título. */
const EM_ITALICO_POR_NORMA = new Set([
  "et al", "et al.", "in", "in:", "s l", "s l.", "s n", "s n.", "s d", "s d.",
  "apud", "op cit", "id", "ibid", "grifo nosso",
]);

function ehLatinismo(conteudo: string): boolean {
  return EM_ITALICO_POR_NORMA.has(normalizar(conteudo));
}

/**
 * A entrada destaca o título? Negrito/itálico em algum campo, menos os latinismos que a
 * própria norma pede em itálico. O marcador de lista (`* item`) é retirado antes — senão
 * o asterisco do item viraria "destaque".
 *
 * É a leitura grosseira que a confiança baixa da R12 comporta: sabe dizer "a entrada
 * destaca algo", não "destaca o título" — e é por isso que a regra só acusa quando a
 * lista MISTURA entradas com e sem destaque.
 */
function temDestaque(texto: string): boolean {
  const corpo = texto.replace(MARCA_LISTA, "");
  for (const padrao of [/\*\*([^*\n]+)\*\*/g, /__([^_\n]+)__/g, /\*([^*\n]+)\*/g, /_([^_\n]+)_/g]) {
    for (const m of corpo.matchAll(padrao)) {
      if (!ehLatinismo(m[1])) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- as entradas da lista

/** Uma entrada da lista: a unidade que a 6023 chama de referência. */
interface Entrada {
  from: number;
  to: number;
  texto: string;
  /** chave do primeiro sobrenome/entidade (`null` quando não dá para saber) */
  chave: string | null;
  /** os anos citáveis da entrada (a base de "2020a") */
  anos: Set<string>;
  /** as palavras da entrada, normalizadas — a busca do cruzamento (R11) */
  palavras: Set<string>;
  /** a entrada destaca algum campo (fora dos latinismos)? */
  destaque: boolean;
}

function criarEntrada(doc: Documento, from: number, to: number): Entrada {
  const texto = doc.texto.slice(from, to);
  return {
    from,
    to,
    texto,
    chave: chaveDaEntrada(texto),
    anos: anosDe(texto),
    palavras: new Set(normalizar(texto).split(" ").filter(Boolean)),
    destaque: temDestaque(texto),
  };
}

/** O mesmo documento é lido por quatro verificadores: a lista de entradas é a mesma. */
const cacheEntradas = new WeakMap<Documento, Entrada[]>();

/**
 * As entradas do bloco `referencias`, na ordem em que aparecem no documento.
 *
 * Entrada = parágrafo do corpo (linhas consecutivas de texto), do jeito que o modelo do
 * documento já define "o que é um parágrafo" — e cada item de lista é uma entrada
 * própria, porque na lista de referências o item (`- SILVA…`) é a unidade. O título da
 * seção não entra; um subtítulo dentro da lista (### Sites) separa as entradas sem virar
 * uma.
 */
function entradasDe(doc: Documento): Entrada[] {
  const memo = cacheEntradas.get(doc);
  if (memo) return memo;

  const entradas: Entrada[] = [];
  for (const secao of doc.blocos["referencias"] ?? []) {
    const titulo = doc.linhas.findIndex((l) => l.from <= secao.tituloFrom && secao.tituloTo <= l.to);
    if (titulo < 0) continue;

    let from = -1;
    let to = -1;
    const fechar = () => {
      if (from < 0) return;
      entradas.push(criarEntrada(doc, from, to));
      from = -1;
    };
    for (let i = titulo + 1; i < doc.linhas.length; i++) {
      const linha = doc.linhas[i];
      if (linha.from >= secao.fimDoConteudo) break;
      if (linha.tipo === "lista") {
        fechar(); // cada item é uma referência
        from = linha.from;
        to = linha.to;
        continue;
      }
      if (linha.tipo === "texto") {
        if (from < 0) from = linha.from;
        to = linha.to;
        continue;
      }
      fechar();
    }
    fechar();
  }

  cacheEntradas.set(doc, entradas);
  return entradas;
}

// ---------------------------------------------------------------- as citações do texto

interface Citacao {
  /** como a citação aparece (autores, sem o ano) — para a mensagem */
  autores: string;
  /** as palavras dos autores, normalizadas — o casamento com a lista */
  tokens: string[];
  /** o ano-base, sem a letra de desambiguação ("2020a" → "2020") */
  ano: string;
  from: number;
  to: number;
}

/** "SILVA; COSTA, 2020" — uma citação autor-data com o ano. */
const CITACAO_COM_ANO =
  /^\s*(?<autores>.+?)\s*,\s*(?<ano>(?:1[5-9]|[2-9][0-9])[0-9]{2})[a-z]?\s*(?:,\s*p\.\s*[0-9]+(?:\s*[-–]\s*[0-9]+)?\s*)?$/u;

/** "Silva (2020)", "Silva e Costa (2020)" — a forma narrativa, autor fora do parêntese. */
const NARRATIVA =
  /(\p{Lu}[\p{L}'’.-]*(?:\s+(?:e|E|&)\s+\p{Lu}[\p{L}'’.-]*|\s+\p{Ll}{1,4}\s+\p{Lu}[\p{L}'’.-]*)*)\s*\(\s*((?:1[5-9]|[2-9][0-9])[0-9]{2})[a-z]?\s*(?:,\s*p\.\s*[0-9]+(?:\s*[-–]\s*[0-9]+)?\s*)?\)/gu;

/** Partículas que não fazem chave de autor ("Instituto DE Pesquisa", "Silva E Costa"). */
const PARTICULAS = new Set([
  "de", "da", "do", "das", "dos", "e", "di", "du", "del", "della", "der", "van", "von",
  "la", "le", "los", "las", "el", "y", "and", "cf", "apud", "org", "ed", "eds", "coord",
]);

function tokensDeAutores(autores: string): string[] {
  const tokens = new Set<string>();
  const partes = autores.split(";").flatMap((parte) => parte.split(/\s+(?:e|E|&)\s+/));
  for (const parte of partes) {
    const limpo = parte
      .replace(/\bet\s*al\.?\s*$/i, "")
      .replace(/[()]/g, " ")
      .replace(/\b(?:org|orgs|ed|eds|coord|coords)\.?\s*$/i, " ");
    for (const palavra of normalizar(limpo).split(" ")) {
      if (palavra.length >= 2 && !PARTICULAS.has(palavra)) tokens.add(palavra);
    }
  }
  return [...tokens];
}

/**
 * As citações autor-data dos parênteses, com a posição.
 *
 * "(Silva, 2020)" e "(Silva, 2020; Costa, 2019)" dão uma citação cada; "(SILVA; COSTA,
 * 2020)" é UMA citação (o ano vale para a lista de autores). Segmento sem ano é
 * ignorado — não há o que cruzar.
 */
function citacoesDoParenteses(conteudo: string, base: number): Citacao[] {
  const partes: { texto: string; inicio: number }[] = [];
  {
    let inicio = 0;
    for (const pedaco of conteudo.split(";")) {
      partes.push({ texto: pedaco, inicio: base + inicio });
      inicio += pedaco.length + 1;
    }
  }

  const citacoes: Citacao[] = [];
  let pendentes: { texto: string; inicio: number }[] = [];
  for (const parte of partes) {
    const m = CITACAO_COM_ANO.exec(parte.texto);
    if (!m) {
      pendentes.push(parte);
      continue;
    }
    const autores = [...pendentes.map((p) => p.texto.trim()), m.groups!.autores.trim()].filter(Boolean).join("; ");
    let from = pendentes.length ? pendentes[0].inicio : parte.inicio;
    let to = parte.inicio + parte.texto.length;
    while (from < to && /\s/.test(conteudo[from - base])) from++;
    while (to > from && /\s/.test(conteudo[to - 1 - base])) to--;
    citacoes.push({ autores, tokens: tokensDeAutores(autores), ano: m.groups!.ano, from, to });
    pendentes = [];
  }
  return citacoes;
}

/** A máscara e a varredura das citações valem para as quatro regras: uma leitura só. */
const cacheCitacoes = new WeakMap<Documento, Citacao[]>();

/**
 * Todas as citações autor-data do documento, fora da própria lista de referências (uma
 * citação dentro da lista seria outra coisa). O código e os links ficam de fora pela
 * máscara — é a mesma leitura do app.
 */
function citacoesDe(doc: Documento): Citacao[] {
  const memo = cacheCitacoes.get(doc);
  if (memo) return memo;

  const mask = maskNonProse(doc.texto);
  const regioes = doc.regioesDeBlocos(["referencias"]);
  const fora = (from: number, to: number) => regioes.some((f) => from >= f.from && to <= f.to);

  const citacoes: Citacao[] = [];
  for (const m of mask.matchAll(/\(([^()\n]*)\)/gu)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    if (fora(from, to)) continue;
    const dentro = citacoesDoParenteses(m[1], from + 1);
    // parêntese com UMA citação: o aviso cobre o parêntese inteiro — "(Furtado, 2019)";
    // com várias, cada segmento responde por si — "(Silva, 2020; Costa, 2019)"
    if (dentro.length === 1) {
      const citacao = dentro[0];
      const antes = m[1].slice(0, citacao.from - from - 1).trim();
      const depois = m[1].slice(citacao.to - from - 1).trim();
      if (!antes && !depois) {
        citacao.from = from;
        citacao.to = to;
      }
    }
    citacoes.push(...dentro);
  }
  for (const m of mask.matchAll(NARRATIVA)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    if (fora(from, to)) continue;
    const autores = m[1].trim();
    citacoes.push({ autores, tokens: tokensDeAutores(autores), ano: m[2], from, to });
  }

  cacheCitacoes.set(doc, citacoes);
  return citacoes;
}

/**
 * A citação tem entrada na lista? A busca é folgada DE PROPÓSITO: basta a entrada ter o
 * mesmo ano e UMA das palavras do autor em qualquer campo. SOBRENOME composto
 * ("SILVA JÚNIOR" casa "Silva"), entidade com sigla ("INSTITUTO… (IBGE)" casa "IBGE"),
 * vários autores ("SILVA; COSTA" casa os dois) e "et al." ficam cobertos pelo lado que
 * importa: não acusar o que existe.
 */
function temEntrada(entradas: Entrada[], citacao: Citacao): boolean {
  return entradas.some(
    (entrada) => entrada.anos.has(citacao.ano) && citacao.tokens.some((t) => entrada.palavras.has(t))
  );
}

// ---------------------------------------------------------------- R01 — a lista existe

/**
 * Blocos que marcam um trabalho acadêmico: se um deles existe, a lista de referências é
 * elemento exigido mesmo antes de qualquer citação — e sem citação a R11 não teria como
 * cobrar nada.
 */
const BLOCOS_DE_TRABALHO = [
  "capa", "folha-de-rosto", "folha-de-aprovacao", "resumo", "abstract", "sumario",
  "lista-de-figuras", "lista-de-tabelas", "lista-de-siglas", "lista-de-abreviaturas",
  "lista-de-simbolos", "glossario", "apendices", "anexos",
];

const referenciasExiste: Verificador = (doc) => {
  if ((doc.blocos["referencias"] ?? []).length) return [];

  const citacoes = citacoesDe(doc);
  const academico = BLOCOS_DE_TRABALHO.some((nome) => (doc.blocos[nome] ?? []).length > 0);
  if (!citacoes.length && !academico) return []; // nota solta não vira aviso

  const ancora = ancoraNoFim(doc);
  const motivo = citacoes.length
    ? `o texto cita obras (ex.: “(${citacoes[0].autores}, ${citacoes[0].ano})”)`
    : "o trabalho tem elementos pré-textuais (resumo, sumário…)";
  return [
    {
      from: ancora.from,
      to: ancora.to,
      mensagem:
        `[ABNT NBR 6023:2025] Falta a lista de referências: ${motivo} e não há a seção “REFERÊNCIAS”. ` +
        "Acrescente ao final o elemento pós-textual, sem numeração, com as obras citadas em ordem alfabética.",
    },
  ];
};

// ---------------------------------------------------------------- R02 — a ordem alfabética

/** A comparação da ordem é do colador do português — não uma ordenação inventada aqui. */
const COLADOR = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** A entrada parece uma referência de verdade (tem ano ou "s.d.")? */
const pareceReferencia = (entrada: Entrada): boolean => entrada.anos.size > 0 || SEM_DATA.test(entrada.texto);

const referenciasOrdem: Verificador = (doc) => {
  const entradas = entradasDe(doc).filter((e) => e.chave && pareceReferencia(e));
  const avisos: Aviso[] = [];
  for (let i = 1; i < entradas.length; i++) {
    const anterior = entradas[i - 1];
    const atual = entradas[i];
    if (COLADOR.compare(normalizar(atual.chave!), normalizar(anterior.chave!)) >= 0) continue;
    avisos.push({
      from: atual.from,
      to: atual.to,
      mensagem:
        `[ABNT NBR 6023:2025] Ordem alfabética: a entrada “${trecho(atual.texto)}” vem depois de ` +
        `“${trecho(anterior.texto)}”, mas deveria vir antes — reordene a lista pela chave do ` +
        "primeiro sobrenome (ou do primeiro elemento da entidade).",
    });
  }
  return avisos;
};

// ---------------------------------------------------------------- R11 — citação ↔ referência

const referenciasCruzamento: Verificador = (doc) => {
  // sem o bloco, quem cobra a lista é a R01 — não uma acusação por citação
  if (!(doc.blocos["referencias"] ?? []).length) return [];
  const entradas = entradasDe(doc);

  // uma citação só vira aviso uma vez, mesmo repetida no texto
  const unicas = new Map<string, { citacao: Citacao; vezes: number }>();
  for (const citacao of citacoesDe(doc)) {
    const chave = `${citacao.tokens.join(" ")}|${citacao.ano}`;
    const vista = unicas.get(chave);
    if (vista) vista.vezes++;
    else unicas.set(chave, { citacao, vezes: 1 });
  }

  const avisos: Aviso[] = [];
  for (const { citacao, vezes } of unicas.values()) {
    if (temEntrada(entradas, citacao)) continue;
    avisos.push({
      from: citacao.from,
      to: citacao.to,
      mensagem:
        `[ABNT NBR 6023:2025] Citação sem referência: “(${citacao.autores}, ${citacao.ano})” não consta ` +
        `da lista${vezes > 1 ? ` (aparece ${vezes} vezes no texto)` : ""} — inclua a referência ou remova/ajuste a citação.`,
    });
  }
  return avisos.sort((a, b) => a.from - b.from);
};

// ---------------------------------------------------------------- R12 — destaque uniforme

const referenciasDestaque: Verificador = (doc) => {
  const entradas = entradasDe(doc).filter(pareceReferencia);
  if (entradas.length < 2) return [];

  const com = entradas.filter((e) => e.destaque).length;
  const sem = entradas.length - com;
  if (!com || !sem) return []; // sem mistura não há o que padronizar

  const primeira = entradas.find((e) => !e.destaque)!;
  return [
    {
      from: primeira.from,
      to: primeira.to,
      mensagem:
        `[ABNT NBR 6023:2025] Destaque tipográfico do título: a lista mistura entradas com e sem ` +
        `destaque (${com} com, ${sem} sem) — esta está sem. Padronize o título de todas as entradas ` +
        "com o mesmo destaque (negrito ou itálico).",
    },
  ];
};

// ---------------------------------------------------------------- o registro

export const VERIFICADORES: Record<string, Verificador> = {
  "referencias-existe": referenciasExiste,
  "referencias-ordem": referenciasOrdem,
  "referencias-cruzamento": referenciasCruzamento,
  "referencias-destaque": referenciasDestaque,
};
