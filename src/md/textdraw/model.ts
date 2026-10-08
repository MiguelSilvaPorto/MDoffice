// Tipos e constantes do desenho em letras.

import { U, R, D, L } from "./glyphs";

export type TraceStyle = "single" | "double" | "ascii";

export interface TextDrawDoc {
  version: 1;
  kind: "text";
  cols: number;
  rows: number;
  style: TraceStyle;
  /** conexões por célula: máscara U|R|D|L (1|2|4|8) */
  conn: Record<string, number>;
  /** caracteres livres (letras, números, símbolos e campos [ ]) */
  chars: Record<string, string>;
}

export const TEXT_DRAW_PLACEHOLDER = "…desenhe aqui com letras e símbolos…";

export const MONO = `ui-monospace, "Cascadia Code", Consolas, monospace`;
export const CELL_FONT = 26;
export const DEFAULT_COLS = 64;
// mais linhas que colunas "proporcionais": com células quadradas, 64×40 dá um campo
// equilibrado (antes eram 22 linhas e o campo virava uma faixa horizontal)
export const DEFAULT_ROWS = 40;

export const key = (r: number, c: number) => `${r},${c}`;

export type TextTool = "select" | "pen" | "line" | "rect" | "text" | "field" | "table" | "eraser";
