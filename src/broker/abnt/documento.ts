// ABNT — o modelo do documento que as regras de contexto e os verificadores enxergam.
//
// O motor de texto roda sobre a máscara e não sabe de estrutura: a regra das horas não
// precisa saber onde está. As regras novas (referências, resumo, sumário, figuras)
// precisam — e este é o único lugar que responde "onde começa a seção de referências",
// "quais linhas formam um parágrafo", "o que aqui é citação".
//
// Uma leitura por texto, compartilhada (cache de uma entrada, como o `checkStyle`): o
// mesmo texto passa por todas as regras do ciclo, e a leitura é a mesma.
//
// O modelo é lido do TEXTO ORIGINAL (não da máscara): a máscara esconde código e link
// com `·`, e um título mascarado deixaria de ser título. Quem decide o que ignorar é
// quem escreve a regra — mas as linhas já vêm tipadas para não precisar de adivinhação
// linha a linha.

import { BLOCOS, normalizarTitulo, tituloCasa } from "./esquema";

export type TipoLinha =
  | "vazio"
  | "titulo"
  | "cerca"
  | "codigo"
  | "citacao"
  | "lista"
  | "tabela"
  | "imagem"
  | "regua"
  | "texto";

export interface Linha {
  from: number;
  to: number;
  tipo: TipoLinha;
  texto: string;
}

/** Bloco de linhas consecutivas não vazias: é a unidade de uma referência, de um parágrafo. */
export interface Paragrafo {
  from: number;
  to: number;
  tipo: TipoLinha;
  texto: string;
}

export interface Secao {
  nivel: number;
  titulo: string;
  /** faixa do título na linha, sem os `#` */
  tituloFrom: number;
  tituloTo: number;
  /** da linha do título até o próximo título de nível igual ou menor (ou o fim) */
  from: number;
  to: number;
  /** fim do conteúdo, sem as linhas vazias do fim */
  fimDoConteudo: number;
  /** onde o conteúdo começa (linha depois do título) */
  corpoFrom: number;
}

export interface Faixa {
  from: number;
  to: number;
}

export interface Documento {
  texto: string;
  linhas: Linha[];
  /** trechos de linhas consecutivas não vazias */
  paragrafos: Paragrafo[];
  secoes: Secao[];
  /** as seções que casam com cada bloco conhecido (chaves de `BLOCOS`) */
  blocos: Record<string, Secao[]>;
  /** faixas mescladas do texto cobertas pelos blocos pedidos */
  regioesDeBlocos(nomes: string[]): Faixa[];
  /** a faixa está inteira dentro de algum dos blocos pedidos? */
  estaEmBloco(nomes: string[], from: number, to: number): boolean;
}

