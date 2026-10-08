// Desfazer e refazer.

import type { TextBoard } from "./board";

export const boardHistoryMethods = {
  snapshot(this: TextBoard): { conn: Map<string, number>; chars: Map<string, string> } {
    return { conn: new Map(this.conn), chars: new Map(this.chars) };
  },

  restore(this: TextBoard, snap: { conn: Map<string, number>; chars: Map<string, string> }): void {
    this.conn = new Map(snap.conn);
    this.chars = new Map(snap.chars);
  },

  pushUndo(this: TextBoard): void {
    this.undoStack.push(JSON.stringify({ conn: Object.fromEntries(this.conn), chars: Object.fromEntries(this.chars) }));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack.length = 0;
  },

  undo(this: TextBoard): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify({ conn: Object.fromEntries(this.conn), chars: Object.fromEntries(this.chars) }));
    const parsed = JSON.parse(prev) as { conn: Record<string, number>; chars: Record<string, string> };
    this.conn = new Map(Object.entries(parsed.conn));
    this.chars = new Map(Object.entries(parsed.chars));
    this.request();
    this.onChange?.();
  },

  redo(this: TextBoard): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify({ conn: Object.fromEntries(this.conn), chars: Object.fromEntries(this.chars) }));
    const parsed = JSON.parse(next) as { conn: Record<string, number>; chars: Record<string, string> };
    this.conn = new Map(Object.entries(parsed.conn));
    this.chars = new Map(Object.entries(parsed.chars));
    this.request();
    this.onChange?.();
  },

  canUndo(this: TextBoard): boolean {
    return this.undoStack.length > 0;
  },

  canRedo(this: TextBoard): boolean {
    return this.redoStack.length > 0;
  },

  clearAll(this: TextBoard): void {
    if (!this.conn.size && !this.chars.size) return;
    this.pushUndo();
    this.conn.clear();
    this.chars.clear();
    this.request();
    this.onChange?.();
  },
};
