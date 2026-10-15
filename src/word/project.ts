// Projeção do documento Word em texto puro — e o caminho de volta.
//
// O corretor e o formalizador trabalham em texto; o documento é ProseMirror. Aqui o
// documento vira texto (um parágrafo por linha) e cada bloco guarda de onde veio, para
// qualquer trecho achado no texto voltar à posição certa do documento.
//
// `projectRange` cobre também a SELEÇÃO: só os pedaços pedidos entram, e cada bloco
// copiado sabe em que ponto do documento ele começa.

import type { Node as PMNode } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";

export interface BlockMap {
  /** início do bloco no texto projetado */
  proj: number;
  /** posição no documento (ProseMirror) do 1º caractere copiado */
  pm: number;
  /** quantos caracteres o bloco copiou */
  len: number;
}

export interface Projecao {
  /** texto do documento (um parágrafo por linha) */
  texto: string;
  blocos: BlockMap[];
  /**
   * Linhas (índice em `blocos`/nas linhas do texto) que são **títulos** (`heading`).
   *
   * No Markdown o título começa com `#` e o corretor já o reconhece; no Word o bloco é um
   * `heading` e o texto projetado não tem marcador — sem esta lista, a regra do ponto final
   * pedia ponto num título ("TESTE DE ESCRITA.").
   */
  titulos: number[];
}

const limita = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Texto do documento (um parágrafo por linha) e o mapa de volta. `de`/`ate` são posições
 * do ProseMirror; sem elas, o documento inteiro.
 */
export function projectRange(doc: PMNode, de = 0, ate = doc.content.size): Projecao {
  const partes: string[] = [];
  const blocos: BlockMap[] = [];
  const titulos: number[] = [];
  let proj = 0;
  doc.descendants((node, pos) => {
    if (node.type.name === "code_block") return false;
    if (!node.isTextblock) return true;
    let t = "";
    node.forEach((child) => {
      t += child.isText ? child.text : " "; // imagem/quebra ocupam 1 posição: o espaço mantém o mapa 1:1
    });
    const inicio = pos + 1;
    const deLocal = limita(de - inicio, 0, t.length);
    const ateLocal = limita(ate - inicio, 0, t.length);
    // Parágrafo vazio continua entrando quando o pedaço o cobre: é ele que vira a linha
    // em branco do texto ("\n\n" entre parágrafos) — sem isso o mapa mudaria o que o
    // corretor vê em relação ao que sempre viu.
    const entra = ateLocal > deLocal || (t.length === 0 && de <= inicio && ate >= inicio);
    if (entra) {
      // título: a linha entra na lista antes do push (o índice é o da linha no texto)
      if (node.type.name === "heading") titulos.push(partes.length);
      blocos.push({ proj, pm: inicio + deLocal, len: ateLocal - deLocal });
      partes.push(t.slice(deLocal, ateLocal));
      proj += ateLocal - deLocal + 1; // +1 do "\n" que separa este bloco do próximo
    }
    return false;
  });
  return { texto: partes.join("\n"), blocos, titulos };
}

/** O documento inteiro (o caminho que o corretor usa). */
export const project = (doc: PMNode): Projecao => projectRange(doc);

/** De um índice no texto projetado para a posição no documento. */
export function toPm(blocos: BlockMap[], idx: number): { pos: number; bloco: number } | null {
  let lo = 0;
  let hi = blocos.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = blocos[mid];
    if (idx < b.proj) hi = mid - 1;
    else if (idx > b.proj + b.len) lo = mid + 1;
    else return { pos: b.pm + (idx - b.proj), bloco: mid };
  }
  return null;
}

/**
 * A transação que aplica as trocas no documento — cada uma no LUGAR dela (do fim para o
 * começo, para as posições não se mexerem), numa transação só: Ctrl+Z desfaz tudo. O texto
 * fora das trocas fica intacto, com o formato dele. `null` quando nenhuma troca entrou.
 *
 * `aplicadas` são os limites de cada troca no texto original (`de`) e no texto novo
 * (`para`) — o que a janela de formalização devolve.
 */
export function transacaoDasTrocas(
  state: EditorState,
  blocos: BlockMap[],
  novo: string,
  aplicadas: { de: [number, number]; para: [number, number] }[]
): Transaction | null {
  const tr = state.tr;
  let quantas = 0;
  for (const a of [...aplicadas].sort((x, y) => y.de[0] - x.de[0])) {
    const ini = toPm(blocos, a.de[0]);
    const fim = toPm(blocos, a.de[1] - 1);
    // troca que atravessaria parágrafos não entra (as regras não produzem nenhuma; o guarda
    // existe para o mapa nunca mentir)
    if (!ini || !fim || ini.bloco !== fim.bloco) continue;
    tr.insertText(novo.slice(a.para[0], a.para[1]), ini.pos, fim.pos + 1);
    quantas++;
  }
  return quantas ? tr : null;
}
