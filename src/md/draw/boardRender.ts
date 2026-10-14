// Pintar o quadro, hit-test e exportar para PNG/SVG.

import type { Board } from "./board";
import { h } from "../../util";
import { type Pt, type DrEl, FONT_STACK, LINE_HEIGHT, OUT_PAD, mid } from "./model";
import { arrowHead, hexToRgba, escapeXml } from "./geometry";
import { anchorBox } from "./links";
import { roundRect, elBounds, hitEl } from "./elements";

export const boardRenderMethods = {
  paintScene(this: Board): void {
    const ctx = this.ctx;
    // A JANELA visível: o canvas pinta só o pedaço à vista, em resolução cheia — é o que
    // permite o zoom de 800% sem borrar (o quadro inteiro em buffer seria inviável).
    const j = this.janela();
    const escala = this.canvas.width / Math.max(1, this.canvas.clientWidth); // px de tela por px CSS
    ctx.setTransform(j.k * escala, 0, 0, j.k * escala, -j.x * escala, -j.y * escala);
    ctx.clearRect(0, 0, this.W, this.H);

    if (this.whiteBg) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, this.W, this.H);
    } else {
      // só a parte à vista: o quadro inteiro seriam milhares de quadradinhos a cada pintura
      const s = 16;
      const x0 = Math.floor(j.x / j.k / s) * s;
      const y0 = Math.floor(j.y / j.k / s) * s;
      const x1 = Math.min(this.W, (j.x + this.canvas.clientWidth) / j.k);
      const y1 = Math.min(this.H, (j.y + this.canvas.clientHeight) / j.k);
      for (let y = y0; y < y1; y += s) {
        for (let x = x0; x < x1; x += s) {
          ctx.fillStyle = (x / s + y / s) % 2 === 0 ? "#f1f3f6" : "#e6e9ee";
          ctx.fillRect(x, y, s, s);
        }
      }
    }

    this.syncAnchors();
    this.paint(ctx, this.els);

    // guias de alinhamento
    if (this.guidesX.length || this.guidesY.length) {
      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      for (const x of this.guidesX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.H);
        ctx.stroke();
      }
      for (const y of this.guidesY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.W, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // formas ligadas pela ponta em construção
    if (this.anchorHighlight.length) {
      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      for (const id of this.anchorHighlight) {
        const target = this.els.find((e) => e.id === id);
        if (!target) continue;
        const ab = anchorBox(target) ?? elBounds(target);
        ctx.strokeRect(ab.x - 6, ab.y - 6, ab.w + 12, ab.h + 12);
      }
      ctx.restore();
    }

    const sel = this.selectedEl();
    if (sel) {
      const b = elBounds(sel);
      ctx.save();
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#4f46e5";
      for (const [cx, cy] of [
        [b.x - 6, b.y - 6],
        [b.x + b.w + 6, b.y - 6],
        [b.x - 6, b.y + b.h + 6],
        [b.x + b.w + 6, b.y + b.h + 6],
      ]) {
        ctx.beginPath();
        ctx.rect(cx - 4, cy - 4, 8, 8);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  paint(this: Board, ctx: CanvasRenderingContext2D, els: DrEl[]): void {
    for (const el of els) {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (el.type) {
        case "pen": {
          const pts = el.points;
          if (pts.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length - 1; i++) {
            const m = mid(pts[i], pts[i + 1]);
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
          break;
        }
        case "line": {
          ctx.beginPath();
          ctx.moveTo(el.a.x, el.a.y);
          ctx.lineTo(el.b.x, el.b.y);
          ctx.stroke();
          break;
        }
        case "arrow": {
          ctx.beginPath();
          ctx.moveTo(el.a.x, el.a.y);
          ctx.lineTo(el.b.x, el.b.y);
          ctx.stroke();
          const [t1, t2, t3] = arrowHead(el.a, el.b, el.width);
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y);
          ctx.lineTo(t2.x, t2.y);
          ctx.lineTo(t3.x, t3.y);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "rect": {
          const x = Math.min(el.a.x, el.b.x);
          const y = Math.min(el.a.y, el.b.y);
          const w = Math.abs(el.b.x - el.a.x);
          const hgt = Math.abs(el.b.y - el.a.y);
          roundRect(ctx, x, y, w, hgt, 4);
          if (el.fill) {
            ctx.fillStyle = hexToRgba(el.fill, 0.16);
            ctx.fill();
          }
          ctx.stroke();
          break;
        }
        case "ellipse": {
          const cx = (el.a.x + el.b.x) / 2;
          const cy = (el.a.y + el.b.y) / 2;
          const rx = Math.abs(el.b.x - el.a.x) / 2;
          const ry = Math.abs(el.b.y - el.a.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
          if (el.fill) {
            ctx.fillStyle = hexToRgba(el.fill, 0.16);
            ctx.fill();
          }
          ctx.stroke();
          break;
        }
        case "poly": {
          if (el.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
          ctx.closePath();
          if (el.fill) {
            ctx.fillStyle = hexToRgba(el.fill, 0.16);
            ctx.fill();
          }
          ctx.stroke();
          break;
        }
        case "text": {
          ctx.font = `${el.fontSize}px ${FONT_STACK}`;
          ctx.textBaseline = "top";
          ctx.fillStyle = el.color;
          el.text.split("\n").forEach((line, i) => {
            ctx.fillText(line, el.pos.x, el.pos.y + i * el.fontSize * LINE_HEIGHT);
          });
          break;
        }
      }
      ctx.restore();
    }
  },

  hitTest(this: Board, p: Pt): DrEl | null {
    for (let i = this.els.length - 1; i >= 0; i--) {
      if (hitEl(this.els[i], p)) return this.els[i];
    }
    return null;
  },

  contentBounds(this: Board): { x: number; y: number; w: number; h: number } | null {
    if (this.els.length === 0) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const el of this.els) {
      const b = elBounds(el);
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w);
      y1 = Math.max(y1, b.y + b.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  },

  toPngDataUrl(this: Board, scale = 2): string | null {
    this.syncAnchors();
    const b = this.contentBounds();
    if (!b) return null;
    const x0 = b.x - OUT_PAD;
    const y0 = b.y - OUT_PAD;
    const w = Math.ceil((b.w + OUT_PAD * 2) * scale);
    const hgt = Math.ceil((b.h + OUT_PAD * 2) * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = hgt;
    const cc = c.getContext("2d")!;
    cc.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    if (this.whiteBg) {
      cc.fillStyle = "#ffffff";
      cc.fillRect(x0, y0, b.w + OUT_PAD * 2, b.h + OUT_PAD * 2);
    }
    this.paint(cc, this.els);
    return c.toDataURL("image/png");
  },

  toSvg(this: Board): string | null {
    this.syncAnchors();
    const b = this.contentBounds();
    if (!b) return null;
    const x0 = b.x - OUT_PAD;
    const y0 = b.y - OUT_PAD;
    const w = b.w + OUT_PAD * 2;
    const hgt = b.h + OUT_PAD * 2;
    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(hgt)}" viewBox="${x0.toFixed(2)} ${y0.toFixed(2)} ${w.toFixed(2)} ${hgt.toFixed(2)}">`
    );
    if (this.whiteBg) {
      parts.push(`<rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${w.toFixed(2)}" height="${hgt.toFixed(2)}" fill="#ffffff"/>`);
    }
    for (const el of this.els) {
      const stroke = `stroke="${el.color}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round"`;
      switch (el.type) {
        case "pen": {
          const d = el.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
          parts.push(`<path d="${d}" fill="none" ${stroke}/>`);
          break;
        }
        case "line":
          parts.push(`<line x1="${el.a.x.toFixed(2)}" y1="${el.a.y.toFixed(2)}" x2="${el.b.x.toFixed(2)}" y2="${el.b.y.toFixed(2)}" ${stroke}/>`);
          break;
        case "arrow": {
          parts.push(`<line x1="${el.a.x.toFixed(2)}" y1="${el.a.y.toFixed(2)}" x2="${el.b.x.toFixed(2)}" y2="${el.b.y.toFixed(2)}" ${stroke}/>`);
          const [t1, t2, t3] = arrowHead(el.a, el.b, el.width);
          parts.push(
            `<polygon points="${t1.x.toFixed(2)},${t1.y.toFixed(2)} ${t2.x.toFixed(2)},${t2.y.toFixed(2)} ${t3.x.toFixed(2)},${t3.y.toFixed(2)}" fill="${el.color}"/>`
          );
          break;
        }
        case "rect": {
          const x = Math.min(el.a.x, el.b.x);
          const y = Math.min(el.a.y, el.b.y);
          const rw = Math.abs(el.b.x - el.a.x);
          const rh = Math.abs(el.b.y - el.a.y);
          const fill = el.fill ? `fill="${el.fill}" fill-opacity="0.16"` : `fill="none"`;
          parts.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" rx="4" ${fill} ${stroke}/>`);
          break;
        }
        case "ellipse": {
          const cx = (el.a.x + el.b.x) / 2;
          const cy = (el.a.y + el.b.y) / 2;
          const rx = Math.abs(el.b.x - el.a.x) / 2;
          const ry = Math.abs(el.b.y - el.a.y) / 2;
          const fill = el.fill ? `fill="${el.fill}" fill-opacity="0.16"` : `fill="none"`;
          parts.push(`<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${Math.max(rx, 0.5).toFixed(2)}" ry="${Math.max(ry, 0.5).toFixed(2)}" ${fill} ${stroke}/>`);
          break;
        }
        case "poly": {
          const pts = el.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
          const fill = el.fill ? `fill="${el.fill}" fill-opacity="0.16"` : `fill="none"`;
          parts.push(`<polygon points="${pts}" ${fill} ${stroke}/>`);
          break;
        }
        case "text": {
          parts.push(
            `<text x="${el.pos.x.toFixed(2)}" y="${el.pos.y.toFixed(2)}" font-family="${FONT_STACK}" font-size="${el.fontSize}" fill="${el.color}">`
          );
          el.text.split("\n").forEach((line, i) => {
            parts.push(`<tspan x="${el.pos.x.toFixed(2)}" dy="${i === 0 ? el.fontSize * 0.82 : el.fontSize * LINE_HEIGHT}">${escapeXml(line)}</tspan>`);
          });
          parts.push(`</text>`);
          break;
        }
      }
    }
    parts.push(`</svg>`);
    return parts.join("");
  },

  request(this: Board): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.paintScene();
    });
  },
};
