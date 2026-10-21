// A âncora da imagem flutuante: o pedaço de texto que "segura" a imagem.
//
// No WordCraft (ArtCraft — MIT OR Apache-2.0) a âncora de um objeto flutuante é o
// caractere U+FFFC dentro do parágrafo; no mdOffice a âncora é o próprio NÓ da
// imagem no texto — o mesmo desenho. Por isso "mover a imagem pelo texto" é mover
// o nó: a âncora muda junto, e o texto se acomoda em volta no ponto novo.
//
// A técnica do arrasto é a do WordCraft (`engine/src/cmd/objects.rs`, `move_object_once`):
// o arrasto escolhe o parágrafo que fica sob a BORDA SUPERIOR da imagem, tira o
// objeto de onde ele está e o reinsere naquele parágrafo; o deslocamento é
// recalculado a partir da nova âncora, para a imagem continuar onde foi solta.

import type { Node as PMNode } from "prosemirror-model";
import { NodeSelection, type EditorState, type Transaction } from "prosemirror-state";
import { moverImagem } from "./imagemMover";
import { deixarImagemSozinha } from "./imagemFlutuante";

/** Onde a imagem ficaria ancorada, se o arrasto fosse solto agora. */
export interface AncoraCandidata {
  /** a posição do texto onde a imagem entraria (dentro do parágrafo) */
  pos: number;
  /** a posição do parágrafo que ficaria com a imagem */
  paragrafo: number;
}

/** O parágrafo (ou título) que contém a posição — o dono da âncora. */
export function paragrafoDa(state: EditorState, pos: number): number | null {
  const $pos = state.doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    const tipo = $pos.node(d).type.name;
    if (tipo === "paragraph" || tipo === "heading") return $pos.before(d);
  }
  // na BORDA entre dois blocos (o navegador devolve assim quando o ponto cai
  // entre parágrafos): o texto de ali é o do bloco que vem DEPOIS — ou do
  // anterior, se a posição for no fim do documento.
  const depois = $pos.nodeAfter;
  if (depois && (depois.type.name === "paragraph" || depois.type.name === "heading")) return $pos.pos;
  const antes = $pos.nodeBefore;
  if (antes && (antes.type.name === "paragraph" || antes.type.name === "heading")) {
    return $pos.pos - antes.nodeSize;
  }
  return null;
}

/**
 * A âncora candidata: o parágrafo em que a imagem cairia.
 *
 * `texto` é a posição do texto sob o ponteiro (o `posAtCoords` do ProseMirror). A
 * imagem entra no COMEÇO desse parágrafo — é o parágrafo que vira o flutuante, e
 * ele precisa da imagem sozinho.
 */
export function ancoraCandidata(state: EditorState, texto: number): AncoraCandidata | null {
  const paragrafo = paragrafoDa(state, texto);
  if (paragrafo == null) return null;
  return { pos: paragrafo + 1, paragrafo };
}

/** A imagem está ancorada neste parágrafo? */
export function ancoradaEm(state: EditorState, pos: number, paragrafo: number): boolean {
  return paragrafoDa(state, pos) === paragrafo;
}

/**
 * Move a imagem para outro parágrafo — a âncora muda e o texto passa a se
 * acomodar em volta no ponto novo.
 *
 * A imagem fica **sozinha** no parágrafo novo (o flutuante É o parágrafo: com
 * texto dividindo o parágrafo, o texto do próprio parágrafo ficaria espremido na
 * caixa do flutuante). Devolve a transação e a nova posição da imagem.
 */
export function moverParaParagrafo(
  state: EditorState,
  pos: number,
  destino: number
): { tr: Transaction; pos: number } | null {
  const no: PMNode | null = state.doc.nodeAt(pos);
  if (!no || no.type.name !== "image") return null;
  const movido = moverImagem(state, pos, destino);
  if (!movido) return null;
  const sobra = deixarImagemSozinha(movido.tr, movido.destino);
  const tr = sobra.tr;
  const imagem = tr.doc.nodeAt(sobra.pos);
  if (!imagem || imagem.type.name !== "image") return null;
  tr.setSelection(NodeSelection.create(tr.doc, sobra.pos));
  return { tr, pos: sobra.pos };
}
