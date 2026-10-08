// Ligações entre formas: setas e linhas que “grudam” nas bordas.

import { h } from "../../util";
import { type Pt, type DrEl } from "./model";
import { bboxOfPoints } from "./recognize";
import { elBounds } from "./elements";

// ---------- ligações entre formas (setas/linhas que "grudam") ----------

/** Caixa usada para ligar pontas (caneta livre não entra). */
export function anchorBox(el: DrEl): { x: number; y: number; w: number; h: number } | null {
  switch (el.type) {
    case "rect":
    case "ellipse":
      return {
        x: Math.min(el.a.x, el.b.x),
        y: Math.min(el.a.y, el.b.y),
        w: Math.abs(el.b.x - el.a.x),
        h: Math.abs(el.b.y - el.a.y),
      };
    case "poly":
      return bboxOfPoints(el.points);
    case "text":
      return elBounds(el);
    default:
      return null;
  }
}

/** Centro da forma (usado nas ligações). */
export function shapeCenter(el: DrEl): Pt {
  const b = anchorBox(el) ?? elBounds(el);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Ângulo (em relação ao centro da forma) do ponto indicado. */
export function angleFrom(el: DrEl, p: Pt): number {
  const c = shapeCenter(el);
  return Math.atan2(p.y - c.y, p.x - c.x);
}

/** Ponto da borda da forma no ângulo indicado (fica fixo e acompanha a forma). */
export function borderPointAt(el: DrEl, angle: number): Pt {
  const b = anchorBox(el) ?? elBounds(el);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (el.type === "ellipse") {
    return { x: cx + (b.w / 2) * cos, y: cy + (b.h / 2) * sin };
  }
  const tx = cos !== 0 ? b.w / 2 / Math.abs(cos) : Infinity;
  const ty = sin !== 0 ? b.h / 2 / Math.abs(sin) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + cos * t, y: cy + sin * t };
}

/** Ponto da borda da forma na direção de `toward` (usado ao ligar as pontas). */
export function borderPointToward(el: DrEl, toward: Pt): Pt {
  return borderPointAt(el, angleFrom(el, toward));
}

/**
 * Distância até a borda da forma: positiva fora, negativa dentro
 * (o valor absoluto é a distância até o traço da forma).
 */
export function distanceToShapeBorder(el: DrEl, p: Pt): number {
  const b = anchorBox(el);
  if (!b || b.w === 0 || b.h === 0) return Infinity;
  if (el.type === "ellipse") {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = Math.max(b.w / 2, 1);
    const ry = Math.max(b.h / 2, 1);
    const v = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
    const minR = Math.min(rx, ry);
    return v <= 1 ? -(1 - v) * minR : (v - 1) * minR;
  }
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  if (p.x >= b.x && p.x <= x1 && p.y >= b.y && p.y <= y1) {
    return -Math.min(p.x - b.x, x1 - p.x, p.y - b.y, y1 - p.y);
  }
  const dx = Math.max(b.x - p.x, 0, p.x - x1);
  const dy = Math.max(b.y - p.y, 0, p.y - y1);
  return Math.hypot(dx, dy);
}
