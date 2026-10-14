// A grade de caracteres: estado, desenho dos traços, tabelas e entrada de texto.

import { h, clamp, toast } from "../../util";
import { simplify } from "../draw";
import { type TraceStyle, type TextDrawDoc, MONO, DEFAULT_COLS, DEFAULT_ROWS, key, type TextTool } from "./model";
import { U, R, D, L, GLYPHS, REVERSE } from "./glyphs";
import { type Metrics, metrics } from "./metrics";
import { boardCellsMethods } from "./boardCells";
import { boardHistoryMethods } from "./boardHistory";
import { boardShapesMethods } from "./boardShapes";
import { boardInputMethods } from "./boardInput";

export class TextBoard {
  readonly cols: number;
  readonly rows: number;
  style: TraceStyle;
  tool: TextTool = "pen";
  onChange: (() => void) | null = null;

  conn = new Map<string, number>();
  chars = new Map<string, string>();
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  ctx: CanvasRenderingContext2D;
  m: Metrics;
  undoStack: string[] = [];
  redoStack: string[] = [];
  draftBase: { conn: Map<string, number>; chars: Map<string, string> } | null = null;
  startCell: { r: number; c: number } | null = null;
  lastCell: { r: number; c: number } | null = null;
  penPoints: { r: number; c: number }[] = [];
  penDrew = false;
  hoverCell: { r: number; c: number } | null = null;
  selection: { r1: number; c1: number; r2: number; c2: number } | null = null;
  selStart: { r: number; c: number } | null = null;
  raf = 0;
  resizeObs: ResizeObserver | null = null;
  zoom = 1;
  /** Botão direito pressionado: o arrasto move a TELA (panorama) em vez de apagar. */
  pano: { x0: number; y0: number; esquerda: number; topo: number; moveu: boolean } | null = null;
  /** O último botão direito foi um arrasto de panorama? (o menu de contexto pergunta e consome) */
  panMoveu = false;
  /** Tamanho da FOLHA (o quadro inteiro no zoom atual), em px CSS — é ela que dá a rolagem. */
  cssW = 0;
  cssH = 0;
  /** De onde a folha começa dentro do recipiente rolável (os recuos dele). */
  recuoEsq = 0;
  recuoTopo = 0;

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
    // botão direito parado apaga a linha/rótulo sob o cursor; com arrasto (panorama), não apaga
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.consumirPanorama()) return;
      const cell = this.cellFromEvent(e);
      this.pushUndo();
      this.eraseRunAt(cell);
      this.request();
      this.onChange?.();
    });

    this.resizeObs = new ResizeObserver(() => this.fit());
    this.resizeObs.observe(host);
    // a janela anda com a rolagem: o pedaço à vista é repintado na hora
    host.addEventListener("scroll", () => this.request(), { passive: true });
    this.fit();
    this.request();
  }

  dispose(): void {
    this.resizeObs?.disconnect();
  }

  // ---------- tamanho / desenho ----------

  /**
   * Ajusta a FOLHA (o quadro inteiro no zoom atual — é ela que dá a rolagem) e a JANELA
   * (o pedaço visível, que é o que o canvas pinta). Pintar só a janela é o que deixa o
   * zoom de 800% nítido: o quadro inteiro em resolução cheia seriam dezenas de milhões de pixels.
   */
  fit(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cs = getComputedStyle(this.host);
    const recuoEsq = parseFloat(cs.paddingLeft) || 0;
    const recuoTopo = parseFloat(cs.paddingTop) || 0;
    const recuoX = recuoEsq + (parseFloat(cs.paddingRight) || 0);
    const recuoY = recuoTopo + (parseFloat(cs.paddingBottom) || 0);
    const hostW = this.host.clientWidth;

    const avail = Math.max(220, hostW - recuoX - 8);
    const cssW = Math.min(avail, this.m.logicalW) * this.zoom;
    const cssH = (cssW * this.m.logicalH) / this.m.logicalW;
    this.cssW = cssW;
    this.cssH = cssH;
    this.recuoEsq = recuoEsq;
    this.recuoTopo = recuoTopo;
    const sheet = this.canvas.parentElement;
    if (sheet) {
      sheet.style.width = `${Math.round(cssW)}px`;
      sheet.style.height = `${Math.round(cssH)}px`;
    }

    // a janela: o que o canvas ocupa de verdade (nunca mais que a folha)
    const viewW = Math.max(1, Math.min(hostW - recuoX, cssW));
    const viewH = Math.max(1, Math.min(this.host.clientHeight - recuoY, cssH));
    this.canvas.style.width = `${Math.round(viewW)}px`;
    this.canvas.style.height = `${Math.round(viewH)}px`;
    // buffer = janela × densidade da tela (com teto de memória ~32 MB): em qualquer zoom, 1:1
    const escala = Math.min(dpr, Math.sqrt(8_000_000 / Math.max(1, viewW * viewH)));
    this.canvas.width = Math.max(1, Math.round(viewW * escala));
    this.canvas.height = Math.max(1, Math.round(viewH * escala));
    this.request();
  }

  // ---------- zoom ----------

  getZoom(): number {
    return this.zoom;
  }

  /** Onde a janela visível está (px CSS dentro da folha) e quanto vale 1 unidade lógica. */
  janela(): { x: number; y: number; k: number } {
    const k = this.cssW / this.m.logicalW;
    const x = clamp(this.host.scrollLeft - this.recuoEsq, 0, Math.max(0, this.cssW - this.canvas.clientWidth));
    const y = clamp(this.host.scrollTop - this.recuoTopo, 0, Math.max(0, this.cssH - this.canvas.clientHeight));
    return { x, y, k };
  }

  /** Ponto lógico (na grade) a partir de um evento do mouse. */
  pontoDe(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const j = this.janela();
    return { x: (e.clientX - r.left + j.x) / j.k, y: (e.clientY - r.top + j.y) / j.k };
  }

  /** Zoom até 800% com âncora: o ponto sob o ponteiro (ou o centro da janela) fica onde está. */
  setZoom(zoom: number, ancora?: { x: number; y: number }): void {
    const wr = this.host.getBoundingClientRect();
    const alvo = ancora ?? { x: wr.left + this.host.clientWidth / 2, y: wr.top + this.host.clientHeight / 2 };
    const r = this.canvas.getBoundingClientRect();
    const j = this.janela();
    const alvoLogico = { x: (alvo.x - r.left + j.x) / j.k, y: (alvo.y - r.top + j.y) / j.k };
    this.zoom = clamp(Math.round(zoom * 100) / 100, 0.5, 8);
    this.fit();
    // rola para o ponto lógico voltar para debaixo da âncora (o k já é o novo)
    const k = this.cssW / this.m.logicalW;
    this.host.scrollLeft = Math.max(0, wr.left + this.recuoEsq + alvoLogico.x * k - alvo.x);
    this.host.scrollTop = Math.max(0, wr.top + this.recuoTopo + alvoLogico.y * k - alvo.y);
  }

  request(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  render(): void {
    const ctx = this.ctx;
    // a janela visível: o canvas pinta só o pedaço à vista, em resolução cheia
    const j = this.janela();
    const escala = this.canvas.width / Math.max(1, this.canvas.clientWidth);
    ctx.setTransform(j.k * escala, 0, 0, j.k * escala, -j.x * escala, -j.y * escala);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.m.logicalW, this.m.logicalH);

    // grade de apoio (não sai no texto final)
    ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
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

    // traços e bordas desenhados como LINHAS de verdade: ligam certinho entre células
    // (necessário agora que as células são quadradas e a letra é mais estreita que a célula)
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = Math.max(1, this.m.cellH * 0.08);
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (const [k, mask] of this.conn) {
      if (mask === 0 || this.chars.has(k)) continue;
      const [r, c] = k.split(",").map(Number);
      const x = (c + 0.5) * this.m.cellW;
      const y = (r + 0.5) * this.m.cellH;
      if (mask & L) {
        ctx.moveTo(x, y);
        ctx.lineTo(x - this.m.cellW / 2, y);
      }
      if (mask & R) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + this.m.cellW / 2, y);
      }
      if (mask & U) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - this.m.cellH / 2);
      }
      if (mask & D) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + this.m.cellH / 2);
      }
    }
    ctx.stroke();

    ctx.fillStyle = "#1f2937";
    ctx.font = `${this.m.fontSize}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.chars.get(key(r, c));
        if (!ch || ch === " ") continue;
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

  // ---------- modelo ----------

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

  // ---------- desenho por células ----------

  // ---------- texto que se ajusta à caixa ----------

  // ---------- modelos prontos (forma simples de "desenhar" em letras) ----------

  // ---------- ponteiro ----------

  /**
   * O último clique direito foi um arrasto (panorama)? Consome a marca.
   *
   * Quem pergunta é o menu de contexto: botão direito + arrastar move a TELA (e não apaga);
   * clique parado continua apagando. O navegador dispara `contextmenu` logo depois do
   * `pointerup`, então a marca precisa sobreviver de um evento para o outro — e o arrasto só
   * conta depois de passar a zona morta de 3 px (clique tremido não vira arrasto).
   */
  consumirPanorama(): boolean {
    const moveu = this.panMoveu;
    this.panMoveu = false;
    return moveu;
  }

  onDown = (e: PointerEvent): void => {
    // botão direito: arrastar move a tela (panorama). Sem arrasto, o clique segue para o
    // menu de contexto, que apaga a linha/rótulo (ver `consumirPanorama`).
    if (e.button === 2) {
      this.pano = { x0: e.clientX, y0: e.clientY, esquerda: this.host.scrollLeft, topo: this.host.scrollTop, moveu: false };
      this.host.classList.add("txt-pano"); // cursor de "agarrando" em toda a folha
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    // foca sem rolar a tela (senão o navegador "puxa" a vista para o canvas a cada traço)
    this.canvas.focus({ preventScroll: true });
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

    if (this.tool === "text" || this.tool === "field" || this.tool === "table") {
      // impede o navegador de dar foco ao canvas e "roubar" o foco da caixinha de texto
      e.preventDefault();
      if (this.tool === "text") this.openInput(cell, "", "Digite o texto");
      else if (this.tool === "field") this.openInput(cell, "[ ] ", "Campo selecionável");
      else this.openTablePopover(cell);
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

  onMove = (e: PointerEvent): void => {
    // panorama: o quanto o ponteiro andou é o quanto a folha rola (ao contrário)
    if (this.pano) {
      const dx = e.clientX - this.pano.x0;
      const dy = e.clientY - this.pano.y0;
      if (!this.pano.moveu && Math.abs(dx) + Math.abs(dy) > 3) this.pano.moveu = true;
      if (!this.pano.moveu) return;
      this.host.scrollLeft = this.pano.esquerda - dx;
      this.host.scrollTop = this.pano.topo - dy;
      return;
    }
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

  onUp = (e: PointerEvent): void => {
    try {
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignora */
    }
    // panorama: a marca fica para o menu de contexto decidir se apaga (arrasto não apaga)
    if (this.pano) {
      this.panMoveu = this.pano.moveu;
      this.pano = null;
      this.host.classList.remove("txt-pano");
      return;
    }
    // garante que linha/caixa terminem exatamente na célula onde o mouse foi solto
    if ((this.tool === "line" || this.tool === "rect") && this.startCell && this.draftBase) {
      const fim = this.cellFromEvent(e);
      this.restore(this.draftBase);
      if (this.tool === "line") this.traceLine(this.startCell.r, this.startCell.c, fim.r, fim.c);
      else this.rectangle(this.startCell.r, this.startCell.c, fim.r, fim.c);
      this.request();
      this.onChange?.();
    }
    // caneta: o ponto onde o mouse foi solto também faz parte do traço
    if (this.tool === "pen" && this.draftBase && this.penPoints.length) {
      const fim = this.cellFromEvent(e);
      const ultimo = this.penPoints[this.penPoints.length - 1];
      if (fim.r !== ultimo.r || fim.c !== ultimo.c) {
        this.penPoints.push(fim);
        this.penDrew = true;
      }
      this.redrawPen();
      this.request();
      this.onChange?.();
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

  // ---------- saída ----------

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

// Os métodos ficam em arquivos próprios e são colados na classe aqui.
type BoardCellsMethodsType = typeof boardCellsMethods;
type BoardHistoryMethodsType = typeof boardHistoryMethods;
type BoardShapesMethodsType = typeof boardShapesMethods;
type BoardInputMethodsType = typeof boardInputMethods;
export interface TextBoard extends BoardCellsMethodsType, BoardHistoryMethodsType, BoardShapesMethodsType, BoardInputMethodsType {}
Object.assign(TextBoard.prototype, boardCellsMethods, boardHistoryMethods, boardShapesMethods, boardInputMethods);