const ERA_TITULO = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ERA_CERCA = /^\s*(```|~~~)/;
const ERA_TABELA = /^\s*\|/;
const ERA_LINHA_TABELA = /^\s*\|?[\s:|-]*\|[\s:|-]*$/;
const ERA_CITACAO = /^\s*>/;
const ERA_LISTA = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;
const ERA_REGUA = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const ERA_IMAGEM = /^\s*!\[/;

function classificarLinha(texto: string): TipoLinha {
  if (!texto.trim()) return "vazio";
  if (ERA_CERCA.test(texto)) return "cerca";
  if (ERA_TITULO.test(texto)) return "titulo";
  if (ERA_REGUA.test(texto)) return "regua";
  if (ERA_CITACAO.test(texto)) return "citacao";
  if (ERA_IMAGEM.test(texto)) return "imagem";
  if (ERA_TABELA.test(texto) || ERA_LINHA_TABELA.test(texto)) return "tabela";
  if (ERA_LISTA.test(texto)) return "lista";
  return "texto";
}

function montar(texto: string): Documento {
  // linhas com posição: o \r do CRLF fica fora da faixa (o app normaliza para LF antes,
  // mas o modelo não depende disso para estar certo)
  const linhas: Linha[] = [];
  {
    let inicio = 0;
    for (;;) {
      const quebra = texto.indexOf("\n", inicio);
      const fimBruto = quebra < 0 ? texto.length : quebra;
      let fim = fimBruto;
      if (fim > inicio && texto[fim - 1] === "\r") fim--;
      linhas.push({ from: inicio, to: fim, tipo: "texto", texto: texto.slice(inicio, fim) });
      if (quebra < 0) break;
      inicio = quebra + 1;
    }
  }

  // tipagem das linhas: cerca e código, front-matter, e o resto pela forma
  let emCerca = false;
  let emFrontMatter = linhas.length > 0 && /^---\s*$/.test(linhas[0].texto);
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (emCerca) {
      l.tipo = /^\s*(```|~~~)/.test(l.texto) ? "cerca" : "codigo";
      if (l.tipo === "cerca") emCerca = false;
      continue;
    }
    if (ERA_CERCA.test(l.texto)) {
      emCerca = true;
      l.tipo = "cerca";
      continue;
    }
    if (emFrontMatter) {
      // o `---` do topo começa e termina o front-matter; o que está dentro não é texto
      l.tipo = /^---\s*$/.test(l.texto) && i > 0 ? "regua" : "codigo";
      if (l.tipo === "regua") emFrontMatter = false;
      continue;
    }
    l.tipo = classificarLinha(l.texto);
  }

  // parágrafos: linhas consecutivas não vazias
  const paragrafos: Paragrafo[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].tipo === "vazio") continue;
    let fim = i;
    while (fim + 1 < linhas.length && linhas[fim + 1].tipo !== "vazio") fim++;
    const de = linhas[i].from;
    const ate = linhas[fim].to;
    paragrafos.push({ from: de, to: ate, tipo: linhas[i].tipo, texto: texto.slice(de, ate) });
    i = fim;
  }

  // seções: da linha do título até o próximo título de nível igual ou menor
  const titulos: { nivel: number; titulo: string; tituloFrom: number; tituloTo: number; linha: number }[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.tipo !== "titulo") continue;
    const m = ERA_TITULO.exec(l.texto);
    if (!m) continue;
    const depois = l.texto.slice(m[1].length);
    const espacos = depois.length - depois.replace(/^\s+/, "").length;
    const tituloFrom = l.from + m[1].length + espacos;
    titulos.push({ nivel: m[1].length, titulo: m[2], tituloFrom, tituloTo: tituloFrom + m[2].length, linha: i });
  }

  const secoes: Secao[] = titulos.map((t, n) => {
    let fimLinha = linhas.length - 1;
    for (let k = n + 1; k < titulos.length; k++) {
      if (titulos[k].nivel <= t.nivel) {
        fimLinha = titulos[k].linha - 1;
        break;
      }
    }
    const to = fimLinha + 1 < linhas.length ? linhas[fimLinha + 1].from : texto.length;
    // fim do conteúdo: anda para trás enquanto a linha é vazia
    let ultima = fimLinha;
    while (ultima > t.linha && linhas[ultima].tipo === "vazio") ultima--;
    const fimDoConteudo = linhas[ultima].to;
    return {
      nivel: t.nivel,
      titulo: t.titulo,
      tituloFrom: t.tituloFrom,
      tituloTo: t.tituloTo,
      from: linhas[t.linha].from,
      to,
      fimDoConteudo,
      corpoFrom: t.linha + 1 < linhas.length ? linhas[t.linha + 1].from : linhas[t.linha].to,
    };
  });

  // blocos: casa o título normalizado com os sinônimos conhecidos
  const blocos: Record<string, Secao[]> = {};
  for (const secao of secoes) {
    const normalizado = normalizarTitulo(secao.titulo);
    for (const [nome, sinonimos] of Object.entries(BLOCOS)) {
      if (sinonimos.some((sinonimo) => tituloCasa(normalizado, sinonimo))) {
        (blocos[nome] ??= []).push(secao);
        break; // um título é de um bloco só (os sinônimos de `BLOCOS` não se sobrepõem)
      }
    }
  }

  const cacheRegioes = new Map<string, Faixa[]>();
  const regioesDeBlocos = (nomes: string[]): Faixa[] => {
    const chave = [...nomes].sort().join("\u0000");
    const memo = cacheRegioes.get(chave);
    if (memo) return memo;
    const faixas: Faixa[] = [];
    for (const nome of nomes) for (const secao of blocos[nome] ?? []) faixas.push({ from: secao.from, to: secao.to });
    faixas.sort((a, b) => a.from - b.from);
    const mescladas: Faixa[] = [];
    for (const faixa of faixas) {
      const ultima = mescladas[mescladas.length - 1];
      if (ultima && faixa.from <= ultima.to) ultima.to = Math.max(ultima.to, faixa.to);
      else mescladas.push({ ...faixa });
    }
    cacheRegioes.set(chave, mescladas);
    return mescladas;
  };

  return {
    texto,
    linhas,
    paragrafos,
    secoes,
    blocos,
    regioesDeBlocos,
    estaEmBloco(nomes, from, to) {
      return regioesDeBlocos(nomes).some((f) => from >= f.from && to <= f.to);
    },
  };
}

/** Memória de uma entrada, como o `checkStyle`: o mesmo texto é lido uma vez por ciclo. */
let cache: { chave: string; doc: Documento } | null = null;

export function documentoDe(texto: string): Documento {
  if (cache && cache.chave === texto) return cache.doc;
  const doc = montar(texto);
  cache = { chave: texto, doc };
  return doc;
}

/**
 * Âncora para aviso de "falta isto": aponta para a ÚLTIMA linha com conteúdo.
 *
 * A convenção existe porque o `push` do motor descarta aviso de trecho vazio — e um
 * aviso de ausência não tem trecho. Ancorar no fim é onde o elemento faltante entraria,
 * e é o que a mensagem explica.
 */
export function ancoraNoFim(doc: Documento): Faixa {
  for (let i = doc.linhas.length - 1; i >= 0; i--) {
    const l = doc.linhas[i];
    if (l.tipo !== "vazio" && l.texto.trim()) return { from: l.from, to: l.to };
  }
  return { from: 0, to: Math.min(1, doc.texto.length) };
}

/** Âncora para aviso "no documento": a PRIMEIRA linha com conteúdo. */
export function ancoraNoInicio(doc: Documento): Faixa {
  for (const l of doc.linhas) {
    if (l.tipo !== "vazio" && l.texto.trim()) return { from: l.from, to: l.to };
  }
  return { from: 0, to: Math.min(1, doc.texto.length) };
}

/** Conta palavras como o painel de estrutura: letras e números, com apóstrofo e hífen. */
export function contarPalavras(texto: string): number {
  return (texto.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}
