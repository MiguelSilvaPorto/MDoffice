// Renderiza o Markdown em HTML (com imagens e diagramas prontos), monta o documento final e imprime.

import { Preview } from "../md/preview";
import { type TranslatedDoc } from "../translate/controller";
import { escapeHtml, h } from "../util";
import { type Theme, type ExportPrefs, type ExportCtx } from "./types";
import { DARK_VARS, PAPER_CSS, EXTRA_CSS } from "./styles";

// ---------- renderização ----------

export const noopHooks = {
  onOpenLocalDoc: () => {},
  onSaveDrawing: async () => {},
  onRemoveDrawing: async () => {},
  onSaveTextBlock: () => false,
  onRemoveTextBlock: () => {},
  onEditMermaid: () => {},
  onToggleTask: () => {},
};

export class Renderer {
  private host: HTMLElement;
  private preview: Preview;

  constructor(docPath: string | null, dark: boolean) {
    this.host = h("div", { class: "markdown-body" });
    this.host.style.cssText = "position:fixed;left:-99999px;top:0;width:900px;visibility:hidden";
    document.body.append(this.host);
    this.preview = new Preview(this.host, noopHooks, { readOnly: true });
    this.preview.setDocPath(docPath);
    this.preview.setDark(dark);
  }

  async html(md: string): Promise<string> {
    await this.preview.renderAndWait(md);
    const clone = this.host.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".code-actions, .code-copy, .draw-edit-btn, .code-edit-text").forEach((b) => b.remove());
    return clone.innerHTML;
  }

  dispose(): void {
    this.host.remove();
  }
}

export function tocHtml(body: string): string {
  const doc = new DOMParser().parseFromString(`<div>${body}</div>`, "text/html");
  const items = Array.from(doc.querySelectorAll("h1,h2,h3")).filter((e) => e.id);
  if (items.length < 2) return "";
  const lis = items.map((e) => `<li class="l${e.tagName[1]}"><a href="#${e.id}">${escapeHtml(e.textContent || "")}</a></li>`).join("");
  return `<nav class="toc"><h2>Sumário</h2><ol style="list-style:none;padding-left:0">${lis}</ol></nav>`;
}

export function htmlDocument(opts: { title: string; lang: string; body: string; css: string; theme: Theme; size: string; print: boolean }): string {
  const themeCss = opts.theme === "dark" ? DARK_VARS : opts.theme === "paper" ? PAPER_CSS : "";
  const page = opts.print ? `@page{size:${opts.size};margin:16mm}@media print{.markdown-body{max-width:none;padding:0}.bi-row{break-inside:avoid}}` : "";
  return `<!doctype html>
<html lang="${opts.lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)}</title>
<style>
${opts.css}
${EXTRA_CSS}
${themeCss}
${page}
</style>
</head>
<body>
<article class="markdown-body">
${opts.body}
</article>
</body>
</html>`;
}

export async function buildBody(ctx: ExportCtx, prefs: ExportPrefs, md: string, doc: TranslatedDoc | null, toc: boolean): Promise<string> {
  const dark = prefs.format === "html" && prefs.theme === "dark";
  const r = new Renderer(ctx.docPath(), dark);
  try {
    if (prefs.lang === "both" && doc) {
      const rows: string[] = [];
      for (const b of ctx.translation.blocks(doc)) {
        const [pt, en] = [await r.html(b.pt), await r.html(b.en)];
        rows.push(`<div class="bi-row"><div class="bi-cell">${pt}</div><div class="bi-cell">${en}</div></div>`);
      }
      return `<div class="bi-head"><span>Português</span><span>English</span></div>${rows.join("\n")}`;
    }
    const body = await r.html(prefs.lang === "en" && doc ? doc.markdown : md);
    return toc ? tocHtml(body) + body : body;
  } finally {
    r.dispose();
  }
}

/** Imprime um HTML numa moldura escondida (o usuário escolhe "Salvar como PDF"). */
export async function printHtml(html: string): Promise<void> {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.append(frame);
  await new Promise<void>((ok) => {
    frame.onload = () => ok();
    frame.srcdoc = html;
  });
  const win = frame.contentWindow;
  if (!win) throw new Error("Não consegui preparar a impressão.");
  // espera as imagens carregarem para não sair página em branco
  await Promise.all(Array.from(win.document.images).map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => {}))));
  win.focus();
  win.print();
  window.setTimeout(() => frame.remove(), 120000);
}
