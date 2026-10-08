// Pré-visualização: Markdown → HTML, com realce de código, links, imagens locais e Mermaid.
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { copyText, docDirOf, joinPath, escapeHtml, toast } from "./util";
import { createDrawEditor, type DrawDoc } from "./draw";
import { createTextDrawEditor, TextBoard, TEXT_DRAW_PLACEHOLDER, detectTraceStyle } from "./textdraw";
import { renderMermaidInto } from "./diagram";

marked.setOptions({ gfm: true, breaks: false });

// O marked marca o alinhamento das tabelas com style="text-align: …" (o DOMPurify
// removeria). Liberamos apenas esse caso, em células de tabela.
DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  if (data.attrName !== "style") return;
  const tag = (node as Element).nodeName?.toUpperCase() ?? "";
  if (tag !== "TD" && tag !== "TH") return;
  if (/^\s*text-align\s*:\s*(left|center|right)\s*;?\s*$/i.test(data.attrValue)) {
    data.forceKeepAttr = true;
  }
});

export interface PreviewHooks {
  onOpenLocalDoc: (absPath: string) => void;
  /** Salva o desenho editado (PNG + json do lado) — reaproveita o mesmo arquivo. */
  onSaveDrawing: (rel: string, pngBase64: string, json: string) => Promise<void>;
  /** Remove o desenho do documento (referência no texto + arquivos). */
  onRemoveDrawing: (rel: string) => Promise<void>;
  /** Substitui um bloco de letras (```text) pelo desenho novo. Devolve false se não achou. */
  onSaveTextBlock: (oldText: string, newText: string) => boolean;
  /** Apaga o desenho de letras do documento (o bloco ```text inteiro). */
  onRemoveTextBlock: (oldText: string) => void;
  /** Liga/desliga um campo selecionável (- [ ]) na posição indicada. */
  onToggleTask: (index: number) => void;
  /** Abre o diagrama Mermaid no construtor (botão "Editar diagrama"). */
  onEditMermaid: (code: string) => void;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Índice do bloco ```text que contém o texto indicado (ou -1). */
function textBlockIndex(markdown: string, needle: string): number {
  const lines = markdown.split("\n");
  const target = needle.trim();
  let index = -1;
  let count = 0;
  let i = 0;
  while (i < lines.length) {
    const fence = /^[ \t]*(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
    if (!fence || !/^(text|txt)$/i.test(fence[2] || "")) {
      i++;
      continue;
    }
    const bodyStart = i + 1;
    let j = bodyStart;
    while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
    const body = lines.slice(bodyStart, j).join("\n");
    if (index < 0 && body.trim() === target) index = count;
    count++;
    i = j + 1;
  }
  return index;
}

/** Conteúdo do n-ésimo bloco ```text do documento (ou null se não existir). */
function textBlockAt(markdown: string, index: number): string | null {
  const lines = markdown.split("\n");
  let count = 0;
  let i = 0;
  while (i < lines.length) {
    const fence = /^[ \t]*(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
    if (!fence || !/^(text|txt)$/i.test(fence[2] || "")) {
      i++;
      continue;
    }
    const bodyStart = i + 1;
    let j = bodyStart;
    while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
    if (count === index) return lines.slice(bodyStart, j).join("\n");
    count++;
    i = j + 1;
  }
  return null;
}

export function welcomeHtml(): string {
  return `
  <div class="welcome">
    <div class="welcome-logo">M↓</div>
    <h1>Bem-vindo ao mdCreator</h1>
    <p>Escreva Markdown à esquerda; o resultado aparece formatado ao lado.</p>
    <ul>
      <li><b>Escrever</b> — a barra acima tem o essencial (negrito, listas, tabela, link e o <b>Modelo IA</b>). O botão <b>⋯</b> mostra o resto.</li>
      <li><b>Desenhar</b> — clique em <b>Desenhar</b> e desenhe no próprio documento. O assistente endireita traços, regulariza ondulações e liga as formas. O <b>▾</b> ao lado alterna entre <i>imagem</i> e <i>letras e símbolos</i>.</li>
      <li><b>Imagem</b> — pelo botão <b>Imagem</b>, colando com <kbd>Ctrl</kbd>+<kbd>V</kbd> ou arrastando o arquivo. Tudo vai para <code>assets/</code> ao lado do <code>.md</code>.</li>
      <li><b>Mandar para a IA</b> — no menu <b>⋯</b>: <b>Copiar para a IA</b> (texto) ou <b>Pacote IA</b> (um ZIP com o documento, as imagens e um modelo de instruções).</li>
      <li><b>Português corrigido</b> — <kbd>F7</kbd> (ou <b>⋯ → Revisar texto</b>) mostra ortografia e estilo. Com a <b>Correção automática</b> ligada (padrão no menu <b>⋯</b>), o app troca sozinho as palavras erradas em que tem certeza (ex.: <i>responsavo</i> → <b>responsável</b>) e, ao terminar o parágrafo ou salvar, ajusta ponto final, vírgulas, maiúsculas e trocas formais.</li>
    </ul>
    <p class="hint"><kbd>F1</kbd> abre esta tela · <kbd>Ctrl</kbd>+<kbd>S</kbd> salva · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> desenha · botão direito no editor: pastas de contexto</p>
  </div>`;
}

export class Preview {
  readonly el: HTMLElement;
  private docPath: string | null = null;
  private dark = false;
  private token = 0;
  private cache = new Map<string, string>();
  private drawIndex = new Map<string, string>();
  private suspended = 0;
  private pendingText: string | null = null;
  private textSync: ((markdown: string) => void) | null = null;
  private lastMarkdown = "";
  private hooks: PreviewHooks;
  /** Somente leitura (ex.: pré-visualização em inglês): sem botões de edição nem tarefas clicáveis. */
  private readOnly: boolean;

  constructor(el: HTMLElement, hooks: PreviewHooks, opts: { readOnly?: boolean } = {}) {
    this.el = el;
    this.hooks = hooks;
    this.readOnly = !!opts.readOnly;
    this.el.addEventListener("click", this.onClick);
  }

  setDocPath(p: string | null): void {
    if (p !== this.docPath) {
      this.docPath = p;
      this.cache.clear();
      this.drawIndex.clear();
    }
  }

  setDark(dark: boolean): void {
    this.dark = dark;
  }

  invalidateAsset(rel: string): void {
    this.cache.delete(this.resolveAbs(rel));
  }

  /** Suspende a renderização (usado enquanto um desenho está sendo editado no lugar). */
  suspend(): void {
    this.suspended++;
  }

  resume(): void {
    this.suspended = Math.max(0, this.suspended - 1);
    if (this.suspended === 0 && this.pendingText !== null) {
      const text = this.pendingText;
      this.pendingText = null;
      void this.render(text);
    }
  }

  async render(md: string): Promise<void> {
    this.lastMarkdown = md;
    if (this.suspended > 0) {
      this.pendingText = md;
      return;
    }
    const myToken = ++this.token;
    if (!md.trim()) {
      this.el.innerHTML = this.readOnly ? "" : welcomeHtml();
      return;
    }
    const html = await marked.parse(md, { gfm: true, async: true });
    if (myToken !== this.token) return;
    this.el.innerHTML = DOMPurify.sanitize(String(html), { ADD_ATTR: ["target", "rel"] });
    this.postProcess();
    void this.resolveImages(myToken);
    void this.renderMermaid(myToken);
  }

  /** Renderiza e ESPERA as imagens e os diagramas ficarem prontos (usado pela exportação). */
  async renderAndWait(md: string): Promise<void> {
    this.lastMarkdown = md;
    const myToken = ++this.token;
    if (!md.trim()) {
      this.el.innerHTML = "";
      return;
    }
    const html = await marked.parse(md, { gfm: true, async: true });
    this.el.innerHTML = DOMPurify.sanitize(String(html), { ADD_ATTR: ["target", "rel"] });
    this.postProcess();
    await this.resolveImages(myToken);
    await this.renderMermaid(myToken);
  }

  /** Abre o editor de desenho embutido na imagem indicada (usado após criar um desenho). */
  openEditorForRel(rel: string, removeOnCancel = false): boolean {
    const imgs = Array.from(this.el.querySelectorAll<HTMLImageElement>("img.draw-img"));
    const img = imgs.find((i) => i.dataset.rel === rel);
    if (!img) return false;
    this.openInlineEditor(img, removeOnCancel);
    return true;
  }

  /** Abre o editor de desenho em letras no bloco ```text indicado. */
  openTextEditorForContent(needle: string): boolean {
    const codes = Array.from(this.el.querySelectorAll<HTMLElement>(".code-wrap code"));
    const code = codes.find((c) => this.isTextBlock(c) && (c.textContent || "").includes(needle));
    if (!code) return false;
    this.openTextEditor(code);
    return true;
  }

  private isTextBlock(code: HTMLElement): boolean {
    return /language-(text|txt)\b/i.test(code.className || "") || (code.dataset.lang || "").toLowerCase() === "text";
  }

  private openTextEditor(code: HTMLElement): void {
    if (this.el.querySelector(".text-draw")) return;
    const wrap = code.closest<HTMLElement>(".code-wrap");
    if (!wrap) return;
    const oldText = (code.textContent || "").replace(/\s+$/, "");
    let doc = null as ReturnType<typeof TextBoard.fromText> | null;
    if (oldText.trim() && !oldText.includes(TEXT_DRAW_PLACEHOLDER)) {
      try {
        doc = TextBoard.fromText(oldText, detectTraceStyle(oldText));
      } catch {
        doc = null;
      }
    }
    this.suspend();
    let currentText = oldText;
    const editor = createTextDrawEditor({
      doc,
      onLiveChange: (text) => {
        // enquanto desenha, o bloco ```text vai sendo atualizado no editor
        if (text === currentText) return;
        if (this.hooks.onSaveTextBlock(currentText, text)) currentText = text;
      },
      onDone: async (result) => {
        try {
          if (result.kind === "save") {
            const ok = this.hooks.onSaveTextBlock(currentText, result.text);
            if (!ok) toast("Não encontrei o bloco de letras no documento para atualizar.", "err");
          } else if (result.kind === "remove") {
            this.hooks.onRemoveTextBlock(currentText);
            toast("Desenho removido do documento.", "info", 2400);
          } else if (currentText !== oldText) {
            // cancelou depois de mexer: devolve o conteúdo original
            this.hooks.onSaveTextBlock(currentText, oldText);
          }
        } finally {
          this.textSync = null;
          const next = this.pendingText ?? this.lastMarkdown;
          this.pendingText = null;
          this.resume();
          void this.render(next);
        }
      },
    });
    wrap.replaceWith(editor.el);
    editor.el.scrollIntoView({ block: "center", behavior: "smooth" });
    editor.focus();

    // via de volta: se você editar o bloco no editor, o quadro recarrega o desenho
    const blockIndex = textBlockIndex(this.lastMarkdown, oldText);
    if (blockIndex >= 0) {
      this.textSync = (md: string) => {
        const body = textBlockAt(md, blockIndex);
        if (body === null) {
          this.textSync = null;
          editor.el.remove();
          toast("O bloco de letras foi removido do documento — quadro fechado.", "info", 3200);
          this.pendingText = null;
          this.resume();
          void this.render(md);
          return;
        }
        const trimmed = body.replace(/\s+$/, "");
        // compara ignorando espaços no fim das linhas: enquanto você desenha o bloco é
        // regravado pelo próprio quadro e não pode recarregá-lo (senão a vista pula)
        const semFim = (t: string) => t.replace(/[ \t]+$/gm, "").replace(/\s+$/, "");
        if (trimmed === currentText || semFim(trimmed) === semFim(currentText)) return;
        currentText = trimmed;
        editor.applyText(trimmed);
      };
    }
  }

  /** Mantém o desenho de letras aberto em sincronia quando o documento muda. */
  syncTextEditorWith(markdown: string): void {
    this.textSync?.(markdown);
  }

  private async openInlineEditor(img: HTMLImageElement, removeOnCancel = false): Promise<void> {
    if (this.el.querySelector(".draw-inline")) return;
    const rel = img.dataset.rel;
    if (!rel) {
      toast("Não consegui localizar o arquivo deste desenho.", "err");
      return;
    }
    const frame = img.closest<HTMLElement>(".draw-image-frame") ?? img;
    let doc: DrawDoc = { version: 1, w: 1600, h: 1000, elements: [] };
    try {
      const sidecar = await invoke<string>("load_text", { path: `${this.resolveAbs(rel)}.draw.json` });
      const parsed = JSON.parse(sidecar) as DrawDoc;
      if (parsed && Array.isArray(parsed.elements)) doc = parsed;
    } catch {
      // Imagens antigas sem sidecar ainda podem ser redesenhadas do zero.
    }

    this.suspend();
    const editor = createDrawEditor({
      doc,
      onDone: async (result) => {
        if (result.kind === "cancel") {
          try {
            if (removeOnCancel) await this.hooks.onRemoveDrawing(rel);
          } finally {
            const next = this.pendingText ?? this.lastMarkdown;
            this.pendingText = null;
            this.resume();
            void this.render(next);
          }
          return;
        }
        if (result.kind === "remove") {
          try {
            await this.hooks.onRemoveDrawing(rel);
          } finally {
            const next = this.pendingText ?? this.lastMarkdown;
            this.pendingText = null;
            this.resume();
            void this.render(next);
          }
          return;
        }
        try {
          await this.hooks.onSaveDrawing(rel, result.pngBase64, result.json);
        } finally {
          const next = this.pendingText ?? this.lastMarkdown;
          this.pendingText = null;
          this.resume();
          void this.render(next);
        }
      },
    });
    frame.replaceWith(editor.el);
    editor.el.scrollIntoView({ block: "center", behavior: "smooth" });
    editor.focus();
  }

  // ---------- pós-processamento ----------

  private postProcess(): void {
    let n = 0;
    this.el.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((hd) => {
      hd.id = `sec-${n++}-${slugify(hd.textContent || "") || "secao"}`;
    });

    // campos selecionáveis: as caixas de tarefa ficam clicáveis e refletem no Markdown
    this.el.querySelectorAll<HTMLInputElement>('li > input[type="checkbox"]').forEach((cb) => {
      if (!this.readOnly) {
        cb.disabled = false;
        cb.removeAttribute("disabled");
      }
      cb.parentElement?.classList.add("task-list-item");
    });

    // Desenhos nativos do mdCreator têm um editor acessível no próprio preview.
    this.el.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const alt = img.getAttribute("alt") || "";
      if (!/\/assets\/desenho-[^/]+\.(?:png|svg)$/i.test(`/${src.replace(/^\.?\//, "")}`) && !/^desenho(?::|$)/i.test(alt)) return;
      img.classList.add("draw-img");
      img.dataset.rel = src;
      if (this.readOnly || img.closest(".draw-image-frame")) return;
      const frame = document.createElement("figure");
      frame.className = "draw-image-frame";
      img.replaceWith(frame);
      frame.append(img);
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "draw-edit-btn";
      edit.innerHTML = '<svg class="ic"><use href="#i-draw"/></svg><span>Editar desenho</span>';
      frame.append(edit);
    });

    this.el.querySelectorAll<HTMLElement>("pre > code").forEach((code) => {
      const cls = code.className || "";
      const pre = code.parentElement as HTMLElement | null;
      if (!pre) return;

      if (/language-mermaid/.test(cls)) {
        pre.classList.add("mermaid-block");
        return;
      }

      const langMatch = /language-([\w+-]+)/.exec(cls);
      if (langMatch && !/^(text|plain|plaintext|none)$/i.test(langMatch[1])) {
        try {
          hljs.highlightElement(code);
        } catch {
          /* ignora linguagens desconhecidas */
        }
      }

      if (!pre.parentElement?.classList.contains("code-wrap")) {
        const wrap = document.createElement("div");
        wrap.className = "code-wrap";
        pre.replaceWith(wrap);
        wrap.append(pre);

        if (langMatch) {
          wrap.classList.add("has-lang");
          const tag = document.createElement("span");
          tag.className = "code-lang";
          tag.textContent = langMatch[1];
          wrap.append(tag);
          code.dataset.lang = langMatch[1];
        }

        const actions = document.createElement("div");
        actions.className = "code-actions";
        if (this.isTextBlock(code) && !this.readOnly) {
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "code-edit-text";
          edit.innerHTML = '<svg class="ic"><use href="#i-draw"/></svg><span>Editar letras</span>';
          edit.title = "Abrir o desenho de letras aqui mesmo, dentro do documento";
          actions.append(edit);
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "code-copy";
        btn.textContent = "Copiar";
        actions.append(btn);
        wrap.append(actions);
      }
    });

    this.el.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
  }

  private onClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const copyBtn = target.closest<HTMLElement>(".code-copy");
    if (copyBtn) {
      const code = copyBtn.closest(".code-wrap")?.querySelector("code");
      if (code) {
        void copyText(code.textContent || "").then((ok) => {
          if (!ok) return;
          copyBtn.textContent = "Copiado!";
          window.setTimeout(() => (copyBtn.textContent = "Copiar"), 1400);
        });
      }
      return;
    }

    const drawBtn = target.closest<HTMLElement>(".draw-edit-btn");
    if (drawBtn) {
      const img = drawBtn.closest(".draw-image-frame")?.querySelector<HTMLImageElement>("img.draw-img");
      if (img) void this.openInlineEditor(img);
      return;
    }

    const textBtn = target.closest<HTMLElement>(".code-edit-text");
    if (textBtn) {
      const code = textBtn.closest(".code-wrap")?.querySelector<HTMLElement>("code");
      if (code) this.openTextEditor(code);
      return;
    }

    const checkbox = target.closest<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox && this.readOnly) return;
    if (checkbox && checkbox.closest("li.task-list-item")) {
      const all = Array.from(this.el.querySelectorAll<HTMLInputElement>('li.task-list-item input[type="checkbox"]'));
      const index = all.indexOf(checkbox);
      if (index >= 0) this.hooks.onToggleTask(index);
      return;
    }

