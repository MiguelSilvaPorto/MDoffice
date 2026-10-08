// Células da grade: escrever, apagar, selecionar e bordas.

import type { TextBoard } from "./board";
import { key } from "./model";
import { U, R, D, L, GLYPHS } from "./glyphs";

export const boardCellsMethods = {
  cellChar(this: TextBoard, r: number, c: number): string {
    const k = key(r, c);
    const ch = this.chars.get(k);
    if (ch) return ch;
    const mask = this.conn.get(k) ?? 0;
    return mask ? GLYPHS[this.style][mask] : " ";
  },

  inGrid(this: TextBoard, r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.rows && c < this.cols;
  },

  addConn(this: TextBoard, r: number, c: number, mask: number): void {
    if (!this.inGrid(r, c)) return;
    const k = key(r, c);
    if (this.chars.has(k)) return;
    this.conn.set(k, (this.conn.get(k) ?? 0) | mask);
  },

  clearCell(this: TextBoard, r: number, c: number): void {
    const k = key(r, c);
    this.conn.delete(k);
    this.chars.delete(k);
  },

  setChar(this: TextBoard, r: number, c: number, ch: string): void {
    if (!this.inGrid(r, c) || ch === "") return;
    this.chars.set(key(r, c), ch);
    this.conn.delete(key(r, c));
  },

  addText(this: TextBoard, r: number, c: number, text: string): void {
    let col = c;
    for (const ch of text) {
      if (ch === " ") {
        col++;
        continue;
      }
      this.setChar(r, col, ch);
      col++;
    }
  },

  hasSelection(this: TextBoard): boolean {
    return this.selection !== null;
  },

  clearSelection(this: TextBoard): void {
    if (!this.selection) return;
    this.selection = null;
    this.request();
    this.onChange?.();
  },

  /** Apaga tudo o que estiver dentro da área selecionada. */
  eraseSelection(this: TextBoard): boolean {
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
  },

  isEmpty(this: TextBoard): boolean {
    return this.conn.size === 0 && this.chars.size === 0;
  },

  /**
   * Apaga o que está sob o cursor em um clique:
   * um rótulo/texto inteiro, ou o trecho reto da linha (horizontal ou vertical).
   */
  eraseRunAt(this: TextBoard, cell: { r: number; c: number }): void {
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
  },

  eBordaVertical(this: TextBoard, r: number, c: number): boolean {
    // olha a linha de cima/baixo também: o texto transbordando pode ter apagado a borda
    for (const rr of [r, r - 1, r + 1]) {
      if (rr < 0 || rr >= this.rows) continue;
      const ch = this.chars.get(key(rr, c));
      if (ch && "│┃|║".includes(ch)) return true;
      const mask = this.conn.get(key(rr, c)) ?? 0;
      if (mask !== 0 && (mask & (U | D)) !== 0) return true;
    }
    return false;
  },

  eBordaHorizontal(this: TextBoard, r: number, c: number): boolean {
    for (const cc of [c, c - 1, c + 1]) {
      if (cc < 0 || cc >= this.cols) continue;
      const ch = this.chars.get(key(r, cc));
      if (ch && "─━-═".includes(ch)) return true;
      const mask = this.conn.get(key(r, cc)) ?? 0;
      if (mask !== 0 && (mask & (L | R)) !== 0) return true;
    }
    return false;
  },

  /** Célula que é borda/traço (não é texto). */
  eCelulaDeBorda(this: TextBoard, r: number, c: number): boolean {
    const ch = this.chars.get(key(r, c));
    if (ch && "│┃|║─━-═┌┐└┘├┤┬┴┼".includes(ch)) return true;
    return (this.conn.get(key(r, c)) ?? 0) !== 0;
  },

  /** Apaga só o TEXTO do retângulo (as bordas desenhadas ficam). */
  apagarTextoDentro(this: TextBoard, r1: number, c1: number, r2: number, c2: number): void {
    for (let rr = Math.max(0, r1); rr <= Math.min(this.rows - 1, r2); rr++) {
      for (let cc = Math.max(0, c1); cc <= Math.min(this.cols - 1, c2); cc++) this.chars.delete(key(rr, cc));
    }
  },
};
