// Verificadores de TABELAS e FIGURAS (normas IBGE e NBR 14724).
//
// Regras que usam este arquivo: T01 (título acima da tabela / "Fonte:" abaixo),
// T02 (figura: legenda acima, fonte abaixo), E11 (listas só com itens existentes).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
//
// Decisões que a leitura do arquivo não conta sozinha:
//
// - A vizinhança é medida em LINHAS e ignora as vazias: título/legenda é a primeira linha
//   não vazia de cima; fonte, a primeira de baixo. A fonte só é aceita na forma da norma
//   ("Fonte:", com os dois-pontos) — tolera negrito, crases, lista e "Fontes:".
// - O aviso de fonte ausente sai SEM substituição de propósito: a máquina não sabe a
//   autoria (fonte de terceiros é o caso comum), então diz o que fazer sem inventar a troca.
// - Falso positivo é pior que falso negativo: o item de lista só é acusado quando a
//   identificação dele ("Tabela 5", "Figura 2") não aparece em NENHUM lugar do texto fora
//   da própria lista; a sigla, quando nenhuma palavra do texto casa com ela. A lista vazia
//   é o caso seguro por definição (não há item nenhum para existir).

import type { Documento, Linha, Secao, TipoLinha } from "../documento";
import { opcaoLista, opcaoTexto, type Aviso, type Verificador } from "./tipos";

/** Um bloco do documento: linhas consecutivas do mesmo tipo (a tabela inteira, a figura). */
interface Bloco {
  primeira: number;
  ultima: number;
}

/** Os blocos de linhas consecutivas de um tipo, em ordem. */
function blocosDe(doc: Documento, tipo: TipoLinha): Bloco[] {
  const blocos: Bloco[] = [];
  let i = 0;
  while (i < doc.linhas.length) {
    if (doc.linhas[i].tipo !== tipo) {
      i++;
      continue;
    }
    const primeira = i;
    while (i + 1 < doc.linhas.length && doc.linhas[i + 1].tipo === tipo) i++;
    blocos.push({ primeira, ultima: i });
    i++;
  }
  return blocos;
}

/** O índice da primeira linha NÃO vazia acima (passo −1) ou abaixo (passo +1); −1 se não há. */
function vizinha(doc: Documento, linha: number, passo: -1 | 1): number {
  for (let i = linha + passo; i >= 0 && i < doc.linhas.length; i += passo) {
    if (doc.linhas[i].tipo !== "vazio") return i;
  }
  return -1;
}

