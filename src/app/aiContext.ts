// Contexto para IA (pastas), copiar para IA e exportar.

import type { App } from "./app";
import * as files from "../files";
import { tabLabel } from "../tabs";
import { openExportDialog, type ExportFormat } from "../export";
import { snapshot } from "../history";
import { exportDocx } from "../word/docxExport";
import { toMarkdown, fromMarkdown } from "../word/markdown";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import mdCss from "../md/markdown.css?raw";
import { $, h, toast, baseName, stripExt, copyText, saveJSON, slugify } from "../util";

export const aiContextMethods = {
  async chooseFolders(this: App, cursor?: number): Promise<void> {
    try {
      const paths = await files.pickFolders();
      if (!paths.length) return;
      await this.showFolderContext(paths, "", cursor);
    } catch (e) {
      toast("Não foi possível abrir o seletor de pastas: " + e, "err");
    }
  },

  async showFolderContext(this: App, paths: string[], initialPrompt = "", cursor?: number): Promise<void> {
    try {
      const snapshots = await files.inspectFolders(paths);
      const backdrop = h("div", { class: "modal-backdrop" });
      const modal = h("div", { class: "modal folder-modal" });
      modal.innerHTML = `
        <header class="wm-head">
          <svg class="ic"><use href="#i-folder"/></svg>
          <h2>Pastas de contexto para IA</h2>
          <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
        </header>
        <div class="folder-modal-body">
          <p class="folder-note">Confira a estrutura selecionada e diga o que você quer pedir à IA. O mdOffice inclui caminhos e nomes no Markdown; não lê o conteúdo dos arquivos.</p>
          <div class="folder-snapshots"></div>
          <label class="folder-prompt-label" for="folder-prompt">O que você quer falar/pedir quando selecionar estas pastas?</label>
          <textarea id="folder-prompt" placeholder="Ex.: Analise a organização deste projeto e sugira onde implementar autenticação…"></textarea>
        </div>
        <footer class="wm-foot">
          <span class="muted">A estrutura será inserida no ponto atual do cursor.</span>
          <span class="dr-spacer"></span>
          <button class="btn" data-cancel>Cancelar</button>
          <button class="btn primary" data-insert>Inserir no Markdown</button>
        </footer>`;
      backdrop.append(modal);
      document.body.append(backdrop);

      const treeHost = modal.querySelector<HTMLElement>(".folder-snapshots")!;
      for (const snap of snapshots) {
        const card = h("section", { class: "folder-snapshot" });
        const title = h("div", { class: "folder-snapshot-title" });
        title.append(
          h("span", { class: "folder-emoji", text: "📁" }),
          h("strong", { text: snap.root })
        );
        const pre = h("pre", { class: "folder-tree", text: this.folderTreeText(snap) });
        card.append(title, pre);
        if (snap.truncated) card.append(h("div", { class: "folder-truncated", text: "Estrutura limitada: a pasta tem muitos itens ou níveis." }));
        treeHost.append(card);
      }

      const textarea = modal.querySelector<HTMLTextAreaElement>("#folder-prompt")!;
      textarea.value = initialPrompt;
      const close = () => {
        document.removeEventListener("keydown", onKey, true);
        backdrop.remove();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          modal.querySelector<HTMLButtonElement>("[data-insert]")!.click();
        }
      };
      document.addEventListener("keydown", onKey, true);
      backdrop.addEventListener("mousedown", (e) => {
        if (e.target === backdrop) close();
      });
      modal.querySelectorAll<HTMLElement>("[data-close], [data-cancel]").forEach((b) => b.addEventListener("click", close));
      modal.querySelector<HTMLButtonElement>("[data-insert]")!.addEventListener("click", () => {
        const prompt = textarea.value.trim();
        if (!prompt) {
          textarea.focus();
          toast("Escreva o que você quer pedir para a IA sobre estas pastas.", "info");
          return;
        }
        const snippet = this.folderMarkdown(snapshots, prompt);
        if (cursor === undefined) this.editor.insert(snippet);
        else this.editor.insertAt(cursor, snippet);
        this.linkFolders(paths);
        close();
        toast("Estrutura e instrução inseridas no Markdown.", "ok");
      });
      textarea.focus();
    } catch (e) {
      toast("Não foi possível ler a estrutura das pastas: " + e, "err");
    }
  },

  folderTreeText(this: App, snapshot: files.FolderSnapshot): string {
    if (!snapshot.entries.length) return "(pasta vazia ou sem itens acessíveis)";
    return snapshot.entries.map((entry) => {
      const depth = entry.relative.split("/").length - 1;
      const indent = "  ".repeat(depth);
      return `${indent}├── ${entry.name}${entry.directory ? "/" : ""}`;
    }).join("\n");
  },

  folderMarkdown(this: App, snapshots: files.FolderSnapshot[], prompt: string): string {
    const chunks = ["", "## Contexto de pastas para a IA", "", `**O que preciso:** ${prompt.replace(/\r?\n/g, "\n> ")}`, "", "> Abaixo estão os caminhos e nomes encontrados. Os arquivos não foram lidos; use estes diretórios como referência no projeto/contexto fornecido.", ""];
    for (const snap of snapshots) {
      chunks.push(`### Pasta: \`${snap.root.replace(/`/g, "'")}\``, "", "````text", this.folderTreeText(snap), "````", "");
    }
    return chunks.join("\n");
  },

  linkFolders(this: App, paths: string[]): void {
    const map = new Map(this.linkedFolders.map((f) => [f.path.toLowerCase(), f]));
    for (const path of paths) {
      const name = path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
      map.set(path.toLowerCase(), { path, name });
    }
    this.linkedFolders = Array.from(map.values()).slice(-20);
    saveJSON("mdc.linked-folders", this.linkedFolders);
    this.renderLinkedFolders();
  },

  renderLinkedFolders(this: App): void {
    const host = document.getElementById("linked-folders-list");
    if (!host) return; // agora as pastas ficam no menu "⋯"
    host.innerHTML = "";
    if (!this.linkedFolders.length) {
      host.append(h("div", { class: "side-empty", text: "Nenhuma pasta vinculada" }));
      return;
    }
    for (const folder of this.linkedFolders) {
      const row = h("div", { class: "recent linked-folder" });
      const open = h("button", { class: "recent-btn", title: folder.path });
      open.append(h("span", { class: "recent-name", text: folder.name }), h("span", { class: "recent-dir", text: folder.path }));
      open.addEventListener("click", () => void this.showFolderContext([folder.path]));
      const remove = h("button", { class: "recent-x", text: "×", title: "Desvincular pasta" });
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        this.linkedFolders = this.linkedFolders.filter((x) => x.path !== folder.path);
        saveJSON("mdc.linked-folders", this.linkedFolders);
        this.renderLinkedFolders();
      });
      row.append(open, remove);
      host.append(row);
    }
  },

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
      const cursor = sel.from;
      document.querySelector(".editor-context-menu")?.remove();
      const menu = h("div", { class: "editor-context-menu" });
      // com texto selecionado, o Copiar vem primeiro: é o que a pessoa quer com a seleção na mão
      if (sel.to > sel.from) {
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
      }
      const folderButton = h("button", { class: "context-menu-item" });
      folderButton.innerHTML = '<svg class="ic"><use href="#i-folder"/></svg><span>Pasta</span><kbd>contexto</kbd>';
      folderButton.addEventListener("click", () => {
        menu.remove();
        void this.chooseFolders(cursor);
      });
      menu.append(folderButton);
      for (const folder of this.linkedFolders.slice(-3).reverse()) {
        const quick = h("button", { class: "context-menu-item", title: folder.path });
        quick.innerHTML = '<svg class="ic"><use href="#i-folder"/></svg>';
        quick.append(h("span", { text: folder.name }));
        quick.addEventListener("click", () => {
          menu.remove();
          void this.showFolderContext([folder.path]);
        });
        menu.append(quick);
      }
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
