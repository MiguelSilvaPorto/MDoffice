// Exportar: escolha o formato (página web, PDF, Word, Markdown, texto, pacote para IA ou cópia
// formatada) e o idioma (português, inglês ou os dois), tudo numa tela só.
import { marked, type Token, type Tokens } from "marked";
import { ask } from "@tauri-apps/plugin-dialog";
import * as files from "./files";
import { Preview } from "./preview";
import type { Translation, TranslatedDoc } from "./translation";
import { buildDocx } from "./docx";
import { bytesToBase64, docDirOf, escapeHtml, h, joinPath, loadJSON, saveJSON, toast } from "./util";

export type ExportFormat = "html" | "pdf" | "docx" | "md" | "txt" | "zip" | "copy";
type Lang = "pt" | "en" | "both";
type Theme = "light" | "dark" | "paper";

interface ExportPrefs {
  format: ExportFormat;
  lang: Lang;
  theme: Theme;
  size: "A4" | "Letter";
  toc: boolean;
}

export interface ExportCtx {
  getMarkdown: () => string;
  docPath: () => string | null;
  docName: () => string;
  isDark: () => boolean;
  translation: Translation;
  mdCss: string;
  /** Garante um arquivo em disco (o pacote ZIP precisa do .md salvo ao lado das imagens). */
  ensureFile: () => Promise<boolean>;
  reveal: (path: string) => void;
}

const PREFS_KEY = "mdc.export";

const FORMATS: { id: ExportFormat; icon: string; title: string; desc: string; ext: string; label: string }[] = [
  { id: "html", icon: "i-web", title: "Página web", desc: "Um único arquivo .html com imagens embutidas.", ext: "html", label: "Página web" },
  { id: "pdf", icon: "i-pdf", title: "PDF", desc: "Documento pronto para imprimir ou enviar.", ext: "pdf", label: "PDF" },
  { id: "docx", icon: "i-word", title: "Word", desc: "Arquivo .docx editável, com tabelas e imagens.", ext: "docx", label: "Documento do Word" },
  { id: "md", icon: "i-code", title: "Markdown", desc: "O texto puro em .md, sem alterações de formato.", ext: "md", label: "Markdown" },
  { id: "txt", icon: "i-text", title: "Texto simples", desc: "Sem formatação, para colar em qualquer lugar.", ext: "txt", label: "Texto" },
  { id: "zip", icon: "i-zip", title: "Pacote para IA", desc: "ZIP com o texto, as imagens e instruções.", ext: "zip", label: "Pacote ZIP" },
  { id: "copy", icon: "i-copy", title: "Copiar formatado", desc: "Cola direto no Word, Docs ou e-mail.", ext: "", label: "" },
];

const DARK_VARS = `.markdown-body{--md-fg:#e6e8ee;--md-muted:#9aa3b2;--md-accent:#a5b4fc;--md-border:#2b303b;--md-code-bg:#191d24;--md-code-fg:#e6e8ee;--md-quote-bg:#191d24;--md-table-head:#1b1f27;--md-table-stripe:#171a21;--hl-keyword:#ff7b72;--hl-string:#a5d6ff;--hl-number:#ffa657;--hl-comment:#8b949e;--hl-function:#d2a8ff;--hl-attr:#79c0ff;--hl-builtin:#ffa657;--hl-type:#d2a8ff}
body{background:#0e1014;color:#e6e8ee}.markdown-body mark{background:rgba(250,204,21,.28);color:#fef9c3}`;

const PAPER_CSS = `body{background:#fff}.markdown-body{font-family:Georgia,"Times New Roman",serif;font-size:15px;line-height:1.6;max-width:760px;padding:24px 8px}
.markdown-body h1,.markdown-body h2,.markdown-body h3{font-family:Georgia,"Times New Roman",serif}`;

