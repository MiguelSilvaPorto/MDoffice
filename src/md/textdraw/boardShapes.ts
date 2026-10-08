// Linhas, retângulos, tabelas e modelos desenhados com caracteres.

import type { TextBoard } from "./board";
import { clamp, toast } from "../../util";
import { simplify } from "../draw";
import { U, R, D, L } from "./glyphs";

export const boardShapesMethods = {
  segmentH(this: TextBoard, r: number, c1: number, c2: number): void {
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
  },

  segmentV(this: TextBoard, c: number, r1: number, r2: number): void {
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
  },

  /** Degraus conectados (em vez de ╱ soltos): fica ligado como nos diagramas de texto. */
  stairs(this: TextBoard, r1: number, c1: number, r2: number, c2: number): void {
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
  },

  traceLine(this: TextBoard, r1: number, c1: number, r2: number, c2: number): void {
    // só horizontal, vertical ou diagonal (em degraus conectados)
    if (r1 === r2) this.segmentH(r1, c1, c2);
    else if (c1 === c2) this.segmentV(c1, r1, r2);
    else this.stairs(r1, c1, r2, c2);
  },

  /**
   * Redesenha o traço da caneta inteiro a partir dos pontos crus (simplificados).
   * Sem isso, cada movimento da mão criava cantinhos extras e o traço ficava "picado".
   */
  redrawPen(this: TextBoard): void {
    if (!this.draftBase) return;
    this.restore(this.draftBase);
    const crus = this.penPoints;
    let pts = simplify(
      crus.map((p) => ({ x: p.c, y: p.r })),
      1.1
    ).map((p) => ({ r: Math.round(p.y), c: Math.round(p.x) }));
    if (crus.length) {
      // a simplificação não pode "comer" o fim do traço (senão a caixa não fecha)
      const ultimo = crus[crus.length - 1];
      const fim = pts[pts.length - 1];
      if (!fim || fim.r !== ultimo.r || fim.c !== ultimo.c) pts = [...pts, { r: ultimo.r, c: ultimo.c }];
      // terminou perto de onde começou? fecha o traço (caixas desenhadas à mão)
      const inicio = crus[0];
      if (pts.length > 2 && Math.max(Math.abs(ultimo.r - inicio.r), Math.abs(ultimo.c - inicio.c)) <= 3) {
        pts = [...pts, { r: inicio.r, c: inicio.c }];
      }
    }
    if (pts.length <= 1) {
      if (pts.length === 1) this.addConn(pts[0].r, pts[0].c, L | R);
      return;
    }
    for (let i = 1; i < pts.length; i++) {
      this.traceLine(pts[i - 1].r, pts[i - 1].c, pts[i].r, pts[i].c);
    }
  },

  /** Acha a caixa (retângulo desenhado) que envolve o ponto — é o que permite ajustar o texto. */
  findBox(this: TextBoard, r: number, c: number): { r1: number; c1: number; r2: number; c2: number } | null {
    let c1 = -1;
    for (let cc = c; cc >= 0; cc--) {
      if (this.eBordaVertical(r, cc)) {
        c1 = cc;
        break;
      }
    }
    if (c1 < 0) return null;
    let c2 = -1;
    // a busca da direita começa depois da borda esquerda (senão acha ela mesma)
    for (let cc = Math.max(c, c1 + 1); cc < this.cols; cc++) {
      if (this.eBordaVertical(r, cc)) {
        c2 = cc;
        break;
      }
    }
    if (c2 < 0 || c2 - c1 < 3) return null;
    let r1 = -1;
    for (let rr = r; rr >= 0; rr--) {
      if (this.eBordaHorizontal(rr, c1) || this.eBordaHorizontal(rr, c2)) {
        r1 = rr;
        break;
      }
    }
    if (r1 < 0) return null;
    let r2 = -1;
    for (let rr = Math.max(r, r1 + 1); rr < this.rows; rr++) {
      if (this.eBordaHorizontal(rr, c1) || this.eBordaHorizontal(rr, c2)) {
        r2 = rr;
        break;
      }
    }
    if (r2 < 0 || r2 - r1 < 2) return null;
    return { r1, c1, r2, c2 };
  },

  /** Quebra as linhas para caber na largura, sem cortar palavra quando dá. */
  wrapToWidth(this: TextBoard, lines: string[], largura: number): string[] {
    const out: string[] = [];
    for (const linha of lines) {
      let resto = linha.trim();
      while (resto.length > largura) {
        let corte = resto.lastIndexOf(" ", largura);
        if (corte <= 0) corte = largura;
        out.push(resto.slice(0, corte).trimEnd());
        resto = resto.slice(corte).trimStart();
      }
      if (resto) out.push(resto);
    }
    return out;
  },

  /** Põe o texto selecionado dentro da caixa em volta: quebrado na largura e centralizado. */
  fitSelectionToBox(this: TextBoard): boolean {
    const sel = this.selection;
    if (!sel) {
      toast("Escolha ⌖, arraste sobre o texto e clique de novo em “Ajustar à caixa”.", "info", 4600);
      return false;
    }
    const caixa = this.findBox(sel.r1, sel.c1) ?? this.findBox(sel.r2, sel.c2);
    if (!caixa) {
      toast("Não encontrei uma caixa em volta dessa área.", "info", 3600);
      return false;
    }
    const linhas: string[] = [];
    for (let rr = sel.r1; rr <= sel.r2; rr++) {
      // pega a linha inteira a partir da seleção (senão o texto que transborda se perderia)
      let fim = sel.c1;
      for (let cc = this.cols - 1; cc >= sel.c1; cc--) {
        if (this.cellChar(rr, cc) !== " " && !this.eCelulaDeBorda(rr, cc)) {
          fim = cc;
          break;
        }
      }
      let linha = "";
      for (let cc = sel.c1; cc <= fim; cc++) {
        // a borda não é texto: entra como espaço
        linha += this.eCelulaDeBorda(rr, cc) ? " " : this.cellChar(rr, cc);
      }
      linhas.push(linha.replace(/\s+$/, ""));
    }
    const naoVazias = linhas.filter((l) => l.trim() !== "");
    if (!naoVazias.length) {
      toast("A área selecionada não tem texto.", "info", 3000);
      return false;
    }
    const recuo = Math.min(...naoVazias.map((l) => l.length - l.trimStart().length));
    const texto = linhas.map((l) => l.slice(recuo)).join("\n");

    const largura = Math.max(3, caixa.c2 - caixa.c1 - 1);
    const altura = Math.max(1, caixa.r2 - caixa.r1 - 1);
    let quebradas = this.wrapToWidth(texto.split("\n"), largura);
    if (!quebradas.length) quebradas = [""];
    const cortou = quebradas.length > altura;
    if (cortou) quebradas = quebradas.slice(0, altura);

    this.pushUndo();
    // apaga o texto selecionado e também o que passou da seleção (transbordo) naquelas linhas
    for (let rr = sel.r1; rr <= sel.r2; rr++) {
      let fim = sel.c2;
      for (let cc = this.cols - 1; cc > sel.c2; cc--) {
        if (this.cellChar(rr, cc) !== " " && !this.eCelulaDeBorda(rr, cc)) {
          fim = cc;
          break;
        }
      }
      this.apagarTextoDentro(rr, sel.c1, rr, fim);
    }
    this.apagarTextoDentro(caixa.r1 + 1, caixa.c1 + 1, caixa.r2 - 1, caixa.c2 - 1);
    // redesenha a borda: o texto que transbordava pode ter apagado pedaços dela
    this.rectangle(caixa.r1, caixa.c1, caixa.r2, caixa.c2);
    const inicio = caixa.r1 + 1 + Math.max(0, Math.floor((altura - quebradas.length) / 2));
    quebradas.forEach((linha, i) => this.addText(inicio + i, caixa.c1 + 1, linha));
    this.selection = null;
    this.request();
    this.onChange?.();
    toast(
      cortou ? "Texto ajustado na caixa — mas não coube tudo: aumente a altura da caixa." : "Texto ajustado dentro da caixa.",
      cortou ? "info" : "ok",
      4200
    );
    return true;
  },

  rectangle(this: TextBoard, r1: number, c1: number, r2: number, c2: number): void {
    const rt = Math.min(r1, r2);
    const rb = Math.max(r1, r2);
    const cl = Math.min(c1, c2);
    const cr = Math.max(c1, c2);
    // caixa "deitada" ou "em pé" (1 célula de altura/largura): desenha como linha
    if (rb - rt < 1 && cr - cl < 1) return;
    if (rb - rt < 1) {
      this.segmentH(rt, cl, cr);
      return;
    }
    if (cr - cl < 1) {
      this.segmentV(cl, rt, rb);
      return;
    }
    this.segmentH(rt, cl, cr);
    this.segmentH(rb, cl, cr);
    this.segmentV(cl, rt, rb);
    this.segmentV(cr, rt, rb);
  },

  insertTable(this: TextBoard, r0: number, c0: number, cols: number, bodyRows: number, pushHistory = true): void {
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
  },

  insertTemplate(this: TextBoard, kind: "box" | "flow" | "table"): void {
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
  },
};
