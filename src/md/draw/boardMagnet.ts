// Ímã de alinhamento e ligações (âncoras) entre formas e linhas.

import type { Board } from "./board";
import { type Pt, type LineEl, type DrEl, MAGNET } from "./model";
import { snapAngle } from "./recognize";
import { angleFrom, borderPointAt, distanceToShapeBorder } from "./links";
import { cloneEl, translateEl, elBounds, constrainLine } from "./elements";

export const boardMagnetMethods = {
  targets(this: Board): { x: number[]; y: number[] } {
    const x: number[] = [0, this.W / 2, this.W];
    const y: number[] = [0, this.H / 2, this.H];
    for (const el of this.els) {
      const b = elBounds(el);
      x.push(b.x, b.x + b.w / 2, b.x + b.w);
      y.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { x, y };
  },

  /** Alinha um ponto (usado ao desenhar) com bordas/centros de outros elementos. */
  magnetPoint(this: Board, p: Pt): Pt {
    if (!this.assist) return p;
    const t = this.targets();
    let bestX: number | null = null;
    let bestY: number | null = null;
    for (const c of t.x) {
      if (Math.abs(c - p.x) <= MAGNET && (bestX === null || Math.abs(c - p.x) < Math.abs(bestX - p.x))) bestX = c;
    }
    for (const c of t.y) {
      if (Math.abs(c - p.y) <= MAGNET && (bestY === null || Math.abs(c - p.y) < Math.abs(bestY - p.y))) bestY = c;
    }
    this.guidesX = bestX === null ? [] : [bestX];
    this.guidesY = bestY === null ? [] : [bestY];
    return { x: bestX ?? p.x, y: bestY ?? p.y };
  },

  /** Alinha o elemento em movimento com os demais (ímã) e devolve os guias. */
  magnetDelta(this: Board, sel: DrEl, dx: number, dy: number): { dx: number; dy: number } {
    if (!this.assist) return { dx, dy };
    const moved = cloneEl(sel);
    translateEl(moved, dx, dy);
    const mb = elBounds(moved);
    const mineX = [mb.x, mb.x + mb.w / 2, mb.x + mb.w];
    const mineY = [mb.y, mb.y + mb.h / 2, mb.y + mb.h];
    const t = this.targets();

    let bestX: { d: number; v: number } | null = null;
    let bestY: { d: number; v: number } | null = null;
    for (const c of t.x) {
      for (const m of mineX) {
        const d = c - m;
        if (Math.abs(d) <= MAGNET && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, v: c };
      }
    }
    for (const c of t.y) {
      for (const m of mineY) {
        const d = c - m;
        if (Math.abs(d) <= MAGNET && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, v: c };
      }
    }
    this.guidesX = bestX ? [bestX.v] : [];
    this.guidesY = bestY ? [bestY.v] : [];
    return { dx: dx + (bestX?.d ?? 0), dy: dy + (bestY?.d ?? 0) };
  },

  /**
   * Forma perto o bastante para a ponta se ligar nela.
   * Só considera a FAIXA em volta da borda — desenhar dentro da forma
   * (longe da borda) não liga nada e não move nada.
   */
  anchorAt(this: Board, p: Pt, excludeIds: (string | undefined)[] = []): DrEl | null {
    if (!this.assist) return null;
    const snap = Math.max(16, this.width + 14);
    let best: { el: DrEl; d: number } | null = null;
    for (const el of this.els) {
      if (el.type === "pen") continue;
      if (excludeIds.includes(el.id)) continue;
      const d = Math.abs(distanceToShapeBorder(el, p));
      if (d <= snap && (!best || d < best.d)) best = { el, d };
    }
    return best?.el ?? null;
  },

  /** Mantém as pontas ligadas nas formas (acompanham quando a forma se move). */
  syncAnchors(this: Board): void {
    for (const el of this.els) {
      if (el.type !== "line" && el.type !== "arrow") continue;
      const from = el.fromId ? this.els.find((e) => e.id === el.fromId) : undefined;
      const to = el.toId ? this.els.find((e) => e.id === el.toId) : undefined;
      if (from && el.fromAngle !== undefined) el.a = borderPointAt(from, el.fromAngle);
      if (to && el.toAngle !== undefined) el.b = borderPointAt(to, el.toAngle);
    }
  },

  /** Atualiza a ponta em construção de uma linha/seta, ligando nas formas próximas. */
  updateLineDraft(this: Board, d: LineEl, raw: Pt, shift: boolean): void {
    const p = this.magnetPoint(raw);
    let target = shift ? constrainLine(d.a, p) : this.assist ? snapAngle(d.a, p) : p;

    // ponta final: liga na forma mais próxima (guardando o ângulo de fixação)
    const endAnchor = this.anchorAt(target, [d.id, d.fromId]);
    if (endAnchor) {
      if (endAnchor.id !== d.toId || d.toAngle === undefined) {
        d.toId = endAnchor.id;
        d.toAngle = angleFrom(endAnchor, target);
      }
      target = borderPointAt(endAnchor, d.toAngle);
    } else {
      d.toId = undefined;
      d.toAngle = undefined;
    }

    // ponta inicial: mesma ideia (o ângulo é calculado na posição original do clique)
    const startAnchor = this.anchorAt(d.a, [d.id, d.toId]);
    if (startAnchor) {
      if (startAnchor.id !== d.fromId || d.fromAngle === undefined) {
        d.fromId = startAnchor.id;
        d.fromAngle = angleFrom(startAnchor, d.a);
      }
      d.a = borderPointAt(startAnchor, d.fromAngle);
      if (d.toId && d.toAngle !== undefined) {
        const toEl = this.els.find((e) => e.id === d.toId);
        if (toEl) target = borderPointAt(toEl, d.toAngle);
      }
    } else {
      d.fromId = undefined;
      d.fromAngle = undefined;
    }

    d.b = target;
    this.anchorHighlight = [d.fromId, d.toId].filter((id): id is string => !!id);
  },

  /** Liga as pontas de uma linha/seta nas formas próximas (usado ao terminar de desenhar). */
  attachLineEnds(this: Board, el: LineEl): void {
    if (!this.assist) return;
    const startPoint = { ...el.a };
    const endPoint = { ...el.b };

    const from = this.anchorAt(startPoint, [el.id]);
    if (from) {
      el.fromId = from.id;
      el.fromAngle = angleFrom(from, startPoint);
      el.a = borderPointAt(from, el.fromAngle);
    } else {
      el.fromId = undefined;
      el.fromAngle = undefined;
    }

    const to = this.anchorAt(endPoint, [el.id, el.fromId]);
    if (to) {
      el.toId = to.id;
      el.toAngle = angleFrom(to, endPoint);
      el.b = borderPointAt(to, el.toAngle);
    } else {
      el.toId = undefined;
      el.toAngle = undefined;
    }

    this.anchorHighlight = [el.fromId, el.toId].filter((id): id is string => !!id);
  },

  pt(this: Board, e: PointerEvent): Pt {
    return this.pontoDe(e);
  },
};