    const a = target.closest<HTMLAnchorElement>("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    e.preventDefault();

    if (/^https?:/i.test(href)) {
      void openUrl(href).catch(() => {});
      return;
    }
    if (href.startsWith("#")) {
      const id = decodeURIComponent(href.slice(1));
      this.el.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (/\.(md|markdown|txt)$/i.test(href) && !this.readOnly) {
      this.hooks.onOpenLocalDoc(this.resolveAbs(href));
    }
  };

  private resolveAbs(rel: string): string {
    let p = rel;
    try {
      p = decodeURIComponent(rel);
    } catch {
      /* mantém o original */
    }
    if (/^[a-zA-Z]:[\\/]/.test(p)) return p;
    const dir = this.docPath ? docDirOf(this.docPath) : "";
    return dir ? joinPath(dir, p) : p;
  }

  private async resolveImages(myToken: number): Promise<void> {
    const imgs = Array.from(this.el.querySelectorAll<HTMLImageElement>("img"));
    for (const img of imgs) {
      const src = img.getAttribute("src") || "";
      if (!src || /^(data:|https?:|blob:|asset:)/i.test(src)) continue;
      if (!this.docPath) {
        img.classList.add("img-missing");
        continue;
      }
      const abs = this.resolveAbs(src);
      let data = this.cache.get(abs);
      if (!data) {
        try {
          data = await invoke<string>("read_file_data_url", { path: abs });
          this.cache.set(abs, data);
        } catch {
          img.classList.add("img-missing");
          img.title = "Imagem não encontrada: " + abs;
          continue;
        }
      }
      if (myToken !== this.token) return;
      img.src = data;
      img.classList.remove("img-missing");
    }
  }

  private async renderMermaid(myToken: number): Promise<void> {
    const blocks = Array.from(this.el.querySelectorAll<HTMLElement>("pre.mermaid-block > code.language-mermaid"));
    if (!blocks.length) return;
    for (const code of blocks) {
      if (myToken !== this.token) return;
      const source = code.textContent || "";
      const host = document.createElement("div");
      host.className = "mermaid-host";
      const err = await renderMermaidInto(host, source, this.dark);
      if (myToken !== this.token) return;
      const pre = code.closest("pre");
      if (err === null && this.readOnly) {
        (pre ?? code).replaceWith(host);
      } else if (err === null) {
        // botão para reabrir o diagrama no construtor
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "draw-edit-btn";
        edit.title = "Abrir este diagrama no construtor";
        edit.innerHTML = '<svg class="ic"><use href="#i-flow"/></svg><span>Editar diagrama</span>';
        edit.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hooks.onEditMermaid(source.trim());
        });
        host.append(edit);
        (pre ?? code).replaceWith(host);
      } else if (pre) {
        pre.classList.add("mermaid-error");
      }
    }
  }
}

/** Gera o HTML final (para exportar), reaproveitando a pré-visualização já renderizada. */
export function getExportHtml(previewEl: HTMLElement, title: string, css: string): string {
  const clone = previewEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".code-actions, .code-copy, .draw-edit-btn").forEach((b) => b.remove());
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${css}
</style>
</head>
<body>
<article class="markdown-body">
${clone.innerHTML}
</article>
</body>
</html>`;
}
