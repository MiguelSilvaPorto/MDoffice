// Copiar para IA e exportar.

import type { App } from "./app";
import { tabLabel } from "../tabs";
import { openExportDialog, type ExportFormat } from "../export";
import { exportDocx } from "../word/docxExport";
import { toMarkdown, fromMarkdown } from "../word/markdown";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import mdCss from "../md/markdown.css?raw";
import { $, h, toast, baseName, stripExt, copyText, slugify } from "../util";

export const aiContextMethods = {
  setupEditorInteractions(this: App): void {
    const editorHost = $("#editor");
    editorHost.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".cm-content") || target.closest(".cm-gutters")) return;
      this.editor.focusAt(e.clientX, e.clientY);
    });
    editorHost.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const sel = this.editor.selectionPos();
      // sem seleção não há o que oferecer (o menu só tem o Copiar)
      if (sel.to <= sel.from) return;
      document.querySelector(".editor-context-menu")?.remove();
      const menu = h("div", { class: "editor-context-menu" });
      const copyButton = h("button", { class: "context-menu-item" });
      copyButton.innerHTML = '<svg class="ic"><use href="#i-copy"/></svg><span>Copiar</span><kbd>Ctrl+C</kbd>';
      copyButton.addEventListener("click", () => {
        menu.remove();
        const trecho = this.editor.view.state.sliceDoc(sel.from, sel.to);
        void copyText(trecho).then((ok) => {
          if (!ok) toast("Não foi possível copiar.", "err", 3000);
        });
      });
      menu.append(copyButton);
      document.body.append(menu);
      const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
      menu.style.left = `${Math.max(8, x)}px`;
      menu.style.top = `${Math.max(8, y)}px`;
      const dismiss = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) {
          menu.remove();
          document.removeEventListener("mousedown", dismiss, true);
        }
      };
      document.addEventListener("mousedown", dismiss, true);
    });
  },

  async copyForAI(this: App): Promise<void> {
    if (this.semDocumento()) return;
    const text = this.editor.getText();
    if (!text.trim()) {
      toast("Nada para copiar ainda.", "info");
      return;
    }
    const ok = await copyText(text);
    const hasImages = /!\[[^\]]*\]\(([^)]*assets\/|[^)]*\.(png|jpe?g|gif|webp|svg))/i.test(text);
    if (!ok) {
      toast("Não foi possível copiar.", "err");
      return;
    }
    toast(
      hasImages
        ? "Markdown copiado. Para enviar as imagens junto, use Pacote IA e anexe o ZIP."
        : "Markdown copiado para a área de transferência.",
      "ok",
      hasImages ? 6500 : 3200
    );
  },

  /** Abre a tela de exportação (HTML, PDF, Word, Markdown, texto, pacote para IA ou cópia). */
  openExport(this: App, format?: ExportFormat): void {
    if (this.semDocumento()) return;
    if (document.querySelector(".export-modal")) return;
    openExportDialog(
      {
        getMarkdown: () => (this.tab.kind === "word" ? toMarkdown(this.wordHost.doc()) : this.editor.getText()),
        docPath: () => this.path,
        nativeDocx: this.tab.kind === "word" ? () => exportDocx(this.wordHost.doc(), this.wordHost.setup(), tabLabel(this.tab)) : undefined,
        docxFromMarkdown:
          this.tab.kind === "word" ? (md: string) => exportDocx(fromMarkdown(md), this.wordHost.setup(), tabLabel(this.tab)) : undefined,
        printNative: this.tab.kind === "word" ? () => this.wordHost.print() : undefined,
        docName: () => (this.path ? stripExt(baseName(this.path)) : slugify(this.docTitleForFileName()) || "documento"),
        isDark: () => document.documentElement.dataset.theme === "dark",
        translation: this.translation,
        mdCss,
        ensureFile: async () => {
          if (!this.path) return await this.save(true);
          if (this.dirty) return await this.save(false);
          return true;
        },
        reveal: (p) => void revealItemInDir(p).catch(() => {}),
      },
      format
    );
  },
};
