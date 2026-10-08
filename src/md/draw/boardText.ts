// Caixa de texto sobre o quadro e a borracha.

import type { Board } from "./board";
import { uid } from "../../util";
import { type Pt, type TextEl } from "./model";

export const boardTextMethods = {
  openTextInput(this: Board, x: number, y: number, existing: TextEl | null): void {
    const input = document.createElement("textarea");
    input.className = "draw-text-input";
    input.rows = 1;
    input.spellcheck = false;
    input.value = existing?.text ?? "";
    input.title = "Enter quebra linha · Ctrl+Enter ou clicar fora conclui · Esc cancela";
    const fontSize = existing?.fontSize ?? Math.max(16, Math.round(this.width * 6));
    const scaleX = this.canvas.clientWidth / this.W;
    const scaleY = this.canvas.clientHeight / this.H;
    input.style.left = `${this.canvas.offsetLeft + x * scaleX}px`;
    input.style.top = `${this.canvas.offsetTop + y * scaleY}px`;
    input.style.fontSize = `${fontSize * scaleY}px`;
    input.style.color = existing?.color ?? this.color;

    const fit = () => {
      const lines = input.value.split("\n");
      const longest = Math.max(1, ...lines.map((l) => l.length));
      input.style.width = `${Math.max(150, longest * fontSize * scaleX * 0.62 + 26)}px`;
      input.style.height = "auto";
      input.style.height = `${Math.max(1, lines.length) * fontSize * scaleY * 1.3 + 8}px`;
    };
    input.addEventListener("input", fit);
    fit();

    let done = false;
    const commit = (keep: boolean) => {
      if (done) return;
      done = true;
      const value = keep ? input.value.trim() : existing?.text ?? "";
      input.remove();
      if (keep && value) {
        this.pushUndo();
        if (existing) {
          existing.text = value;
        } else {
          this.els.push({
            id: uid(),
            type: "text",
            pos: { x, y },
            text: value,
            color: this.color,
            width: this.width,
            fontSize,
          });
        }
        this.setTool("select");
      }
      this.request();
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
        commit(existing !== null);
      }
    });

    this.host.append(input);
    input.focus();
    input.select();
  },

  eraseAt(this: Board, p: Pt): void {
    const hit = this.hitTest(p);
    if (!hit) return;
    if (!this.eraserStarted) {
      this.pushUndo();
      this.eraserStarted = true;
    }
    this.els = this.els.filter((el) => el.id !== hit.id);
    this.request();
    this.onChange?.();
  },
};
