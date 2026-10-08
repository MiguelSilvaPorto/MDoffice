// O quadro de desenho: estado, ferramentas e pintura.

import { h, uid, clamp } from "../../util";
import { type Pt, type LineEl, type TextEl, type DrEl, type DrawDoc, type Tool, FONT_STACK, LINE_HEIGHT, OUT_PAD, MAGNET, dist2, mid } from "./model";
import { arrowHead, hexToRgba, escapeXml } from "./geometry";
import { simplify, smoothStroke, idealizeWave, recognizeStroke, snapAngle } from "./recognize";
import { anchorBox, angleFrom, borderPointAt, distanceToShapeBorder } from "./links";
import { roundRect, cloneEl, translateEl, elBounds, hitEl, constrainLine } from "./elements";
import { boardRenderMethods } from "./boardRender";
import { boardHistoryMethods } from "./boardHistory";
import { boardMagnetMethods } from "./boardMagnet";
import { boardTextMethods } from "./boardText";

export interface BoardOptions {
  w: number;
  h: number;
  /** true = a tela se ajusta à largura do contêiner (modo embutido) */
  fit: boolean;
  assist: boolean;
  autoHeight?: boolean;
}

export class Board {
  tool: Tool = "pen";
  color = "#1f2937";
  width = 3;
  fillEnabled = false;
  whiteBg = true;
  assist: boolean;
  onChange: (() => void) | null = null;

  readonly W: number;
  readonly H: number;

