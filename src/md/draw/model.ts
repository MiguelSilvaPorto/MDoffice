// Tipos do desenho (pontos, elementos, documento) e constantes comuns.

import { h } from "../../util";

export interface Pt {
  x: number;
  y: number;
}

export type ElType = "pen" | "line" | "arrow" | "rect" | "ellipse" | "text" | "poly";

export interface BaseEl {
  id: string;
  type: ElType;
  color: string;
  width: number;
}

export interface PenEl extends BaseEl {
  type: "pen";
  points: Pt[];
}

export interface LineEl extends BaseEl {
  type: "line" | "arrow";
  a: Pt;
  b: Pt;
  /** id da forma onde a ponta inicial está ligada (se houver) */
  fromId?: string;
  /** id da forma onde a ponta final está ligada (se houver) */
  toId?: string;
  /** ângulo de fixação na borda da forma (guarda a posição da ligação) */
  fromAngle?: number;
  toAngle?: number;
}

export interface ShapeEl extends BaseEl {
  type: "rect" | "ellipse";
  a: Pt;
  b: Pt;
  fill: string | null;
}

export interface PolyEl extends BaseEl {
  type: "poly";
  points: Pt[];
  fill: string | null;
}

export interface TextEl extends BaseEl {
  type: "text";
  pos: Pt;
  text: string;
  fontSize: number;
}

export type DrEl = PenEl | LineEl | ShapeEl | PolyEl | TextEl;

export interface DrawDoc {
  version: number;
  w: number;
  h: number;
  elements: DrEl[];
}

export type Tool = "select" | "pen" | "line" | "arrow" | "rect" | "ellipse" | "text" | "eraser";

export const FONT_STACK = `Inter, "Segoe UI", system-ui, -apple-system, sans-serif`;
export const LINE_HEIGHT = 1.25;
export const OUT_PAD = 26;
export const MAGNET = 6; // raio do "ímã" de alinhamento (px)

export const dist2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
