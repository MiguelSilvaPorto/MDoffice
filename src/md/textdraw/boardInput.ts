// Entrada de texto, popover de tabela e conversão de/para texto.

import type { TextBoard } from "./board";
import { h, clamp, toast } from "../../util";
import { type TextDrawDoc, key } from "./model";
import { REVERSE } from "./glyphs";

export const boardInputMethods = {
  cellFromEvent(this: TextBoard, e: MouseEvent | PointerEvent): { r: number; c: number } {
    const p = this.pontoDe(e);
    return {
      r: clamp(Math.floor(p.y / this.m.cellH), 0, this.rows - 1),
      c: clamp(Math.floor(p.x / this.m.cellW), 0, this.cols - 1),
    };
  },

  openInput(this: TextBoard, cell: { r: number; c: number }, initial: string, title: string): void {
    const input = document.createElement("textarea");
    input.className = "draw-text-input";
    input.rows = 1;
    input.spellcheck = false;
    input.value = initial;
    input.title = `${title} — Enter quebra linha · Ctrl+Enter ou clicar fora conclui`;
    const cellWpx = this.canvas.clientWidth / this.cols;
    const cellHpx = this.canvas.clientHeight / this.rows;
    const fontPx = Math.max(12, Math.round(this.m.fontSize * (this.canvas.clientHeight / this.m.logicalH)));
    input.style.left = `${this.canvas.offsetLeft + cell.c * cellWpx}px`;
    input.style.top = `${this.canvas.offsetTop + cell.r * cellHpx}px`;
    input.style.fontSize = `${fontPx}px`;
    input.style.lineHeight = "1.15";

    const fit = () => {
      const lines = input.value.split("\n");
      const longest = Math.max(1, ...lines.map((l) => l.length));
      // largura com folga (a fonte real varia): melhor sobrar do que cortar o texto
      input.style.width = `${Math.min(460, Math.max(150, longest * fontPx * 0.72 + 16))}px`;
      // altura pelo tamanho da LETRA: a célula da grade é bem menor e cortava o texto
      input.style.height = `${Math.round(lines.length * fontPx * 1.3) + 8}px`;
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
        const linhas = value.split("\n");
        const caixa = this.findBox(cell.r, cell.c);
        if (caixa) {
          // digitou dentro de uma caixa: quebra o texto para caber nela
          const largura = Math.max(3, caixa.c2 - caixa.c1 - 1);
          const altura = Math.max(1, caixa.r2 - caixa.r1 - 1);
          let quebradas = this.wrapToWidth(linhas, largura);
          if (!quebradas.length) quebradas = [""];
          const cortou = quebradas.length > altura;
          if (cortou) quebradas = quebradas.slice(0, altura);
          quebradas.forEach((line, i) => this.addText(Math.min(cell.r + i, caixa.r2 - 1), caixa.c1 + 1, line));
          toast(cortou ? "Texto quebrado na caixa — não coube tudo (faça a caixa mais alta)." : "O texto foi quebrado para caber na caixa.", "info", cortou ? 4600 : 3000);
        } else {
          linhas.forEach((line, i) => this.addText(cell.r + i, cell.c, line));
        }
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
    // alguns navegadores ainda tentam dar foco ao canvas: garante o foco na caixinha
    requestAnimationFrame(() => {
      if (!done && input.isConnected && document.activeElement !== input) input.focus();
    });
  },

  openTablePopover(this: TextBoard, cell: { r: number; c: number }): void {
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
  },

  /** Texto final: linhas com os caracteres, sem espaços à direita e sem linhas vazias nas pontas. */
  toText(this: TextBoard): string {
    const lines: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      let line = "";
      for (let c = 0; c < this.cols; c++) line += this.cellChar(r, c);
      lines.push(line.replace(/\s+$/, ""));
    }
    while (lines.length && lines[0].trim() === "") lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    return lines.join("\n");
  },

  serialize(this: TextBoard): TextDrawDoc {
    return {
      version: 1,
      kind: "text",
      cols: this.cols,
      rows: this.rows,
      style: this.style,
      conn: Object.fromEntries(this.conn),
      chars: Object.fromEntries(this.chars),
    };
  },

  /** Recarrega o desenho a partir de um texto (usado quando o usuário edita no editor). */
  applyText(this: TextBoard, text: string): void {
    // enquanto um traço está em andamento, não recarrega (evita apagar o que está sendo desenhado)
    if (this.draftBase) return;
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
    // NÃO avisa o app aqui: esse texto veio do próprio editor e avisar de volta criava um
    // ciclo (prancheta → editor → pré-visualização → prancheta) que repintava tudo sem parar.
    this.request();
  },
};
