// Funções geométricas simples: distâncias, ponta de seta, medir texto.

import { h, clamp } from "../../util";
import { type Pt, FONT_STACK, LINE_HEIGHT } from "./model";

export function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function arrowHead(a: Pt, b: Pt, w: number): [Pt, Pt, Pt] {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = clamp(14 + w * 2.2, 14, 36);
  const half = len * 0.5;
  const p1 = { x: b.x - len * Math.cos(ang) + half * Math.sin(ang), y: b.y - len * Math.sin(ang) - half * Math.cos(ang) };
  const p2 = { x: b.x - len * Math.cos(ang) - half * Math.sin(ang), y: b.y - len * Math.sin(ang) + half * Math.cos(ang) };
  return [b, p1, p2];
}

export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return map[c];
  });
}

export function measureText(text: string, fontSize: number): { w: number; h: number } {
  if (!measureText.ctx) measureText.ctx = document.createElement("canvas").getContext("2d");
  const ctx = measureText.ctx!;
  ctx.font = `${fontSize}px ${FONT_STACK}`;
  const lines = text.split("\n");
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  return { w, h: lines.length * fontSize * LINE_HEIGHT };
}
measureText.ctx = null as CanvasRenderingContext2D | null;