/** A linha sem a marcação que não muda o que ela diz: `**`, `_`, crases, `#` do título e item de lista. */
function semMarcacao(texto: string): string {
  return texto
    .replace(/[*_`]/g, "")
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/^\s*[-+•]\s+/, "")
    .trim();
}

/** A linha começa com um dos rótulos, como palavra inteira ("Tabela 1 – …", "FIGURA: …")? */
function comecaComRotulo(texto: string, rotulos: string[]): boolean {
  const limpo = semMarcacao(texto);
  return rotulos.some((rotulo) => {
    if (limpo.slice(0, rotulo.length).toLowerCase() !== rotulo.toLowerCase()) return false;
    const seguinte = limpo.slice(rotulo.length, rotulo.length + 1);
    return seguinte === "" || !/[\p{L}\p{N}]/u.test(seguinte);
  });
}

/** A linha é a fonte ("Fonte: …", "**Fontes:** …"), com o rótulo e os dois-pontos? */
function comecaComFonte(texto: string, rotulo: string): boolean {
  const limpo = semMarcacao(texto);
  const palavra = limpo.match(/^\p{L}+/u)?.[0].toLowerCase();
  if (!palavra) return false;
  const alvo = rotulo.toLowerCase();
  if (palavra !== alvo && palavra !== `${alvo}s`) return false;
  return /^\s*:/.test(limpo.slice(palavra.length));
}

/** O que o verificador precisa saber de cada elemento (tabela/imagem) para conferir a vizinhança. */
interface Elemento {
  tipo: TipoLinha;
  /** rótulos aceitos na linha de cima ("Tabela", "Quadro", "Figura"…) */
  rotulos: string[];
  /** rótulo da fonte aceito na linha de baixo ("Fonte") */
  rotuloFonte: string;
  /** cabeçalho da norma que abre a mensagem ("[IBGE]", "[ABNT NBR 14724:2024]") */
  referencia: string;
  /** como o elemento é chamado na mensagem ("tabela", "figura") */
  nome: string;
  /** como o título é chamado na mensagem ("título", "legenda") */
  nomeTitulo: string;
  /** exemplo de identificação para a mensagem ("Tabela 1 – …") */
  exemplo: string;
  /** ressalva da fonte, quando a norma condiciona algo (" quando não for de autoria própria") */
  ressalvaFonte: string;
}

/** T01/T02 — identificação/legenda acima e fonte abaixo, nas linhas vizinhas de cada bloco. */
function conferirVizinhanca(doc: Documento, elemento: Elemento): Aviso[] {
  const avisos: Aviso[] = [];
  for (const bloco of blocosDe(doc, elemento.tipo)) {
    const primeira = doc.linhas[bloco.primeira];
    const ultima = doc.linhas[bloco.ultima];

    const acima = vizinha(doc, bloco.primeira, -1);
    if (acima < 0 || !comecaComRotulo(doc.linhas[acima].texto, elemento.rotulos)) {
      const onde = acima < 0 ? "não há nada acima" : "o que está acima não está nesse formato";
      avisos.push({
        from: primeira.from,
        to: primeira.to,
        mensagem:
          `${elemento.referencia} A ${elemento.nome} pede identificação e ${elemento.nomeTitulo} na linha ` +
          `imediatamente acima (“${elemento.exemplo}”); ${onde} — confira e acrescente o ${elemento.nomeTitulo}.`,
      });
    }

    const abaixo = vizinha(doc, bloco.ultima, 1);
    if (abaixo < 0 || !comecaComFonte(doc.linhas[abaixo].texto, elemento.rotuloFonte)) {
      const onde = abaixo < 0 ? "o documento termina aqui" : "não encontrei essa linha";
      avisos.push({
        from: ultima.from,
        to: ultima.to,
        mensagem:
          `${elemento.referencia} A ${elemento.nome} pede a fonte logo abaixo (“${elemento.rotuloFonte}: …”)` +
          `${elemento.ressalvaFonte}; ${onde} — acrescente a fonte.`,
      });
    }
  }
  return avisos;
}

/** As linhas com conteúdo do corpo da seção (fora a linha do título). */
function linhasDoCorpo(doc: Documento, secao: Secao): Linha[] {
  return doc.linhas.filter((linha) => linha.tipo !== "vazio" && linha.from >= secao.corpoFrom && linha.from < secao.to);
}

/** O texto do documento FORA da seção (o mesmo comprimento, para as posições seguirem válidas). */
function foraDaSecao(doc: Documento, secao: Secao): string {
  const vazio = " ".repeat(Math.max(0, secao.to - secao.from));
  return doc.texto.slice(0, secao.from) + vazio + doc.texto.slice(secao.to);
}

/** "Tabela 1", "Quadro 2.1"… — a identificação que o item de lista promete. */
const IDENTIFICACAO_TABELA = /(tabela|quadro)\s*(\d+(?:[.,]\d+)*)/giu;

/** Identificação de ilustração ("Figura 1", "Gráfico 2"…) para a lista de figuras. */
const IDENTIFICACAO_FIGURA =
  /(figura|ilustra[çc][ãa]o|gr[áa]fico|imagem|quadro|fotografia|mapa|esquema|fluxograma|organograma|diagrama)\s*(\d+(?:[.,]\d+)*)/giu;

/** Escapa o texto para entrar num RegExp. */
function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** O rótulo+número aparece em algum lugar de `fora` (com zero à esquerda e ponto/vírgula tolerados)? */
function existeNoTexto(fora: string, rotulo: string, numero: string): boolean {
  const limpo = numero.replace(/(^|[.,])0+(?=\d)/g, "$1");
  const fonte = `${escapar(rotulo)}\\s*0*${escapar(limpo).replace(/\\\./g, "[.,]")}`;
  return new RegExp(fonte, "iu").test(fora);
}

/**
 * E11 — cada item da lista de figuras/tabelas aponta para algo que o documento tem? A
 * identificação é procurada no texto FORA da própria lista (a lista não satisfaz a si mesma).
 */
function conferirIdentificacoes(doc: Documento, secao: Secao, corpo: Linha[], identificacao: RegExp): Aviso[] {
  const avisos: Aviso[] = [];
  const fora = foraDaSecao(doc, secao);
  for (const linha of corpo) {
    const achadas = [...linha.texto.matchAll(identificacao)];
    if (!achadas.length) continue;
    if (achadas.some((m) => existeNoTexto(fora, m[1], m[2]))) continue;
    avisos.push({
      from: linha.from,
      to: linha.to,
      mensagem:
        `[ABNT NBR 14724:2024] A lista aponta para “${achadas[0][1]} ${achadas[0][2]}”, que não existe ` +
        `(ou não está identificada) no documento — a lista deve conter só os itens que existem: ` +
        `confira a numeração ou remova o item.`,
    });
  }
  return avisos;
}

/** A sigla que o item de lista relaciona, no começo da linha ("ABNT – …", "IBGE: …"). */
const SIGLA_NO_ITEM = /^\s*(?:[-*+•]\s*|\d{1,3}[.)]\s*)?([\p{Lu}][\p{Lu}\d.]{1,})(?=[\s:;,\u2013\u2014-]|$)/u;

/** E11 — cada sigla da lista é usada em algum lugar do texto (fora da própria lista)? */
function conferirSiglas(doc: Documento, secao: Secao, corpo: Linha[]): Aviso[] {
  const avisos: Aviso[] = [];
  const palavras = new Set<string>();
  for (const palavra of foraDaSecao(doc, secao).matchAll(/[\p{L}\p{N}]+/gu)) palavras.add(palavra[0].toLowerCase());
  for (const linha of corpo) {
    const achada = SIGLA_NO_ITEM.exec(linha.texto);
    if (!achada) continue;
    const sigla = achada[1].replace(/\.+$/, "");
    if (palavras.has(sigla.toLowerCase())) continue;
    avisos.push({
      from: linha.from,
      to: linha.to,
      mensagem:
        `[ABNT NBR 14724:2024] A sigla “${sigla}” está na lista, mas não é usada no texto — a lista ` +
        `relaciona só as siglas utilizadas: remova o item ou use a sigla.`,
    });
  }
  return avisos;
}

export const VERIFICADORES: Record<string, Verificador> = {
  /** T01 — tabela (IBGE): identificação e título acima; "Fonte:" abaixo. */
  "tabela-titulo-e-fonte": (doc, regra) =>
    conferirVizinhanca(doc, {
      tipo: "tabela",
      rotulos: opcaoLista(regra, "rotulos_titulo", ["Tabela", "Quadro"]),
      rotuloFonte: opcaoTexto(regra, "rotulo_fonte", "Fonte"),
      referencia: "[IBGE]",
      nome: "tabela",
      nomeTitulo: "título",
      exemplo: "Tabela 1 – …",
      ressalvaFonte: "",
    }),

  /** T02 — figura (14724): identificação e legenda acima; fonte abaixo quando de terceiros. */
  "figura-legenda-e-fonte": (doc, regra) =>
    conferirVizinhanca(doc, {
      tipo: "imagem",
      rotulos: opcaoLista(regra, "rotulos_legenda", ["Figura", "Ilustração", "Gráfico", "Imagem", "Quadro"]),
      rotuloFonte: opcaoTexto(regra, "rotulo_fonte", "Fonte"),
      referencia: "[ABNT NBR 14724:2024]",
      nome: "figura",
      nomeTitulo: "legenda",
      exemplo: "Figura 1 – …",
      ressalvaFonte: " quando não for de autoria própria",
    }),

  /** E11 — listas pré-textuais: vazias, ou com item que o documento não tem. */
  "listas-itens-existentes": (doc, regra) => {
    const nomes = opcaoLista(regra, "listas", ["lista-de-figuras", "lista-de-tabelas", "lista-de-siglas"]);
    const avisos: Aviso[] = [];
    for (const nome of nomes) {
      for (const secao of doc.blocos[nome] ?? []) {
        const corpo = linhasDoCorpo(doc, secao);
        if (!corpo.length) {
          avisos.push({
            from: secao.tituloFrom,
            to: secao.tituloTo,
            mensagem:
              `[ABNT NBR 14724:2024] “${secao.titulo}” está sem nenhum item — a lista só existe quando ` +
              `há o que listar: remova a lista (ou acrescente os itens que faltam).`,
          });
          continue;
        }
        if (nome === "lista-de-tabelas") avisos.push(...conferirIdentificacoes(doc, secao, corpo, IDENTIFICACAO_TABELA));
        else if (nome === "lista-de-figuras") avisos.push(...conferirIdentificacoes(doc, secao, corpo, IDENTIFICACAO_FIGURA));
        else if (nome === "lista-de-siglas") avisos.push(...conferirSiglas(doc, secao, corpo));
      }
    }
    return avisos;
  },
};