const EXTRA_CSS = `.toc{margin:0 0 2em;padding:14px 18px;border:1px solid var(--md-border);border-radius:10px}
.toc h2{margin:0 0 .4em;font-size:1em;border:0;padding:0}.toc ol{margin:0;padding-left:1.3em}.toc li{margin:.15em 0}.toc .l2{margin-left:1.2em}.toc .l3{margin-left:2.4em}
.bi-head,.bi-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 32px}
.bi-head{padding:0 0 .4em;color:var(--md-muted);font-size:.78em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid var(--md-border)}
.bi-row{border-bottom:1px solid var(--md-border)}.bi-cell{min-width:0}.bi-cell>:first-child{margin-top:.8em}.bi-cell>:last-child{margin-bottom:.8em}
.bi-cell:first-child{padding-right:16px;border-right:1px solid var(--md-border)}.bi-cell+.bi-cell{padding-left:0}
img{max-width:100%}`;

// ---------- renderização ----------

const noopHooks = {
  onOpenLocalDoc: () => {},
  onSaveDrawing: async () => {},
  onRemoveDrawing: async () => {},
  onSaveTextBlock: () => false,
  onRemoveTextBlock: () => {},
  onEditMermaid: () => {},
  onToggleTask: () => {},
};

class Renderer {
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

function tocHtml(body: string): string {
  const doc = new DOMParser().parseFromString(`<div>${body}</div>`, "text/html");
  const items = Array.from(doc.querySelectorAll("h1,h2,h3")).filter((e) => e.id);
  if (items.length < 2) return "";
  const lis = items.map((e) => `<li class="l${e.tagName[1]}"><a href="#${e.id}">${escapeHtml(e.textContent || "")}</a></li>`).join("");
  return `<nav class="toc"><h2>Sumário</h2><ol style="list-style:none;padding-left:0">${lis}</ol></nav>`;
}

function htmlDocument(opts: { title: string; lang: string; body: string; css: string; theme: Theme; size: string; print: boolean }): string {
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

// ---------- texto simples ----------

function inlineText(tokens: Token[] | undefined): string {
  return (tokens ?? [])
    .map((t) => {
      switch (t.type) {
        case "link": {
          const l = t as Tokens.Link;
          const txt = inlineText(l.tokens);
          return /^https?:/i.test(l.href) && txt !== l.href ? `${txt} (${l.href})` : txt;
        }
        case "image":
          return `[imagem: ${(t as Tokens.Image).text || "sem legenda"}]`;
        case "codespan":
          return (t as Tokens.Codespan).text;
        case "br":
          return "\n";
        case "html":
          return "";
        default: {
          const x = t as Tokens.Text & { tokens?: Token[] };
          return x.tokens ? inlineText(x.tokens) : x.text ?? (t as { raw?: string }).raw ?? "";
        }
      }
    })
    .join("");
}

function textBlocks(tokens: Token[], indent = ""): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        const x = t as Tokens.Heading;
        const txt = inlineText(x.tokens);
        out.push(x.depth === 1 ? `${txt.toUpperCase()}\n${"=".repeat(Math.min(60, txt.length))}` : x.depth === 2 ? `${txt}\n${"-".repeat(Math.min(60, txt.length))}` : txt);
        break;
      }
      case "paragraph":
      case "text":
        out.push(indent + inlineText((t as Tokens.Paragraph).tokens ?? [t]).replace(/\n/g, `\n${indent}`));
        break;
      case "list": {
        const list = t as Tokens.List;
        const lines: string[] = [];
        list.items.forEach((item, i) => {
          const mark = item.task ? (item.checked ? "[x]" : "[ ]") : list.ordered ? `${(Number(list.start) || 1) + i}.` : "•";
          const head = item.tokens.filter((k) => k.type !== "list");
          lines.push(`${indent}${mark} ${head.map((k) => inlineText((k as Tokens.Paragraph).tokens ?? [k])).join(" ")}`);
          for (const sub of item.tokens.filter((k) => k.type === "list")) lines.push(...textBlocks([sub], indent + "   "));
        });
        out.push(lines.join("\n"));
        break;
      }
      case "blockquote":
        out.push(textBlocks((t as Tokens.Blockquote).tokens).join("\n\n").replace(/^/gm, `${indent}> `));
        break;
      case "code":
        out.push((t as Tokens.Code).text.replace(/^/gm, `${indent}    `));
        break;
      case "table": {
        const tb = t as Tokens.Table;
        const row = (cells: Tokens.TableCell[]) => cells.map((c) => inlineText(c.tokens)).join("  |  ");
        out.push([row(tb.header), ...tb.rows.map(row)].join("\n"));
        break;
      }
      case "hr":
        out.push("────────────────────");
        break;
      default:
        break;
    }
  }
  return out;
}

