// Caracteres de traço (simples, duplo, ASCII) e como ler as conexões de cada um.

import { type TraceStyle } from "./model";

export const U = 1;
export const R = 2;
export const D = 4;
export const L = 8;

// índice = máscara U|R|D|L (0..15) → glifo
export const GLYPHS: Record<TraceStyle, string[]> = {
  single: [" ", "│", "─", "└", "│", "│", "┌", "├", "─", "┘", "─", "┴", "┐", "┤", "┬", "┼"],
  double: [" ", "║", "═", "╚", "║", "║", "╔", "╠", "═", "╝", "═", "╩", "╗", "╣", "╦", "╬"],
  ascii: [" ", "|", "-", "+", "|", "|", "+", "+", "-", "+", "-", "+", "+", "+", "+", "+"],
};

export const DIAGONALS: Record<TraceStyle, [string, string]> = {
  single: ["╱", "╲"],
  double: ["╱", "╲"],
  ascii: ["/", "\\"],
};

export const REVERSE: Record<TraceStyle, Map<string, number>> = {
  single: new Map(),
  double: new Map(),
  ascii: new Map(),
};
for (const style of ["single", "double", "ascii"] as TraceStyle[]) {
  GLYPHS[style].forEach((glyph, mask) => {
    if (mask === 0) return;
    if (!REVERSE[style].has(glyph)) REVERSE[style].set(glyph, mask);
  });
}
// Diagonais não participam do modelo de conexões.
REVERSE.single.set("╱", 0);
REVERSE.single.set("╲", 0);
REVERSE.double.set("╱", 0);
REVERSE.double.set("╲", 0);
REVERSE.ascii.set("/", 0);
REVERSE.ascii.set("\\", 0);

/** Descobre o estilo do traço olhando para o texto já desenhado. */
export function detectTraceStyle(text: string): TraceStyle {
  if (/[╔╗╚╝╠╣╦╩╬═║]/.test(text)) return "double";
  if (/[┌┐└┘├┤┬┴┼─│]/.test(text)) return "single";
  if (/-/.test(text) && /[+|]/.test(text)) return "ascii";
  return "single";
}
