// Desfazer/refazer, copiar/colar, duplicar, mover e apagar a seleção.

import type { Board } from "./board";
import { uid } from "../../util";
import { type DrEl } from "./model";
import { cloneEl, translateEl } from "./elements";

export const boardHistoryMethods = {
  pushUndo(this: Board): void {
    this.undoStack.push(JSON.stringify(this.els));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack.length = 0;
  },

  undo(this: Board): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify(this.els));
    this.els = JSON.parse(prev) as DrEl[];
    if (this.selectedId && !this.els.some((e) => e.id === this.selectedId)) this.selectedId = null;
    this.request();
    this.onChange?.();
  },

  redo(this: Board): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify(this.els));
    this.els = JSON.parse(next) as DrEl[];
    this.request();
    this.onChange?.();
  },

  /** Guarda o elemento selecionado para colar depois (Ctrl+C). */
  copySelected(this: Board): boolean {
    const sel = this.selectedEl();
    if (!sel) return false;
    this.clipboard = cloneEl(sel);
    return true;
  },

  /** Cola a última cópia com um deslocamento, mantendo o padrão do desenho (Ctrl+V). */
  pasteClipboard(this: Board): boolean {
    if (!this.clipboard) return false;
    this.pushUndo();
    const copy = cloneEl(this.clipboard);
    copy.id = uid();
    translateEl(copy, 24, 24);
    translateEl(this.clipboard, 24, 24);
    this.els.push(copy);
    this.selectedId = copy.id;
    this.request();
    this.onChange?.();
    return true;
  },

  duplicateSelected(this: Board): void {
    const sel = this.selectedEl();
    if (!sel) return;
    this.pushUndo();
    const copy = JSON.parse(JSON.stringify(sel)) as DrEl;
    copy.id = uid();
    translateEl(copy, 24, 24);
    this.els.push(copy);
    this.selectedId = copy.id;
    this.request();
    this.onChange?.();
  },

  /** Move o elemento selecionado em passos pequenos (setas do teclado). */
  nudgeSelected(this: Board, dx: number, dy: number): boolean {
    const sel = this.selectedEl();
    if (!sel) return false;
    const now = Date.now();
    if (now - this.lastNudgeAt > 700) this.pushUndo();
    this.lastNudgeAt = now;
    translateEl(sel, dx, dy);
    this.request();
    this.onChange?.();
    return true;
  },

  deleteSelected(this: Board): void {
    const sel = this.selectedEl();
    if (!sel) return;
    this.pushUndo();
    this.els = this.els.filter((e) => e.id !== sel.id);
    this.selectedId = null;
    this.request();
    this.onChange?.();
  },

  clearAll(this: Board): void {
    if (this.els.length === 0) return;
    this.pushUndo();
    this.els = [];
    this.selectedId = null;
    this.request();
    this.onChange?.();
  },

  selectedEl(this: Board): DrEl | null {
    if (!this.selectedId) return null;
    return this.els.find((e) => e.id === this.selectedId) ?? null;
  },

  clearGuides(this: Board): void {
    this.guidesX = [];
    this.guidesY = [];
  },

  canUndo(this: Board): boolean {
    return this.undoStack.length > 0;
  },

  canRedo(this: Board): boolean {
    return this.redoStack.length > 0;
  },

  hasSelection(this: Board): boolean {
    return this.selectedEl() !== null;
  },

  hasClipboard(this: Board): boolean {
    return this.clipboard !== null;
  },
};
