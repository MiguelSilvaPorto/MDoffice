// Desenhos e diagramas dentro do documento Markdown.

import type { App } from "./app";
import * as files from "../files";
import { placeholderDataUrl, type DrawDoc } from "../md/draw";
import { TEXT_DRAW_PLACEHOLDER } from "../md/textdraw";
import { openDiagramBuilder } from "../md/diagram";
import { $, h, toast, loadJSON, toBase64Utf8 } from "../util";

export const drawingMethods = {
  /** Já existe um quadro de desenho aberto dentro do documento? */
  drawingEditorOpen(this: App): boolean {
    return !!document.querySelector("#preview .draw-inline");
  },

  async openDraw(this: App): Promise<void> {
    if (this.semDocumento()) return;
    if (this.tab.kind === "word") {
      toast("O desenho ainda não está disponível em documentos (.docx).", "info", 3200);
      return;
    }
    if (this.drawingEditorOpen()) {
      toast("Finalize o desenho que já está aberto (Concluir ou Cancelar) antes de criar outro.", "info", 4200);
      return;
    }
    if (loadJSON<string>("mdc.drawstyle", "image") === "text") {
      this.newTextDrawing();
      return;
    }
    if (document.body.classList.contains("no-preview")) {
      this.toggle("no-preview");
      toast("Mostrei a pré-visualização: é nela que o quadro abre, dentro do documento.", "info", 3600);
    }
    const sel = this.editor.selectionPos();
    if (!(await this.ensureSaved())) return;
    try {
      const name = `desenho-${Date.now().toString(36)}.png`;
      const png = placeholderDataUrl(1600, 1000);
      const rel = await files.writeAsset(this.path!, name, png.split(",", 2)[1]);
      this.preview.seedAsset(rel, png); // o PNG recém-criado não precisa ser relido do disco
      const initial: DrawDoc = { version: 1, w: 1600, h: 1000, elements: [] };
      await files.updateAsset(this.path!, `${rel}.draw.json`, toBase64Utf8(JSON.stringify(initial)));
      this.editor.insertAt(sel.from, `![Desenho](${rel})\n`);
      await this.preview.render(this.editor.getText());
      if (!this.preview.openEditorForRel(rel, true)) {
        // Desfaz para não deixar uma linha solta no Markdown.
        this.removeDrawingReference(rel);
        await this.preview.render(this.editor.getText());
        toast("Não consegui abrir o quadro aqui — a linha foi desfeita. Tente de novo.", "err", 6000);
        return;
      }
      toast("Desenhe direto no documento; clique em Concluir para salvar.", "info", 4200);
    } catch (e) {
      toast("Não foi possível criar o desenho: " + e, "err");
    }
  },

  newTextDrawing(this: App): void {
    if (document.body.classList.contains("no-preview")) {
      this.toggle("no-preview");
      toast("Mostrei a pré-visualização: é nela que o desenho abre, dentro do documento.", "info", 3600);
    }
    const sel = this.editor.selectionPos();
    const block = `\n\`\`\`text\n${TEXT_DRAW_PLACEHOLDER}\n\`\`\`\n`;
    this.editor.insertAt(sel.from, block);
    void this.preview.render(this.editor.getText()).then(() => {
      if (!this.preview.openTextEditorForContent(TEXT_DRAW_PLACEHOLDER)) {
        this.removeTextBlock(TEXT_DRAW_PLACEHOLDER);
        toast("Não consegui abrir o quadro de letras aqui — o bloco foi desfeito. Tente de novo.", "err", 6000);
        return;
      }
      toast("Desenhe com o mouse: caixas, textos, campos [ ] e tabelas.", "info", 4200);
    });
  },

  /** Remove um bloco ```text que contenha o texto indicado (usado para desfazer/remover). */
  removeTextBlock(this: App, needle: string): boolean {
    const lines = this.editor.getText().split("\n");
    const offsetOf = (index: number) => lines.slice(0, index).reduce((n, l) => n + l.length + 1, 0);
    const target = needle.trim();
    let fallback: { from: number; to: number } | null = null;
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || !/^(text|txt)$/i.test(fence[3] || "")) {
        i++;
        continue;
      }
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const body = lines.slice(bodyStart, j).join("\n");
      const from = offsetOf(i);
      const to = Math.min(offsetOf(Math.min(j + 1, lines.length)), this.editor.getText().length);
      const trimmed = body.trim();
      if (trimmed === target || (target === "" && trimmed === "")) {
        this.editor.replaceRange(from, to, "");
        this.updatePreview();
        return true;
      }
      if (!fallback && target !== "" && trimmed.includes(target)) fallback = { from, to };
      i = j + 1;
    }
    if (fallback) {
      this.editor.replaceRange(fallback.from, fallback.to, "");
      this.updatePreview();
      return true;
    }
    return false;
  },

  /** Atualiza o bloco ```text correspondente ao desenho de letras editado. */
  replaceTextBlock(this: App, oldText: string, newText: string): boolean {
    const lines = this.editor.getText().split("\n");
    const needle = oldText.trim();
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || !/^(text|txt)$/i.test(fence[3] || "")) {
        i++;
        continue;
      }
      const bodyStartLine = i + 1;
      let j = bodyStartLine;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const body = lines.slice(bodyStartLine, j).join("\n");
      if (body.trim() === needle) {
        const bodyOffset = lines.slice(0, bodyStartLine).reduce((n, l) => n + l.length + 1, 0);
        this.editor.replaceRange(bodyOffset, bodyOffset + body.length, newText);
        this.updatePreview();
        return true;
      }
      i = j + 1;
    }
    return false;
  },

  /** Liga/desliga o campo selecionável (- [ ]) indicado na pré-visualização. */
  toggleTask(this: App, index: number): void {
    const text = this.editor.getText();
    const rx = /^([ \t]*(?:[-*+]|\d+\.)[ \t]+\[)([ xX])(\])/gm;
    let match: RegExpExecArray | null;
    let n = 0;
    while ((match = rx.exec(text)) !== null) {
      if (n === index) {
        const pos = match.index + match[1].length;
        this.editor.replaceRange(pos, pos + 1, match[2] === " " ? "x" : " ");
        this.statsSoon();
        return;
      }
      n++;
    }
  },

  removeDrawingReference(this: App, rel: string): void {
    const text = this.editor.getText();
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 1) linha inteira só com a imagem → remove a linha
    const wholeLine = new RegExp(`^[ \\t]*!\\[[^\\]]*\\]\\(${escaped}(?:\\s+"[^"]*")?\\)[ \\t]*\\r?\\n?`, "m");
    let next = text.replace(wholeLine, "");
    if (next === text) {
      // 2) imagem no meio de um texto → remove só a referência
      const inline = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}(?:\\s+"[^"]*")?\\)`, "g");
      next = text.replace(inline, "");
    }
    if (next !== text) this.editor.setText(next, false);
    this.updatePreview();
  },

  /** Abre o construtor de diagramas (campos simples + pré-visualização). */
  newDiagram(this: App): void {
    openDiagramBuilder({
      dark: document.documentElement.dataset.theme === "dark",
      onInsert: (code) => {
        this.editor.insert("\n```mermaid\n" + code + "\n```\n");
        this.updatePreview();
        toast("Diagrama inserido no documento.", "ok", 2600);
      },
    });
  },

  /** Reabre um diagrama existente no construtor (substituindo o bloco). */
  editDiagram(this: App, code: string): void {
    const range = this.findFencedBlock("mermaid", code);
    openDiagramBuilder({
      initialCode: code,
      dark: document.documentElement.dataset.theme === "dark",
      onInsert: (newCode) => {
        const block = "```mermaid\n" + newCode + "\n```\n";
        if (range) this.editor.replaceRange(range.from, range.to, block);
        else this.editor.insert("\n" + block + "\n");
        this.updatePreview();
        toast("Diagrama atualizado no documento.", "ok", 2600);
      },
    });
  },

  /** Localiza um bloco ```lang com esse conteúdo e devolve os deslocamentos no documento. */
  findFencedBlock(this: App, lang: string, body: string): { from: number; to: number } | null {
    const text = this.editor.getText();
    const lines = text.split("\n");
    const offsetOf = (index: number) => lines.slice(0, index).reduce((n, l) => n + l.length + 1, 0);
    const target = body.replace(/\s+$/, "").trim();
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || (fence[3] || "").toLowerCase() !== lang) {
        i++;
        continue;
      }
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const inner = lines.slice(bodyStart, j).join("\n");
      if (inner.trim() === target) {
        return { from: offsetOf(i), to: Math.min(offsetOf(Math.min(j + 1, lines.length)), text.length) };
      }
      i = j + 1;
    }
    return null;
  },
};
