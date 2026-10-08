// Operações sobre elementos: clonar, mover, medir e acertar cliques.

import { h, clamp } from "../../util";
import { type Pt, type DrEl, dist2 } from "./model";
import { distToSeg, measureText } from "./geometry";
import { bboxOfPoints } from "./recognize";

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function cloneEl(el: DrEl): DrEl {
  return structuredClone(el);
}

export function translateEl(el: DrEl, dx: number, dy: number): void {
  switch (el.type) {
    case "pen":
    case "poly":
      el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      break;
    case "line":
    case "arrow":
      el.a = { x: el.a.x + dx, y: el.a.y + dy };
      el.b = { x: el.b.x + dx, y: el.b.y + dy };
      break;
    case "rect":
    case "ellipse":
      el.a = { x: el.a.x + dx, y: el.a.y + dy };
      el.b = { x: el.b.x + dx, y: el.b.y + dy };
      break;
    case "text":
      el.pos = { x: el.pos.x + dx, y: el.pos.y + dy };
      break;
  }
}

export function elBounds(el: DrEl): { x: number; y: number; w: number; h: number } {
  const pad = Math.max(el.width / 2, 2);
  switch (el.type) {
    case "pen":
    case "poly": {
      const b = bboxOfPoints(el.points);
      if (!isFinite(b.x)) return { x: 0, y: 0, w: 0, h: 0 };
      return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    }
    case "line":
    case "arrow": {
      const headPad = el.type === "arrow" ? clamp(14 + el.width * 2.2, 14, 36) : 0;
      const p = pad + headPad;
      return {
        x: Math.min(el.a.x, el.b.x) - p,
        y: Math.min(el.a.y, el.b.y) - p,
        w: Math.abs(el.b.x - el.a.x) + p * 2,
        h: Math.abs(el.b.y - el.a.y) + p * 2,
      };
    }
    case "rect":
    case "ellipse":
      return {
        x: Math.min(el.a.x, el.b.x) - pad,
        y: Math.min(el.a.y, el.b.y) - pad,
        w: Math.abs(el.b.x - el.a.x) + pad * 2,
        h: Math.abs(el.b.y - el.a.y) + pad * 2,
      };
    case "text": {
      const m = measureText(el.text || " ", el.fontSize);
      return { x: el.pos.x - 2, y: el.pos.y - 2, w: m.w + 4, h: m.h + 4 };
    }
  }
}

/** Testa se um ponto está dentro de um polígono (ray casting). */
export function pointInPolygon(p: Pt, points: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const intersect = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function hitEl(el: DrEl, p: Pt, inside = true): boolean {
  const tol = Math.max(7, el.width + 4);
  switch (el.type) {
    case "pen":
      return el.points.some((q) => dist2(q, p) <= tol * tol);
    case "line":
    case "arrow":
      return distToSeg(p, el.a, el.b) <= tol;
    case "rect": {
      const x0 = Math.min(el.a.x, el.b.x);
      const x1 = Math.max(el.a.x, el.b.x);
      const y0 = Math.min(el.a.y, el.b.y);
      const y1 = Math.max(el.a.y, el.b.y);
      if (inside && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return true;
      if (el.fill && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return true;
      if (p.x < x0 - tol || p.x > x1 + tol || p.y < y0 - tol || p.y > y1 + tol) return false;
      return (
        distToSeg(p, { x: x0, y: y0 }, { x: x1, y: y0 }) <= tol ||
        distToSeg(p, { x: x1, y: y0 }, { x: x1, y: y1 }) <= tol ||
        distToSeg(p, { x: x1, y: y1 }, { x: x0, y: y1 }) <= tol ||
        distToSeg(p, { x: x0, y: y1 }, { x: x0, y: y0 }) <= tol
      );
    }
    case "ellipse": {
      const cx = (el.a.x + el.b.x) / 2;
      const cy = (el.a.y + el.b.y) / 2;
      const rx = Math.max(Math.abs(el.b.x - el.a.x) / 2, 1);
      const ry = Math.max(Math.abs(el.b.y - el.a.y) / 2, 1);
      const v = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
      if (inside && v <= 1) return true;
      if (el.fill && v <= 1) return true;
      return Math.abs(v - 1) <= tol / Math.min(rx, ry);
    }
    case "poly": {
      if (inside && pointInPolygon(p, el.points)) return true;
      for (let i = 0; i < el.points.length; i++) {
        const a = el.points[i];
        const b = el.points[(i + 1) % el.points.length];
        if (distToSeg(p, a, b) <= tol) return true;
      }
      return false;
    }
    case "text": {
      const b = elBounds(el);
      return p.x >= b.x - 4 && p.x <= b.x + b.w + 4 && p.y >= b.y - 4 && p.y <= b.y + b.h + 4;
    }
  }
}

export function constrainLine(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  const len = Math.hypot(dx, dy);
  return { x: a.x + Math.cos(snapped) * len, y: a.y + Math.sin(snapped) * len };
}