export function markdownToText(md: string): string {
  return textBlocks(marked.lexer(md)).join("\n\n") + "\n";
}

// ---------- caixa de diálogo ----------

export function openExportDialog(ctx: ExportCtx, initial?: ExportFormat): void {
  const prefs: ExportPrefs = { format: "html", lang: "pt", theme: "light", size: "A4", toc: false, ...loadJSON<Partial<ExportPrefs>>(PREFS_KEY, {}) };
  if (initial) prefs.format = initial;
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal export-modal" });
  modal.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-export"/></svg>
      <h2>Exportar documento</h2>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="ex-body">
      <div class="ex-formats" role="radiogroup" aria-label="Formato">
        ${FORMATS.map(
          (f) => `<button class="ex-card" role="radio" data-fmt="${f.id}"><svg class="ic"><use href="#${f.icon}"/></svg><span class="ex-t"><b>${f.title}</b><small>${f.desc}</small></span></button>`
        ).join("")}
      </div>
      <div class="ex-side">
        <h4>Idioma</h4>
        <div class="seg ex-lang">
          <button class="seg-btn" data-lang="pt">Português</button>
          <button class="seg-btn" data-lang="en">English</button>
          <button class="seg-btn" data-lang="both">Os dois</button>
        </div>
        <p class="ex-hint" data-lang-hint></p>
        <div class="ex-opts" data-for="html pdf">
          <h4>Aparência</h4>
          <div class="seg ex-theme">
            <button class="seg-btn" data-theme="light">Claro</button>
            <button class="seg-btn" data-theme="paper">Papel</button>
            <button class="seg-btn" data-theme="dark" data-for="html">Escuro</button>
          </div>
        </div>
        <div class="ex-opts" data-for="pdf docx">
          <h4>Tamanho da página</h4>
          <div class="seg ex-size">
            <button class="seg-btn" data-size="A4">A4</button>
            <button class="seg-btn" data-size="Letter">Carta</button>
          </div>
        </div>
        <div class="ex-opts" data-for="html pdf">
          <label class="tr-opt"><input type="checkbox" data-toc> <span>Incluir sumário no início</span></label>
        </div>
        <p class="ex-hint" data-fmt-hint></p>
      </div>
    </div>
    <footer class="wm-foot">
      <span class="ex-status muted" data-status></span>
      <span class="dr-spacer"></span>
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" data-go><svg class="ic"><use href="#i-export"/></svg><span>Exportar</span></button>
    </footer>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const $m = <T extends HTMLElement>(sel: string) => modal.querySelector<T>(sel)!;
  const status = $m("[data-status]");
  const go = $m<HTMLButtonElement>("[data-go]");
  let busy = false;

  const save = () => saveJSON(PREFS_KEY, prefs);
  const paint = () => {
    modal.querySelectorAll<HTMLElement>("[data-fmt]").forEach((b) => {
      const on = b.dataset.fmt === prefs.format;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", String(on));
    });
    modal.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) => b.classList.toggle("active", b.dataset.lang === prefs.lang));
    modal.querySelectorAll<HTMLElement>("[data-theme]").forEach((b) => b.classList.toggle("active", b.dataset.theme === prefs.theme));
    modal.querySelectorAll<HTMLElement>("[data-size]").forEach((b) => b.classList.toggle("active", b.dataset.size === prefs.size));
    modal.querySelectorAll<HTMLElement>(".ex-opts").forEach((o) => (o.hidden = !o.dataset.for!.split(" ").includes(prefs.format)));
    modal.querySelectorAll<HTMLElement>("[data-theme][data-for]").forEach((b) => (b.hidden = b.dataset.for !== prefs.format));
    if (prefs.format === "pdf" && prefs.theme === "dark") prefs.theme = "paper";
    ($m("[data-toc]") as HTMLInputElement).checked = prefs.toc;
    const separate = prefs.format === "md" || prefs.format === "txt" || prefs.format === "zip";
    $m("[data-lang-hint]").textContent =
      prefs.lang === "pt"
        ? "O documento sai como você escreveu, em português."
        : prefs.lang === "en"
          ? "O texto é traduzido para o inglês (estrutura, imagens e código ficam iguais)."
          : separate
            ? "Salva dois arquivos: um em português e outro em inglês."
            : "Um só documento com duas colunas: português à esquerda, inglês à direita, parágrafo por parágrafo.";
    $m("[data-fmt-hint]").textContent =
      prefs.format === "pdf"
        ? "Abre a janela de impressão: escolha “Salvar como PDF” (ou “Microsoft Print to PDF”) como impressora."
        : prefs.format === "copy"
          ? "Copia o texto com formatação. Depois é só colar (Ctrl+V) no Word, Google Docs ou e-mail."
          : "";
    go.querySelector("span")!.textContent = prefs.format === "copy" ? "Copiar" : prefs.format === "pdf" ? "Abrir impressão" : "Exportar";
  };
  paint();

  modal.querySelectorAll<HTMLElement>("[data-fmt]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.format = b.dataset.fmt as ExportFormat;
      if (prefs.format === "pdf" && prefs.theme === "dark") prefs.theme = "paper";
      save();
      paint();
    })
  );
  modal.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.lang = b.dataset.lang as Lang;
      save();
      paint();
    })
  );
  modal.querySelectorAll<HTMLElement>("[data-theme]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.theme = b.dataset.theme as Theme;
      save();
      paint();
    })
  );
  modal.querySelectorAll<HTMLElement>("[data-size]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.size = b.dataset.size as ExportPrefs["size"];
      save();
      paint();
    })
  );
  $m<HTMLInputElement>("[data-toc]").addEventListener("change", (e) => {
    prefs.toc = (e.target as HTMLInputElement).checked;
    save();
  });

  const close = () => {
    if (busy) return;
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));

  go.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    go.disabled = true;
    const say = (t: string) => (status.textContent = t);
    try {
      const done = await runExport(ctx, prefs, say);
      if (done) {
        busy = false;
        close();
      }
    } catch (e) {
      toast("Não foi possível exportar: " + e, "err", 7000);
    } finally {
      busy = false;
      go.disabled = false;
      say("");
    }
  });
}

