// Dados do documento Word que não são texto: tamanho da página, margens, cabeçalho e rodapé.
import type { Node as PMNode } from "prosemirror-model";
import { schema } from "./schema";

export interface PageSetup {
  size: "A4" | "Letter";
  landscape: boolean;
  /** margens em centímetros */
  margins: { top: number; bottom: number; left: number; right: number };
  header: string;
  footer: string;
  /** número da página no rodapé (centralizado) */
  pageNumbers: boolean;
  defaultFont: string;
  /** tamanho padrão do texto em pontos */
  defaultSize: number;
}

export const DEFAULT_SETUP: PageSetup = {
  size: "A4",
  landscape: false,
  margins: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
  header: "",
  footer: "",
  pageNumbers: true,
  defaultFont: "Calibri",
  defaultSize: 11,
};

export const CM_TO_PX = 96 / 2.54;

/** Tamanho do papel em centímetros, já considerando a orientação. */
export function pageSizeCm(setup: PageSetup): { w: number; h: number } {
  const [wcm, hcm] = setup.size === "A4" ? [21, 29.7] : [21.59, 27.94];
  return setup.landscape ? { w: hcm, h: wcm } : { w: wcm, h: hcm };
}

/** Tamanho da folha em pixels (96 dpi) já considerando a orientação. */
export function pageSizePx(setup: PageSetup): { w: number; h: number } {
  const { w, h } = pageSizeCm(setup);
  return { w: Math.round(w * CM_TO_PX), h: Math.round(h * CM_TO_PX) };
}

/** Medidas dos títulos (iguais na tela e no .docx exportado). */
export const HEADING_STYLE: Record<number, { size: number; bold: boolean; italic?: boolean; before: number; after: number }> = {
  1: { size: 20, bold: true, before: 18, after: 8 },
  2: { size: 16, bold: true, before: 14, after: 6 },
  3: { size: 14, bold: true, before: 12, after: 4 },
  4: { size: 12, bold: true, before: 10, after: 4 },
  5: { size: 11, bold: true, before: 8, after: 3 },
  6: { size: 11, bold: true, italic: true, before: 8, after: 3 },
};

export interface WordSnapshot {
  v: 1;
  doc: unknown;
  setup: PageSetup;
}

/** Texto (JSON) guardado no histórico e nos rascunhos internos. */
export function serialize(doc: PMNode, setup: PageSetup): string {
  const snap: WordSnapshot = { v: 1, doc: doc.toJSON(), setup };
  return JSON.stringify(snap);
}

export function deserialize(text: string): { doc: PMNode; setup: PageSetup } | null {
  try {
    const snap = JSON.parse(text) as WordSnapshot;
    if (snap?.v !== 1) return null;
    return { doc: schema.nodeFromJSON(snap.doc), setup: { ...DEFAULT_SETUP, ...snap.setup, margins: { ...DEFAULT_SETUP.margins, ...snap.setup?.margins } } };
  } catch {
    return null;
  }
}

/** Texto de cabeçalho/rodapé com {pagina} e {total} trocados. */
export function fillHeaderFooter(text: string, page: number, total: number): string {
  return text.replace(/\{pagina\}/gi, String(page)).replace(/\{total\}/gi, String(total));
}
