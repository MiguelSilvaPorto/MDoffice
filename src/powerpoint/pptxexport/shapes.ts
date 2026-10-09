// Converte as FORMAS do modelo em chamadas do PptxGenJS.
// A geometria do modelo está em % da lâmina; aqui vira polegadas (medida do
// layout definido em theme.ts). Por isso a caixa precisa ser multiplicada.

import { aspectSize } from "../schema";
import type { DeckSetup, Shape } from "../schema";
import { semHash } from "../themes";

/** Caixa em polegadas a partir da caixa em % e do tamanho da lâmina. */
export function caixaEmPol(box: Shape["box"], setup: DeckSetup): { x: number; y: number; w: number; h: number } {
  const { w: lw, h: lh } = aspectSize(setup);
  return { x: (box.x / 100) * lw, y: (box.y / 100) * lh, w: (box.w / 100) * lw, h: (box.h / 100) * lh };
}

/** Alinhamento do app → valor aceito pelo PptxGenJS. */
const ALIGN: Record<Shape["align"], string> = {
  esquerda: "left",
  centro: "center",
  direita: "right",
  justificado: "justify",
};

/** Descreve uma forma no formato que o addText/addImage/addShape esperam. */
export function propsDaForma(s: Shape, setup: DeckSetup, fgPadrao: string): Record<string, unknown> {
  const box = caixaEmPol(s.box, setup);
  return {
    ...box,
    fontSize: Math.max(4, Math.round(s.fontSize * 0.75)), // px da tela -> pt do .pptx
    fontFace: s.fontFamily.replace(/["']/g, ""),
    color: semHash(s.color, fgPadrao),
    bold: s.bold,
    italic: s.italic,
    align: ALIGN[s.align],
    valign: "top",
    rotate: s.rot || 0,
  };
}

/** Escreve a forma no slide. `slide` é uma instância de Slide do PptxGenJS. */
export function escreverForma(slide: { addText: Function; addImage: Function; addShape: Function; shapes?: Record<string, unknown> }, s: Shape, setup: DeckSetup, fgPadrao: string): void {
  const p = propsDaForma(s, setup, fgPadrao);
  if (s.kind === "imagem") {
    if (!s.src) return;
    slide.addImage({ ...p, path: s.src, sizing: { type: "contain", w: p.w as number, h: p.h as number } });
    return;
  }
  if (s.kind === "forma") {
    // retângulo preenchido, sem texto
    const nome = (slide.shapes?.RECTANGLE as string) ?? "rect";
    slide.addShape(nome, { ...p, fill: { color: semHash(s.fill, "4F46E5") }, line: { color: semHash(s.fill, "4F46E5") } });
    return;
  }
  slide.addText(s.text || "", { ...p, fill: { color: "FFFFFF", transparency: 100 }, line: { color: "FFFFFF", transparency: 100 } });
}