// ---------- execução ----------

async function suggestedPath(ctx: ExportCtx, name: string): Promise<string> {
  const p = ctx.docPath();
  if (p) return joinPath(docDirOf(p), name);
  try {
    return joinPath(await files.defaultDocsDir(), name);
  } catch {
    return name;
  }
}

/** Devolve o caminho irmão com outro sufixo (…-pt.md → …-en.md). */
function sibling(path: string, from: string, to: string): string {
  return path.replace(new RegExp(`${from}(\\.[^.\\\\/]+)$`), `${to}$1`);
}

async function runExport(ctx: ExportCtx, prefs: ExportPrefs, say: (t: string) => void): Promise<boolean> {
  const md = ctx.getMarkdown();
  if (!md.trim()) {
    toast("Documento vazio — nada para exportar.", "info");
    return false;
  }
  const fmt = FORMATS.find((f) => f.id === prefs.format)!;
  const name = ctx.docName();
  const wantsEn = prefs.lang !== "pt";

  let doc: TranslatedDoc | null = null;
  if (wantsEn) {
    say("Traduzindo para o inglês…");
    doc = await ctx.translation.translateDocument(md, (d, t) => say(t ? `Traduzindo para o inglês… ${d}/${t}` : "Traduzindo…"));
    if (doc.incomplete) {
      const proceed = await ask(
        "Alguns trechos não puderam ser traduzidos (limite do tradutor ou falta de conexão). Exportar assim mesmo, deixando esses trechos em português?",
        { title: "mdCreator", kind: "warning", okLabel: "Exportar assim", cancelLabel: "Cancelar" }
      );
      if (!proceed) return false;
    }
  }
  const enMd = doc?.markdown ?? "";
  const separate = prefs.format === "md" || prefs.format === "txt" || prefs.format === "zip";

  // ----- copiar -----
  if (prefs.format === "copy") {
    say("Preparando a cópia…");
    const html = await buildBody(ctx, prefs, md, doc, false);
    const styled = html
      .replace(/<table/g, '<table style="border-collapse:collapse"')
      .replace(/<(th|td)(\s|>)/g, '<$1 style="border:1px solid #bbb;padding:4px 8px"$2');
    const plain = prefs.lang === "en" ? markdownToText(enMd) : markdownToText(md);
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([styled], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) }),
      ]);
    } else {
      await navigator.clipboard.writeText(plain);
    }
    toast("Copiado com formatação. Cole no Word, Docs ou e-mail.", "ok", 3600);
    return true;
  }

  // ----- PDF (impressão) -----
  if (prefs.format === "pdf") {
    say("Montando o documento…");
    const body = await buildBody(ctx, prefs, md, doc, prefs.toc);
    const html = htmlDocument({ title: name, lang: prefs.lang === "en" ? "en" : "pt-BR", body, css: ctx.mdCss, theme: prefs.theme, size: prefs.size, print: true });
    await printHtml(html);
    toast("Na janela de impressão, escolha “Salvar como PDF” como impressora.", "info", 6500);
    return true;
  }

  // ----- arquivos -----
  const baseSuffix = prefs.lang === "both" && separate ? "-pt" : prefs.lang === "en" ? "-en" : prefs.lang === "both" ? "-pt-en" : "";
  const target = await files.pickSaveAny(await suggestedPath(ctx, `${name}${baseSuffix}.${fmt.ext}`), fmt.label, [fmt.ext]);
  if (!target) return false;

  const written: string[] = [];
  const writeText = async (path: string, content: string) => {
    await files.saveDoc(path, content);
    written.push(path);
  };

  switch (prefs.format) {
    case "md":
      if (prefs.lang === "both") {
        await writeText(target, md);
        await writeText(sibling(target, "-pt", "-en"), enMd);
      } else await writeText(target, prefs.lang === "en" ? enMd : md);
      break;
    case "txt":
      if (prefs.lang === "both") {
        await writeText(target, markdownToText(md));
        await writeText(sibling(target, "-pt", "-en"), markdownToText(enMd));
      } else await writeText(target, markdownToText(prefs.lang === "en" ? enMd : md));
      break;
    case "html": {
      say("Montando a página…");
      const body = await buildBody(ctx, prefs, md, doc, prefs.toc);
      await writeText(
        target,
        htmlDocument({ title: name, lang: prefs.lang === "en" ? "en" : "pt-BR", body, css: ctx.mdCss, theme: prefs.theme, size: prefs.size, print: false })
      );
      break;
    }
    case "docx": {
      say("Gerando o documento do Word…");
      const bytes = await buildDocx({
        markdown: prefs.lang === "en" ? enMd : md,
        bilingual: prefs.lang === "both" && doc ? ctx.translation.blocks(doc) : undefined,
        title: name,
        docPath: ctx.docPath(),
        pageSize: prefs.size,
      });
      await files.saveBinary(target, bytesToBase64(bytes));
      written.push(target);
      break;
    }
    case "zip": {
      if (!(await ctx.ensureFile())) return false;
      const docPath = ctx.docPath();
      if (!docPath) return false;
      say("Criando o pacote…");
      const count = await files.exportPortableBundle(docPath, prefs.lang === "en" ? enMd : md, target);
      written.push(target);
      if (prefs.lang === "both") {
        await files.exportPortableBundle(docPath, enMd, sibling(target, "-pt", "-en"));
        written.push(sibling(target, "-pt", "-en"));
      }
      toast(`Pacote criado com o Markdown e ${count} imagem(ns) local(is).`, "ok", 5200);
      break;
    }
    default:
      break;
  }
  toast(written.length > 1 ? `${written.length} arquivos exportados.` : `Exportado: ${written[0].split(/[\\/]/).pop()}`, "ok", 4200);
  if (written[0]) ctx.reveal(written[0]);
  return true;
}

/** Corpo HTML do documento (um idioma ou os dois lado a lado). */
async function buildBody(ctx: ExportCtx, prefs: ExportPrefs, md: string, doc: TranslatedDoc | null, toc: boolean): Promise<string> {
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
async function printHtml(html: string): Promise<void> {
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