  canvas: HTMLCanvasElement;
  host: HTMLElement;
  ctx: CanvasRenderingContext2D;
  opts: BoardOptions;
  els: DrEl[] = [];
  selectedId: string | null = null;
  draft: DrEl | null = null;
  dragFrom: Pt | null = null;
  dragOrig: DrEl | null = null;
  dragMoved = false;
  eraserStarted = false;
  undoStack: string[] = [];
  redoStack: string[] = [];
  raf = 0;
  guidesX: number[] = [];
  guidesY: number[] = [];
  anchorHighlight: string[] = [];
  clipboard: DrEl | null = null;
  lastNudgeAt = 0;
  zoom = 1;
  resizeObs: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement, opts: BoardOptions) {
    this.canvas = canvas;
    this.host = host;
    this.opts = opts;
    this.W = opts.w;
    this.H = opts.h;
    this.assist = opts.assist;
    this.ctx = canvas.getContext("2d")!;

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("dblclick", this.onDblClick);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    if (opts.fit) {
      this.resizeObs = new ResizeObserver(() => this.fit());
      this.resizeObs.observe(canvas.parentElement ?? host);
    }
    this.fit();
    this.updateCursor();
    this.request();
  }

  dispose(): void {
    this.resizeObs?.disconnect();
  }

  /** Ajusta o tamanho visual do canvas à largura disponível (mantendo a proporção). */
  fit(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const hostW = (this.canvas.parentElement ?? this.host).clientWidth;
    const avail = Math.max(160, hostW - (this.opts.fit ? 20 : 0));
    let cssW = this.W;
    let cssH = this.H;
    if (this.opts.fit) {
      cssW = Math.min(avail, this.W) * this.zoom;
      cssH = (cssW * this.H) / this.W;
      const maxH = Math.max(240, Math.round(window.innerHeight * 0.62)) * this.zoom;
      if (cssH > maxH) {
        cssH = maxH;
        cssW = (cssH * this.W) / this.H;
      }
    }
    this.canvas.style.width = `${Math.round(cssW)}px`;
    this.canvas.style.height = `${Math.round(cssH)}px`;
    // buffer do tamanho exibido (× densidade da tela): sem redução forte, a grade e os
    // traços de 1px continuam visíveis em qualquer zoom (antes pareciam sumir)
    const bufferScale = clamp(((cssW * dpr) / this.W), 0.1, 3);
    this.canvas.width = Math.max(1, Math.round(this.W * bufferScale));
    this.canvas.height = Math.max(1, Math.round(this.H * bufferScale));
    this.request();
  }

  // ---------- zoom ----------

  getZoom(): number {
    return this.zoom;
  }

  setZoom(zoom: number): void {
    this.zoom = clamp(Math.round(zoom * 100) / 100, 0.5, 3);
    this.fit();
  }

  // ---------- estado público ----------

  isEmpty(): boolean {
    return this.els.length === 0;
  }

  serialize(): string {
    this.syncAnchors();
    const doc: DrawDoc = { version: 1, w: this.W, h: this.H, elements: this.els };
    return JSON.stringify(doc);
  }

  /** Usado ao reabrir um desenho salvo: adiciona elementos sem entrar no histórico. */
  addElement(el: DrEl): void {
    this.els.push(el);
    this.request();
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    if (tool !== "select") this.selectedId = null;
    this.clearGuides();
    this.updateCursor();
    this.request();
    this.onChange?.();
  }

  setColor(color: string): void {
    this.color = color;
    const sel = this.selectedEl();
    if (sel) {
      this.pushUndo();
      sel.color = color;
      if (sel.type === "rect" || sel.type === "ellipse" || sel.type === "poly") sel.fill = this.fillEnabled ? color : null;
    }
    this.request();
  }

  setWidth(w: number): void {
    this.width = w;
    const sel = this.selectedEl();
    if (sel) {
      this.pushUndo();
      sel.width = w;
    }
    this.request();
  }

  setFillEnabled(on: boolean): void {
    this.fillEnabled = on;
    const sel = this.selectedEl();
    if (sel && (sel.type === "rect" || sel.type === "ellipse" || sel.type === "poly")) {
      this.pushUndo();
      sel.fill = on ? this.color : null;
    }
    this.request();
  }

  setWhiteBg(on: boolean): void {
    this.whiteBg = on;
    this.request();
  }

  setAssist(on: boolean): void {
    this.assist = on;
    this.request();
  }

  updateCursor(): void {
    const cursors: Record<Tool, string> = {
      select: "default",
      pen: "crosshair",
      line: "crosshair",
      arrow: "crosshair",
      rect: "crosshair",
      ellipse: "crosshair",
      text: "text",
      eraser: "cell",
    };
    this.canvas.style.cursor = cursors[this.tool] ?? "crosshair";
  }

  // ---------- histórico ----------

  // ---------- ímã / alinhamento automático ----------

  // ---------- ligações entre formas ----------

  // ---------- ponteiro ----------

  onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* alguns ambientes não suportam captura */
    }
    // foca sem rolar a tela (senão o navegador "puxa" a vista para o canvas a cada traço)
    this.canvas.focus({ preventScroll: true });
    const p = this.pt(e);

    if (this.tool === "select") {
      const hit = this.hitTest(p);
      this.selectedId = hit?.id ?? null;
      if (hit && e.altKey) {
        // Alt + arrastar = copia o objeto e move a cópia (mantém o padrão)
        this.pushUndo();
        const copy = cloneEl(hit);
        copy.id = uid();
        this.els.push(copy);
        this.selectedId = copy.id;
        this.dragFrom = p;
        this.dragOrig = cloneEl(copy);
        this.dragMoved = false;
        this.request();
        this.onChange?.();
        return;
      }
      if (hit) {
        this.dragFrom = p;
        this.dragOrig = structuredClone(hit);
        this.dragMoved = false;
      }
      this.request();
      this.onChange?.();
      return;
    }

    if (this.tool === "eraser") {
      this.eraserStarted = false;
      this.eraseAt(p);
      return;
    }

    if (this.tool === "text") {
      this.openTextInput(p.x, p.y, null);
      return;
    }

    this.pushUndo();
    const base = { id: uid(), color: this.color, width: this.width };
    if (this.tool === "pen") {
      this.draft = { ...base, type: "pen", points: [p, { x: p.x + 0.01, y: p.y + 0.01 }] };
    } else if (this.tool === "line" || this.tool === "arrow") {
      this.draft = { ...base, type: this.tool, a: p, b: p };
    } else {
      this.draft = { ...base, type: this.tool, a: p, b: p, fill: this.fillEnabled ? this.color : null };
    }
    this.els.push(this.draft);
    this.request();
  };

  onMove = (e: PointerEvent): void => {
    const raw = this.pt(e);
    const shift = e.shiftKey;

    if (this.tool === "eraser" && e.buttons === 1) {
      this.eraseAt(raw);
      return;
    }

    if (this.draft) {
      const d = this.draft;
      if (d.type === "pen") {
        const last = d.points[d.points.length - 1];
        if (dist2(last, raw) > 2.5) d.points.push(raw);
      } else if (d.type === "line" || d.type === "arrow") {
        this.updateLineDraft(d, raw, shift);
      } else if (d.type === "rect" || d.type === "ellipse") {
        let p = this.magnetPoint(raw);
        if (shift) {
          const size = Math.max(Math.abs(p.x - d.a.x), Math.abs(p.y - d.a.y));
          p = { x: d.a.x + Math.sign(p.x - d.a.x) * size, y: d.a.y + Math.sign(p.y - d.a.y) * size };
        } else if (this.assist) {
          const dx = Math.abs(p.x - d.a.x);
          const dy = Math.abs(p.y - d.a.y);
          const bigger = Math.max(dx, dy);
          if (bigger > 24 && Math.abs(dx - dy) / bigger < 0.09) {
            p = { x: d.a.x + Math.sign(p.x - d.a.x) * bigger, y: d.a.y + Math.sign(p.y - d.a.y) * bigger };
          }
        }
        d.b = p;
      }
      this.request();
      return;
    }

    if (this.dragFrom && this.dragOrig && this.tool === "select") {
      const sel = this.selectedEl();
      if (!sel) return;
      const dx0 = raw.x - this.dragFrom.x;
      const dy0 = raw.y - this.dragFrom.y;
      if (dx0 !== 0 || dy0 !== 0) this.dragMoved = true;
      const { dx, dy } = this.magnetDelta(this.dragOrig, dx0, dy0);
      const moved = cloneEl(this.dragOrig);
      translateEl(moved, dx, dy);
      Object.assign(sel, moved);
      this.request();
    }
  };

  onUp = (e: PointerEvent): void => {
    try {
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignora */
    }

    if (this.draft) {
      const d = this.draft;
      // usa a posição final do clique para não perder o encaixe
      if (d.type === "line" || d.type === "arrow") this.updateLineDraft(d, this.pt(e), e.shiftKey);
      if (d.type === "pen") {
        // ---- assistente: traço vira forma alinhada quando reconhecido ----
        const snapped = this.assist ? recognizeStroke(d.points, { id: d.id, color: d.color, width: d.width, fill: this.fillEnabled ? this.color : null }) : null;
        if (snapped) {
          const idx = this.els.indexOf(d);
          // linha/seta reconhecida também se liga às formas próximas
          if (snapped.type === "line" || snapped.type === "arrow") this.attachLineEnds(snapped);
          if (idx >= 0) this.els[idx] = snapped;
        } else if (d.points.length < 2) {
          const idx = this.els.indexOf(d);
          if (idx >= 0) this.els.splice(idx, 1);
        } else {
          // não virou forma: tenta regularizar a ondulação; senão, só suaviza
          const ideal = this.assist ? idealizeWave(d.points) : null;
          if (ideal) {
            d.points = ideal;
          } else {
            const simplified = simplify(d.points, 1.1);
            const smoothed = smoothStroke(simplified, simplified.length > 140 ? 1 : 2);
            d.points = simplify(smoothed, 0.7);
          }
        }
      } else if (d.type === "line" || d.type === "arrow") {
        if (dist2(d.a, d.b) < 4) d.b = { x: d.a.x + 1, y: d.a.y + 1 };
        this.attachLineEnds(d);
      }
      this.draft = null;
      this.clearGuides();
      this.anchorHighlight = [];
      this.request();
      this.onChange?.();
    }

    if (this.dragFrom && this.dragOrig) {
      const orig = this.dragOrig;
      if (this.dragMoved) {
        const cur = JSON.stringify(this.els);
        const sel = this.selectedEl();
        if (sel) {
          const restore = this.els.map((el) => (el.id === sel.id ? orig : el));
          this.els = restore;
          this.undoStack.push(JSON.stringify(this.els));
          this.redoStack.length = 0;
          this.els = JSON.parse(cur) as DrEl[];
        }
      }
      this.dragFrom = null;
      this.dragOrig = null;
      this.dragMoved = false;
      this.clearGuides();
      this.onChange?.();
    }
  };

  onDblClick = (e: MouseEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) * this.W) / Math.max(r.width, 1), y: ((e.clientY - r.top) * this.H) / Math.max(r.height, 1) };
    const hit = this.hitTest(p);
    if (hit?.type === "text") this.openTextInput(hit.pos.x, hit.pos.y, hit);
  };

  // ---------- texto ----------

  // ---------- render ----------

  // ---------- hit test ----------

  // ---------- exportação ----------

}

// Os métodos ficam em arquivos próprios e são colados na classe aqui.
type BoardRenderMethodsType = typeof boardRenderMethods;
type BoardHistoryMethodsType = typeof boardHistoryMethods;
type BoardMagnetMethodsType = typeof boardMagnetMethods;
type BoardTextMethodsType = typeof boardTextMethods;
export interface Board extends BoardRenderMethodsType, BoardHistoryMethodsType, BoardMagnetMethodsType, BoardTextMethodsType {}
Object.assign(Board.prototype, boardRenderMethods, boardHistoryMethods, boardMagnetMethods, boardTextMethods);
