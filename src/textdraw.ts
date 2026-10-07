// Desenho com LETRAS e SÍMBOLOS (grade de caracteres).
// Gera texto puro (┌─┐ │ └┘ ├ ┼ ou ╔═╗ ou +-| ) que entra direto no Markdown,
// ideal para IA: legível, editável e sem arquivos de imagem.
import { h, clamp, toast } from "./util";
import { simplify } from "./draw";

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

const U = 1;
const R = 2;
const D = 4;
const L = 8;

// índice = máscara U|R|D|L (0..15) → glifo
const GLYPHS: Record<TraceStyle, string[]> = {
  single: [" ", "│", "─", "└", "│", "│", "┌", "├", "─", "┘", "─", "┴", "┐", "┤", "┬", "┼"],
  double: [" ", "║", "═", "╚", "║", "║", "╔", "╠", "═", "╝", "═", "╩", "╗", "╣", "╦", "╬"],
  ascii: [" ", "|", "-", "+", "|", "|", "+", "+", "-", "+", "-", "+", "+", "+", "+", "+"],
};

const DIAGONALS: Record<TraceStyle, [string, string]> = {
  single: ["╱", "╲"],
  double: ["╱", "╲"],
  ascii: ["/", "\\"],
};

const REVERSE: Record<TraceStyle, Map<string, number>> = {
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

const MONO = `ui-monospace, "Cascadia Code", Consolas, monospace`;
const CELL_FONT = 26;
const DEFAULT_COLS = 64;
const DEFAULT_ROWS = 22;

const key = (r: number, c: number) => `${r},${c}`;

type TextTool = "select" | "pen" | "line" | "rect" | "text" | "field" | "table" | "eraser";

interface Metrics {
  cellW: number;
  cellH: number;
  fontSize: number;
  logicalW: number;
  logicalH: number;
}

let metricsCache: Metrics | null = null;

function metrics(cols: number, rows: number): Metrics {
  if (!metricsCache) {
    const probe = 100;
    const tmp = document.createElement("canvas").getContext("2d")!;
    tmp.font = `${probe}px ${MONO}`;
    const advance = tmp.measureText("MMMMMMMMMM").width / 10;
    const fontSize = CELL_FONT;
    const cellW = (advance * fontSize) / probe;
    const cellH = Math.round(fontSize * 1.18);
    metricsCache = { cellW, cellH, fontSize, logicalW: 0, logicalH: 0 };
  }
  const base = metricsCache!;
  return { ...base, logicalW: base.cellW * cols, logicalH: base.cellH * rows };
}

/** Descobre o estilo do traço olhando para o texto já desenhado. */
export function detectTraceStyle(text: string): TraceStyle {
  if (/[╔╗╚╝╠╣╦╩╬═║]/.test(text)) return "double";
  if (/[┌┐└┘├┤┬┴┼─│]/.test(text)) return "single";
  if (/-/.test(text) && /[+|]/.test(text)) return "ascii";
  return "single";
}

export class TextBoard {
  readonly cols: number;
  readonly rows: number;
  style: TraceStyle;
  tool: TextTool = "pen";
  onChange: (() => void) | null = null;

  private conn = new Map<string, number>();
  private chars = new Map<string, string>();
  private canvas: HTMLCanvasElement;
  private host: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private m: Metrics;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private draftBase: { conn: Map<string, number>; chars: Map<string, string> } | null = null;
  private startCell: { r: number; c: number } | null = null;
  private lastCell: { r: number; c: number } | null = null;
  private penPoints: { r: number; c: number }[] = [];
  private penDrew = false;
  private hoverCell: { r: number; c: number } | null = null;
  private selection: { r1: number; c1: number; r2: number; c2: number } | null = null;
  private selStart: { r: number; c: number } | null = null;
  private raf = 0;
  private resizeObs: ResizeObserver | null = null;
  private zoom = 1;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement, opts: { doc?: TextDrawDoc | null } = {}) {
    this.canvas = canvas;
    this.host = host;
    this.ctx = canvas.getContext("2d")!;
    const doc = opts.doc ?? null;
    this.cols = doc?.cols || DEFAULT_COLS;
    this.rows = doc?.rows || DEFAULT_ROWS;
    this.style = doc?.style || "single";
    this.m = metrics(this.cols, this.rows);
    if (doc) {
      for (const [k, v] of Object.entries(doc.conn || {})) this.conn.set(k, v);
      for (const [k, v] of Object.entries(doc.chars || {})) this.chars.set(k, v);
    }

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointerleave", () => {
      this.hoverCell = null;
      this.request();
    });
    // botão direito apaga a linha/rótulo sob o cursor
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const cell = this.cellFromEvent(e);
      this.pushUndo();
      this.eraseRunAt(cell);
      this.request();
      this.onChange?.();
    });

    this.resizeObs = new ResizeObserver(() => this.fit());
    this.resizeObs.observe(host);
    this.fit();
    this.request();
  }

  dispose(): void {
    this.resizeObs?.disconnect();
  }

  // ---------- tamanho / desenho ----------

  private fit(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const hostW = (this.canvas.parentElement ?? this.host).clientWidth;
    const avail = Math.max(220, hostW - 20);
    const cssW = Math.min(avail, this.m.logicalW) * this.zoom;
    const cssH = (cssW * this.m.logicalH) / this.m.logicalW;
    this.canvas.style.width = `${Math.round(cssW)}px`;
    this.canvas.style.height = `${Math.round(cssH)}px`;
    const buffer = clamp((cssW * dpr) / this.m.logicalW, 1, 3);
    this.canvas.width = Math.round(this.m.logicalW * buffer);
    this.canvas.height = Math.round(this.m.logicalH * buffer);
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

  private request(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const sx = this.canvas.width / this.m.logicalW;
    const sy = this.canvas.height / this.m.logicalH;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.m.logicalW, this.m.logicalH);

    // grade de apoio (não sai no texto final)
    ctx.strokeStyle = "rgba(15, 23, 42, 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= this.cols; c++) {
      const x = c * this.m.cellW;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.m.logicalH);
    }
    for (let r = 0; r <= this.rows; r++) {
      const y = r * this.m.cellH;
      ctx.moveTo(0, y);
      ctx.lineTo(this.m.logicalW, y);
    }
    ctx.stroke();

    ctx.fillStyle = "#1f2937";
    ctx.font = `${this.m.fontSize}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.cellChar(r, c);
        if (ch === " ") continue;
        ctx.fillText(ch, (c + 0.5) * this.m.cellW, (r + 0.52) * this.m.cellH);
      }
    }

    if (this.selection) {
      const x = this.selection.c1 * this.m.cellW;
      const y = this.selection.r1 * this.m.cellH;
      const w = (this.selection.c2 - this.selection.c1 + 1) * this.m.cellW;
      const h = (this.selection.r2 - this.selection.r1 + 1) * this.m.cellH;
      ctx.save();
      ctx.fillStyle = "rgba(79, 70, 229, 0.13)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
      ctx.restore();
    }

    if (this.hoverCell) {
      ctx.fillStyle = "rgba(79, 70, 229, 0.14)";
      ctx.fillRect(this.hoverCell.c * this.m.cellW, this.hoverCell.r * this.m.cellH, this.m.cellW, this.m.cellH);
    }
  }

  private cellChar(r: number, c: number): string {
    const k = key(r, c);
    const ch = this.chars.get(k);
    if (ch) return ch;
    const mask = this.conn.get(k) ?? 0;
    return mask ? GLYPHS[this.style][mask] : " ";
  }

  // ---------- modelo ----------

  private inGrid(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.rows && c < this.cols;
  }

  private addConn(r: number, c: number, mask: number): void {
    if (!this.inGrid(r, c)) return;
    const k = key(r, c);
    if (this.chars.has(k)) return;
    this.conn.set(k, (this.conn.get(k) ?? 0) | mask);
  }

  private clearCell(r: number, c: number): void {
    const k = key(r, c);
    this.conn.delete(k);
    this.chars.delete(k);
  }

  setChar(r: number, c: number, ch: string): void {
    if (!this.inGrid(r, c) || ch === "") return;
    this.chars.set(key(r, c), ch);
    this.conn.delete(key(r, c));
  }

  addText(r: number, c: number, text: string): void {
    let col = c;
    for (const ch of text) {
      if (ch === " ") {
        col++;
        continue;
      }
      this.setChar(r, col, ch);
      col++;
    }
  }

  hasSelection(): boolean {
    return this.selection !== null;
  }

  clearSelection(): void {
    if (!this.selection) return;
    this.selection = null;
    this.request();
    this.onChange?.();
  }

  /** Apaga tudo o que estiver dentro da área selecionada. */
  eraseSelection(): boolean {
    if (!this.selection) return false;
    const { r1, c1, r2, c2 } = this.selection;
    this.pushUndo();
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) this.clearCell(r, c);
    }
    this.selection = null;
    this.request();
    this.onChange?.();
    return true;
  }

  setTool(tool: TextTool): void {
    this.tool = tool;
    if (tool !== "select") this.selection = null;
    this.request();
    this.onChange?.();
  }

  setStyle(style: TraceStyle): void {
    this.style = style;
    this.request();
    this.onChange?.();
  }

  // ---------- histórico ----------

  private snapshot(): { conn: Map<string, number>; chars: Map<string, string> } {
    return { conn: new Map(this.conn), chars: new Map(this.chars) };
  }

  private restore(snap: { conn: Map<string, number>; chars: Map<string, string> }): void {
    this.conn = new Map(snap.conn);
    this.chars = new Map(snap.chars);
  }

  private pushUndo(): void {
    this.undoStack.push(JSON.stringify({ conn: Object.fromEntries(this.conn), chars: Object.fromEntries(this.chars) }));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify({ conn: Object.fromEntries(this.conn), chars: Object.fromEntries(this.chars) }));
    const parsed = JSON.parse(prev) as { conn: Record<string, number>; chars: Record<string, string> };
    this.conn = new Map(Object.entries(parsed.conn));
    this.chars = new Map(Object.entries(parsed.chars));
    this.request();
    this.onChange?.();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify({ conn: Object.fromEntries(this.conn), chars: Object.fromEntries(this.chars) }));
    const parsed = JSON.parse(next) as { conn: Record<string, number>; chars: Record<string, string> };
    this.conn = new Map(Object.entries(parsed.conn));
    this.chars = new Map(Object.entries(parsed.chars));
    this.request();
    this.onChange?.();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clearAll(): void {
    if (!this.conn.size && !this.chars.size) return;
    this.pushUndo();
    this.conn.clear();
    this.chars.clear();
    this.request();
    this.onChange?.();
  }

  /**
   * Apaga o que está sob o cursor em um clique:
   * um rótulo/texto inteiro, ou o trecho reto da linha (horizontal ou vertical).
   */
  eraseRunAt(cell: { r: number; c: number }): void {
    const k = key(cell.r, cell.c);
    const ch = this.chars.get(k);
    if (ch) {
      let left = cell.c;
      while (left > 0 && this.chars.has(key(cell.r, left - 1))) left--;
      let right = cell.c;
      while (right < this.cols - 1 && this.chars.has(key(cell.r, right + 1))) right++;
      for (let c = left; c <= right; c++) this.clearCell(cell.r, c);
      return;
    }
    const mask = this.conn.get(k) ?? 0;
    if (!mask) return;
    const hasH = (mask & (L | R)) !== 0;
    const hasV = (mask & (U | D)) !== 0;
    let hFrom = cell.c;
    let hTo = cell.c;
    if (hasH) {
      while (hFrom > 0 && ((this.conn.get(key(cell.r, hFrom - 1)) ?? 0) & (L | R)) !== 0) hFrom--;
      while (hTo < this.cols - 1 && ((this.conn.get(key(cell.r, hTo + 1)) ?? 0) & (L | R)) !== 0) hTo++;
    }
    let vFrom = cell.r;
    let vTo = cell.r;
    if (hasV) {
      while (vFrom > 0 && ((this.conn.get(key(vFrom - 1, cell.c)) ?? 0) & (U | D)) !== 0) vFrom--;
      while (vTo < this.rows - 1 && ((this.conn.get(key(vTo + 1, cell.c)) ?? 0) & (U | D)) !== 0) vTo++;
    }
    const hLen = hasH ? hTo - hFrom : -1;
    const vLen = hasV ? vTo - vFrom : -1;
    if (hLen >= vLen) {
      for (let c = hFrom; c <= hTo; c++) this.clearCell(cell.r, c);
    } else {
      for (let r = vFrom; r <= vTo; r++) this.clearCell(r, cell.c);
    }
  }

  isEmpty(): boolean {
    return this.conn.size === 0 && this.chars.size === 0;
  }

  // ---------- desenho por células ----------

  private segmentH(r: number, c1: number, c2: number): void {
    const from = Math.min(c1, c2);
    const to = Math.max(c1, c2);
    if (from === to) {
      this.addConn(r, from, L | R);
      return;
    }
    for (let c = from; c <= to; c++) {
      let mask = 0;
      if (c > from) mask |= L;
      if (c < to) mask |= R;
      this.addConn(r, c, mask);
    }
  }

  private segmentV(c: number, r1: number, r2: number): void {
    const from = Math.min(r1, r2);
    const to = Math.max(r1, r2);
    if (from === to) {
      this.addConn(from, c, U | D);
      return;
    }
    for (let r = from; r <= to; r++) {
      let mask = 0;
      if (r > from) mask |= U;
      if (r < to) mask |= D;
      this.addConn(r, c, mask);
    }
  }

  /** Degraus conectados (em vez de ╱ soltos): fica ligado como nos diagramas de texto. */
  private stairs(r1: number, c1: number, r2: number, c2: number): void {
    const steps = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
    if (steps === 0) return;
    let pr = r1;
    let pc = c1;
    for (let i = 1; i <= steps; i++) {
      const tr = r1 + Math.round(((r2 - r1) * i) / steps);
      const tc = c1 + Math.round(((c2 - c1) * i) / steps);
      let r = pr;
      let c = pc;
      // anda primeiro na horizontal e depois na vertical: mantém o degrau legível
      if (c !== tc) {
        const stepC = tc > c ? 1 : -1;
        while (c !== tc) {
          this.addConn(r, c, stepC > 0 ? R : L);
          c += stepC;
          this.addConn(r, c, stepC > 0 ? L : R);
        }
      }
      if (r !== tr) {
        const stepR = tr > r ? 1 : -1;
        while (r !== tr) {
          this.addConn(r, c, stepR > 0 ? D : U);
          r += stepR;
          this.addConn(r, c, stepR > 0 ? U : D);
        }
      }
      pr = tr;
      pc = tc;
    }
  }

  private traceLine(r1: number, c1: number, r2: number, c2: number): void {
    // só horizontal, vertical ou diagonal (em degraus conectados)
    if (r1 === r2) this.segmentH(r1, c1, c2);
    else if (c1 === c2) this.segmentV(c1, r1, r2);
    else this.stairs(r1, c1, r2, c2);
  }

  /**
   * Redesenha o traço da caneta inteiro a partir dos pontos crus (simplificados).
   * Sem isso, cada movimento da mão criava cantinhos extras e o traço ficava "picado".
   */
  private redrawPen(): void {
    if (!this.draftBase) return;
    this.restore(this.draftBase);
    const pts = simplify(
      this.penPoints.map((p) => ({ x: p.c, y: p.r })),
      1.1
    ).map((p) => ({ r: Math.round(p.y), c: Math.round(p.x) }));
    if (pts.length <= 1) {
      if (pts.length === 1) this.addConn(pts[0].r, pts[0].c, L | R);
      return;
    }
    for (let i = 1; i < pts.length; i++) {
      this.traceLine(pts[i - 1].r, pts[i - 1].c, pts[i].r, pts[i].c);
    }
  }

  private rectangle(r1: number, c1: number, r2: number, c2: number): void {
    const rt = Math.min(r1, r2);
    const rb = Math.max(r1, r2);
    const cl = Math.min(c1, c2);
    const cr = Math.max(c1, c2);
    if (rb - rt < 1 || cr - cl < 1) return;
    this.segmentH(rt, cl, cr);
    this.segmentH(rb, cl, cr);
    this.segmentV(cl, rt, rb);
    this.segmentV(cr, rt, rb);
  }

  insertTable(r0: number, c0: number, cols: number, bodyRows: number, pushHistory = true): void {
    const w = 12;
    const nCols = clamp(cols, 1, 8);
    const nRows = clamp(bodyRows, 0, 20);
    const totalW = nCols * w + (nCols - 1);
    const lastRow = nRows + 3;
    if (!this.inGrid(r0, c0) || c0 + totalW > this.cols || r0 + lastRow >= this.rows) {
      toast("A tabela não cabe nesse ponto — clique mais acima ou à esquerda.", "info");
      return;
    }
    if (pushHistory) this.pushUndo();
    this.rectangle(r0, c0, r0 + lastRow, c0 + totalW - 1);
    this.segmentH(r0 + 2, c0, c0 + totalW - 1);
    for (let i = 1; i < nCols; i++) this.segmentV(c0 + i * (w + 1) - 1, r0, r0 + lastRow);
    for (let i = 0; i < nCols; i++) {
      const startCol = c0 + i * (w + 1) + (i === 0 ? 1 : 0);
      this.addText(r0 + 1, startCol, `Campo ${i + 1}`);
    }
    this.request();
    this.onChange?.();
  }

  // ---------- modelos prontos (forma simples de "desenhar" em letras) ----------

  insertTemplate(kind: "box" | "flow" | "table"): void {
    const c0 = Math.max(1, Math.floor((this.cols - 34) / 2));
    const r0 = Math.max(1, Math.floor(this.rows / 2) - 5);
    if (kind === "table") {
      this.insertTable(r0, c0, 3, 2);
      return;
    }
    this.pushUndo();
    if (kind === "box") {
      this.rectangle(r0, c0, r0 + 5, c0 + 32);
      this.addText(r0 + 1, c0 + 2, "Título da caixa");
      this.addText(r0 + 3, c0 + 2, "[ ] item");
    } else {
      // fluxo A → B
      this.rectangle(r0, c0, r0 + 2, c0 + 10);
      this.rectangle(r0, c0 + 18, r0 + 2, c0 + 28);
      this.addText(r0 + 1, c0 + 4, "A");
      this.addText(r0 + 1, c0 + 22, "B");
      this.segmentH(r0 + 1, c0 + 10, c0 + 16);
      this.setChar(r0 + 1, c0 + 17, this.style === "ascii" ? ">" : "▶");
    }
    this.request();
    this.onChange?.();
  }

  // ---------- ponteiro ----------

  private cellFromEvent(e: MouseEvent | PointerEvent): { r: number; c: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * this.m.logicalW) / Math.max(rect.width, 1);
    const y = ((e.clientY - rect.top) * this.m.logicalH) / Math.max(rect.height, 1);
    return {
      r: clamp(Math.floor(y / this.m.cellH), 0, this.rows - 1),
      c: clamp(Math.floor(x / this.m.cellW), 0, this.cols - 1),
    };
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.canvas.focus();
    const cell = this.cellFromEvent(e);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignora */
    }

    if (this.tool === "select") {
      this.selection = null;
      this.selStart = cell;
      this.hoverCell = cell;
      this.request();
      this.onChange?.();
      return;
    }

    if (this.tool === "text") {
      this.openInput(cell, "", "Digite o texto");
      return;
    }
    if (this.tool === "field") {
      this.openInput(cell, "[ ] ", "Campo selecionável");
      return;
    }
    if (this.tool === "table") {
      this.openTablePopover(cell);
      return;
    }

    this.pushUndo();
    this.draftBase = this.snapshot();
    this.startCell = cell;
    this.lastCell = cell;
    this.penDrew = false;

    if (this.tool === "eraser") {
      this.eraseRunAt(cell);
    }
    if (this.tool === "pen") {
      this.penPoints = [cell];
    }
    this.request();
    this.onChange?.();
  };

  private onMove = (e: PointerEvent): void => {
    const cell = this.cellFromEvent(e);
    const changedHover = !this.hoverCell || this.hoverCell.r !== cell.r || this.hoverCell.c !== cell.c;
    this.hoverCell = cell;
    if (changedHover && e.buttons === 0) this.request();

    if (e.buttons !== 1 || !this.startCell || !this.draftBase) {
      // seleção de área (ferramenta ⌖): só marca, sem desenhar
      if (this.tool === "select" && this.selStart) {
        const r1 = Math.min(this.selStart.r, cell.r);
        const r2 = Math.max(this.selStart.r, cell.r);
        const c1 = Math.min(this.selStart.c, cell.c);
        const c2 = Math.max(this.selStart.c, cell.c);
        const changed = !this.selection || this.selection.r1 !== r1 || this.selection.r2 !== r2 || this.selection.c1 !== c1 || this.selection.c2 !== c2;
        this.selection = { r1, c1, r2, c2 };
        if (changed) {
          this.request();
          this.onChange?.();
        }
      }
      return;
    }

    if (this.tool === "eraser") {
      this.clearCell(cell.r, cell.c);
      this.request();
      this.onChange?.();
      return;
    }
    if (this.tool === "pen") {
      const last = this.penPoints[this.penPoints.length - 1];
      if (!last || last.r !== cell.r || last.c !== cell.c) {
        this.penPoints.push(cell);
        this.redrawPen();
        this.penDrew = true;
        this.request();
        this.onChange?.();
      }
      return;
    }
    if (this.tool === "line" || this.tool === "rect") {
      this.restore(this.draftBase);
      if (this.tool === "line") this.traceLine(this.startCell.r, this.startCell.c, cell.r, cell.c);
      else this.rectangle(this.startCell.r, this.startCell.c, cell.r, cell.c);
      this.request();
    }
  };

  private onUp = (e: PointerEvent): void => {
    try {
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignora */
    }
    this.startCell = null;
    this.lastCell = null;
    this.selStart = null;
    // clique simples com a caneta vira um ponto
    if (this.tool === "pen" && !this.penDrew && this.hoverCell) {
      this.setChar(this.hoverCell.r, this.hoverCell.c, this.style === "ascii" ? "*" : "•");
      this.request();
    }
    this.penPoints = [];
    this.penDrew = false;
    this.draftBase = null;
    this.onChange?.();
  };

  // ---------- entradas ----------

  private openInput(cell: { r: number; c: number }, initial: string, title: string): void {
    const input = document.createElement("textarea");
    input.className = "draw-text-input";
    input.rows = 1;
    input.spellcheck = false;
    input.value = initial;
    input.title = `${title} — Enter quebra linha · Ctrl+Enter ou clicar fora conclui`;
    const cellWpx = this.canvas.clientWidth / this.cols;
    const cellHpx = this.canvas.clientHeight / this.rows;
    input.style.left = `${this.canvas.offsetLeft + cell.c * cellWpx}px`;
    input.style.top = `${this.canvas.offsetTop + cell.r * cellHpx}px`;
    input.style.fontSize = `${Math.max(12, Math.round(this.m.fontSize * (this.canvas.clientHeight / this.m.logicalH)))}px`;
    input.style.lineHeight = "1.15";

    const fit = () => {
      const lines = input.value.split("\n");
      const longest = Math.max(1, ...lines.map((l) => l.length));
      input.style.width = `${Math.max(150, longest * cellWpx * 1.05)}px`;
      input.style.height = `${Math.max(1, lines.length) * cellHpx}px`;
    };
    input.addEventListener("input", fit);
    fit();

    let done = false;
    const commit = (keep: boolean) => {
      if (done) return;
      done = true;
      const value = keep ? input.value.replace(/\s+$/, "") : "";
      input.remove();
      if (value) {
        this.pushUndo();
        value.split("\n").forEach((line, i) => this.addText(cell.r + i, cell.c, line));
        this.request();
      }
      this.onChange?.();
    };
    input.addEventListener("blur", () => commit(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commit(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        commit(false);
      }
    });
    this.host.append(input);
    input.focus();
    input.select();
  }

  private openTablePopover(cell: { r: number; c: number }): void {
    this.host.querySelector(".txt-popover")?.remove();
    const pop = h("div", { class: "txt-popover" });
    pop.innerHTML = `
      <label>Colunas <input type="number" class="txt-cols" min="1" max="8" value="3"></label>
      <label>Linhas <input type="number" class="txt-rows" min="0" max="20" value="2"></label>
      <div class="txt-popover-actions">
        <button class="btn" data-cancel>Cancelar</button>
        <button class="btn primary" data-ok>Inserir</button>
      </div>`;
    this.host.append(pop);
    const scaleX = this.canvas.clientWidth / this.m.logicalW;
    const scaleY = this.canvas.clientHeight / this.m.logicalH;
    pop.style.left = `${this.canvas.offsetLeft + cell.c * this.m.cellW * scaleX}px`;
    pop.style.top = `${this.canvas.offsetTop + (cell.r + 1) * this.m.cellH * scaleY}px`;

    const colsInput = pop.querySelector<HTMLInputElement>(".txt-cols")!;
    const rowsInput = pop.querySelector<HTMLInputElement>(".txt-rows")!;
    const close = () => pop.remove();
    pop.querySelector<HTMLElement>("[data-cancel]")!.addEventListener("click", close);
    pop.querySelector<HTMLElement>("[data-ok]")!.addEventListener("click", () => {
      this.insertTable(cell.r, cell.c, Number(colsInput.value), Number(rowsInput.value));
      close();
    });
    pop.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        pop.querySelector<HTMLElement>("[data-ok]")!.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });
    colsInput.focus();
    colsInput.select();
  }

  // ---------- saída ----------

  /** Texto final: linhas com os caracteres, sem espaços à direita e sem linhas vazias nas pontas. */
  toText(): string {
    const lines: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      let line = "";
      for (let c = 0; c < this.cols; c++) line += this.cellChar(r, c);
      lines.push(line.replace(/\s+$/, ""));
    }
    while (lines.length && lines[0].trim() === "") lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    return lines.join("\n");
  }

  serialize(): TextDrawDoc {
    return {
      version: 1,
      kind: "text",
      cols: this.cols,
      rows: this.rows,
      style: this.style,
      conn: Object.fromEntries(this.conn),
      chars: Object.fromEntries(this.chars),
    };
  }

  /** Recarrega o desenho a partir de um texto (usado quando o usuário edita no editor). */
  applyText(text: string): void {
    this.conn.clear();
    this.chars.clear();
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    for (let r = 0; r < Math.min(lines.length, this.rows); r++) {
      const line = lines[r].replace(/\t/g, "  ");
      for (let c = 0; c < Math.min(line.length, this.cols); c++) {
        const ch = line[c];
        if (ch === " ") continue;
        const mask = REVERSE[this.style].get(ch);
        if (mask) this.conn.set(key(r, c), mask);
        else this.chars.set(key(r, c), ch);
      }
    }
    this.request();
    this.onChange?.();
  }

  /** Reconstrói o modelo a partir de um texto já desenhado (para reabrir e editar). */
  static fromText(text: string, style: TraceStyle): TextDrawDoc {
    const doc: TextDrawDoc = { version: 1, kind: "text", cols: DEFAULT_COLS, rows: DEFAULT_ROWS, style, conn: {}, chars: {} };
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    for (let r = 0; r < Math.min(lines.length, doc.rows); r++) {
      const line = lines[r].replace(/\t/g, "  ");
      for (let c = 0; c < Math.min(line.length, doc.cols); c++) {
        const ch = line[c];
        if (ch === " ") continue;
        const mask = REVERSE[style].get(ch);
        if (mask) doc.conn[key(r, c)] = mask;
        else doc.chars[key(r, c)] = ch;
      }
    }
    return doc;
  }
}

// ==========================================================================
// Editor embutido do desenho em letras
// ==========================================================================

export type TextEditorResult = { kind: "save"; text: string } | { kind: "cancel" } | { kind: "remove" };

export interface TextEditorOptions {
  doc?: TextDrawDoc | null;
  /** Chamado enquanto você desenha, para o texto ir aparecendo no editor em tempo real. */
  onLiveChange?: (text: string) => void;
  onDone: (result: TextEditorResult) => void | Promise<void>;
}

export interface TextEditorHandle {
  el: HTMLElement;
  focus(): void;
  dispose(): void;
  /** Recarrega o desenho a partir do texto (quando você edita o bloco no editor). */
  applyText(text: string): void;
}

const TOOLS: { id: TextTool; label: string; title: string }[] = [
  { id: "select", label: "⌖", title: "Selecionar área (V) — arraste marcando o retângulo e apague com Del" },
  { id: "pen", label: "✏", title: "Mão livre — traços viram linhas alinhadas (P)" },
  { id: "line", label: "─", title: "Linha (L)" },
  { id: "rect", label: "▭", title: "Caixa (R)" },
  { id: "text", label: "T", title: "Caixa de texto (T) — Enter quebra linha, dá para escrever várias linhas" },
  { id: "field", label: "[ ]", title: "Campo selecionável, ex.: [ ] tarefa (C)" },
  { id: "table", label: "▦", title: "Tabela de letras e símbolos (B)" },
  { id: "eraser", label: "⌫", title: "Borracha (E)" },
];

function tracePref(): TraceStyle {
  try {
    const value = localStorage.getItem("mdc.texttrace");
    if (value === "double" || value === "ascii") return value;
  } catch {
    /* ignora */
  }
  return "single";
}

export function createTextDrawEditor(opts: TextEditorOptions): TextEditorHandle {
  const panel = h("div", { class: "draw-inline text-draw", tabindex: "-1" });
  const style = opts.doc?.style ?? tracePref();

  panel.innerHTML = `
    <div class="dr-toolbar">
      <div class="dr-group">
        ${TOOLS.map((t) => `<button class="tbtn dr-tool" data-tool="${t.id}" title="${t.title}">${t.label}</button>`).join("")}
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <label class="dr-check" title="Estilo do traço">Traço
          <select class="txt-trace">
            <option value="single">Simples ┌─┐</option>
            <option value="double">Duplo ╔═╗</option>
            <option value="ascii">ASCII +-|</option>
          </select>
        </label>
      </div>
      <div class="dr-group">
        <button class="tbtn wide" data-act="templates" title="Modelos prontos: caixa, fluxo, tabela">Modelos ▾</button>
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <button class="btn icon" data-act="undo" title="Desfazer (Ctrl+Z)"><svg class="ic"><use href="#i-undo"/></svg></button>
        <button class="btn icon" data-act="redo" title="Refazer (Ctrl+Y)"><svg class="ic"><use href="#i-redo"/></svg></button>
        <button class="btn icon" data-act="del" title="Apagar a área selecionada (Del)"><svg class="ic"><use href="#i-trash"/></svg></button>
        <button class="tbtn wide" data-act="clear" title="Limpar tudo para começar de novo">Limpar</button>
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <button class="btn icon" data-act="zoom-out" title="Diminuir zoom (Ctrl + roda do mouse)">−</button>
        <button class="tbtn wide dr-zoom" data-act="zoom-reset" title="Voltar ao tamanho que cabe na tela">100%</button>
        <button class="btn icon" data-act="zoom-in" title="Aumentar zoom (Ctrl + roda do mouse)">+</button>
      </div>
      <span class="dr-spacer"></span>
      <span class="muted txt-hint">Desenhe com caixas, textos, campos [ ] e tabelas</span>
    </div>
    <div class="draw-canvas-wrap"><canvas class="dr-canvas" tabindex="0"></canvas></div>
    <div class="di-foot">
      <span class="muted">⌖ arraste para selecionar a área e <b>Del</b> apaga · botão direito apaga linha/rótulo · o texto aparece no editor enquanto você desenha</span>
      <span class="dr-spacer"></span>
      <button class="btn" data-act="remove" title="Remover este desenho do documento">Remover</button>
      <button class="btn" data-act="cancel">Cancelar</button>
      <button class="btn primary" data-act="done">Concluir</button>
    </div>`;

  const canvas = panel.querySelector<HTMLCanvasElement>(".dr-canvas")!;
  const wrap = panel.querySelector<HTMLElement>(".draw-canvas-wrap")!;
  const board = new TextBoard(canvas, wrap, { doc: opts.doc ?? null });

  const traceSelect = panel.querySelector<HTMLSelectElement>(".txt-trace")!;
  traceSelect.value = style;
  traceSelect.addEventListener("change", () => {
    board.setStyle(traceSelect.value as TraceStyle);
    try {
      localStorage.setItem("mdc.texttrace", traceSelect.value);
    } catch {
      /* ignora */
    }
    refresh();
  });

  let busy = false;
  let stopped = false;
  let liveTimer: number | undefined;
  let livePending = false;
  const notifyLive = () => {
    if (!opts.onLiveChange || stopped) return;
    livePending = true;
    if (liveTimer !== undefined) return;
    liveTimer = window.setTimeout(() => {
      liveTimer = undefined;
      if (!livePending || stopped) return;
      livePending = false;
      opts.onLiveChange?.(board.toText());
    }, 140);
  };
  const finish = async (result: TextEditorResult) => {
    if (busy) return;
    busy = true;
    stopped = true;
    if (liveTimer !== undefined) {
      window.clearTimeout(liveTimer);
      liveTimer = undefined;
    }
    panel.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = true));
    try {
      await opts.onDone(result);
    } catch (error) {
      toast("Não foi possível salvar o desenho: " + error, "err");
      panel.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = false));
    } finally {
      busy = false;
    }
  };

  panel.querySelectorAll<HTMLElement>(".dr-tool").forEach((btn) => {
    btn.addEventListener("click", () => {
      board.setTool((btn.dataset.tool as TextTool) ?? "pen");
      refresh();
    });
  });

  // modelos prontos (jeito simples de montar caixas, fluxos e tabelas)
  panel.querySelector<HTMLElement>('[data-act="templates"]')!.addEventListener("click", () => {
    wrap.querySelector(".txt-popover")?.remove();
    const pop = h("div", { class: "txt-popover" });
    pop.innerHTML = `
      <div class="txt-popover-title">Modelos prontos</div>
      <button class="btn" data-model="box">Caixa com título e campo [ ]</button>
      <button class="btn" data-model="flow">Fluxo  A ▶ B</button>
      <button class="btn" data-model="table">Tabela 3 × 2</button>`;
    pop.style.left = "14px";
    pop.style.top = "52px";
    wrap.append(pop);
    const close = () => pop.remove();
    pop.querySelectorAll<HTMLElement>("[data-model]").forEach((b) =>
      b.addEventListener("click", () => {
        board.insertTemplate(b.dataset.model as "box" | "flow" | "table");
        close();
      })
    );
    pop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });
    pop.querySelector<HTMLElement>("[data-model]")?.focus();
  });

  const act = (name: string, fn: () => void) => {
    panel.querySelectorAll<HTMLElement>(`[data-act="${name}"]`).forEach((b) =>
      b.addEventListener("click", () => {
        fn();
        refresh();
      })
    );
  };
  act("undo", () => board.undo());
  act("redo", () => board.redo());
  act("del", () => board.eraseSelection());
  act("clear", () => board.clearAll());

  // ---- zoom (ajuste fino) ----
  const zoomLabel = panel.querySelector<HTMLElement>('[data-act="zoom-reset"]')!;
  const updateZoom = () => {
    zoomLabel.textContent = `${Math.round(board.getZoom() * 100)}%`;
  };
  act("zoom-in", () => {
    board.setZoom(board.getZoom() + 0.25);
    updateZoom();
  });
  act("zoom-out", () => {
    board.setZoom(board.getZoom() - 0.25);
    updateZoom();
  });
  act("zoom-reset", () => {
    board.setZoom(1);
    updateZoom();
  });
  updateZoom();
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      board.setZoom(board.getZoom() + (e.deltaY < 0 ? 0.25 : -0.25));
      updateZoom();
    },
    { passive: false }
  );
  act("cancel", () => void finish({ kind: "cancel" }));
  act("remove", () => void finish({ kind: "remove" }));
  act("done", () => {
    const text = board.toText();
    if (!text.trim()) {
      toast("Desenhe algo antes de concluir.", "info");
      return;
    }
    void finish({ kind: "save", text });
  });

  const refresh = () => {
    panel.querySelectorAll<HTMLElement>(".dr-tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === board.tool));
    panel.querySelector<HTMLButtonElement>('[data-act="undo"]')!.disabled = !board.canUndo();
    panel.querySelector<HTMLButtonElement>('[data-act="redo"]')!.disabled = !board.canRedo();
    panel.querySelector<HTMLButtonElement>('[data-act="clear"]')!.disabled = board.isEmpty();
    panel.querySelector<HTMLButtonElement>('[data-act="del"]')!.disabled = !board.hasSelection();
  };
  board.onChange = () => {
    refresh();
    notifyLive();
  };

  panel.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) board.redo();
        else board.undo();
        refresh();
      } else if (k === "y") {
        e.preventDefault();
        board.redo();
        refresh();
      } else if (k === "enter") {
        e.preventDefault();
        panel.querySelector<HTMLElement>('[data-act="done"]')!.click();
      }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (board.hasSelection()) {
        e.preventDefault();
        board.eraseSelection();
        refresh();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (board.hasSelection()) {
        board.clearSelection();
        refresh();
        return;
      }
      void finish({ kind: "cancel" });
      return;
    }
    const map: Record<string, TextTool> = { v: "select", p: "pen", l: "line", r: "rect", t: "text", c: "field", b: "table", e: "eraser" };
    if (map[k]) {
      board.setTool(map[k]);
      refresh();
    }
  });

  refresh();
  return {
    el: panel,
    focus: () => canvas.focus(),
    dispose: () => board.dispose(),
    applyText: (text: string) => {
      if (stopped) return;
      board.applyText(text);
    },
  };
}
