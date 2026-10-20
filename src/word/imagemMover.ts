// Move a imagem no documento: tira o nó de `pos` e insere perto de `alvo` numa transação só
// (Ctrl+Z desfaz). Fica separado da view para poder ser testado sem navegador.
import type { Node as PMNode } from "prosemirror-model";
import { TextSelection, type EditorState, type Transaction } from "prosemirror-state";

/** Devolve a transação que move a imagem e a posição final dela (ou null se o destino não serve). */
export function moverImagem(state: EditorState, pos: number, alvo: number): { tr: Transaction; destino: number } | null {
  const no: PMNode | null = state.doc.nodeAt(pos);
  if (!no) return null;
  const tr = state.tr.delete(pos, pos + no.nodeSize);
  const base = alvo > pos ? alvo - no.nodeSize : alvo;
  const destino = TextSelection.near(tr.doc.resolve(Math.max(0, Math.min(tr.doc.content.size, base))), 1).from;
  try {
    tr.insert(destino, no);
  } catch {
    return null; // destino inválido (fora de um parágrafo): a imagem fica onde estava
  }
  return { tr, destino };
}
