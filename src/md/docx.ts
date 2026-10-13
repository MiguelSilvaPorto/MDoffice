// Markdown → Word (.docx): títulos, listas, tabelas, código, imagens, citações e diagramas.
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import { marked, type Token, type Tokens } from "marked";
import * as files from "../files";
import { docDirOf, joinPath } from "../util";
import { renderMermaidInto } from "./diagram";

type Block = Paragraph | Table;

interface Ctx {
  docPath: string | null;
  numbering: number;
  images: Map<string, ImgData | null>;
}

interface ImgData {
  data: Uint8Array;
  w: number;
  h: number;
  type: "png" | "jpg" | "gif" | "bmp";
}

interface Style {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
  highlight?: boolean;
  small?: boolean;
  color?: string;
}

const MAX_IMG_W = 590;
const FONT = "Calibri";
const MONO = "Consolas";

// ---------- imagens ----------

function dataUrlBytes(url: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1], bytes };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

async function canvasPng(img: HTMLImageElement | ImageBitmap, w: number, h: number, scale = 1): Promise<Uint8Array | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

async function imageFromDataUrl(url: string): Promise<ImgData | null> {
  const parsed = dataUrlBytes(url);
  if (!parsed) return null;
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || 600;
    const h = img.naturalHeight || 400;
    const mime = parsed.mime.toLowerCase();
    const direct = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/gif" ? "gif" : mime === "image/bmp" ? "bmp" : null;
    if (direct) return { data: parsed.bytes, w, h, type: direct };
    const png = await canvasPng(img, w, h, 1);
    return png ? { data: png, w, h, type: "png" } : null;
  } catch {
    return null;
  }
}

async function resolveImage(href: string, ctx: Ctx): Promise<ImgData | null> {
  if (ctx.images.has(href)) return ctx.images.get(href) ?? null;
  let result: ImgData | null = null;
  try {
    if (/^data:/i.test(href)) result = await imageFromDataUrl(href);
    else if (/^https?:/i.test(href)) {
      const res = await fetch(href);
      const blob = await res.blob();
      const url = await new Promise<string>((ok) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.readAsDataURL(blob);
      });
      result = await imageFromDataUrl(url);
    } else if (ctx.docPath) {
      let rel = href;
      try {
        rel = decodeURIComponent(href);
      } catch {
        /* mantém */
      }
      const abs = /^[a-zA-Z]:[\\/]/.test(rel) ? rel : joinPath(docDirOf(ctx.docPath), rel);
      result = await imageFromDataUrl(await files.readDataUrl(abs));
    }
  } catch {
    result = null;
  }
  ctx.images.set(href, result);
  return result;
}

function imageRun(img: ImgData): ImageRun {
  const scale = Math.min(1, MAX_IMG_W / img.w);
  return new ImageRun({
    type: img.type,
    data: img.data,
    transformation: { width: Math.round(img.w * scale), height: Math.round(img.h * scale) },
  });
}

/** Diagrama Mermaid → PNG (para o Word não mostrar código). */
async function mermaidImage(code: string): Promise<ImgData | null> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;width:1100px;background:#fff";
  document.body.append(host);
  try {
    const err = await renderMermaidInto(host, code, false);
    const svg = host.querySelector("svg");
    if (err !== null || !svg) return null;
    const vb = svg.viewBox?.baseVal;
    const w = Math.round(vb && vb.width ? vb.width : svg.getBoundingClientRect().width || 800);
    const h = Math.round(vb && vb.height ? vb.height : svg.getBoundingClientRect().height || 500);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.removeAttribute("style");
    const xml = new XMLSerializer().serializeToString(svg);
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
    const png = await canvasPng(img, w, h, 2);
    return png ? { data: png, w, h, type: "png" } : null;
  } catch {
    return null;
  } finally {
    host.remove();
  }
}

// ---------- texto corrido ----------

function run(text: string, st: Style): TextRun {
  return new TextRun({
    text,
    bold: st.bold,
    italics: st.italics,
    strike: st.strike,
    font: st.code ? MONO : undefined,
    size: st.code ? 20 : st.small ? 18 : undefined,
    color: st.color,
    highlight: st.highlight ? "yellow" : undefined,
    shading: st.code ? { type: ShadingType.CLEAR, fill: "EEF0F3", color: "auto" } : undefined,
  });
}

async function inline(tokens: Token[] | undefined, ctx: Ctx, st: Style = {}, state = { mark: false, small: false }): Promise<ParagraphChild[]> {
  const out: ParagraphChild[] = [];
  for (const t of tokens ?? []) {
    const cur: Style = { ...st, highlight: st.highlight || state.mark, small: st.small || state.small };
    switch (t.type) {
      case "text":
      case "escape": {
        const tt = t as Tokens.Text;
        if (tt.tokens?.length) out.push(...(await inline(tt.tokens, ctx, st, state)));
        else out.push(run(decodeEntities(tt.text), cur));
        break;
      }
      case "strong":
        out.push(...(await inline((t as Tokens.Strong).tokens, ctx, { ...st, bold: true }, state)));
        break;
      case "em":
        out.push(...(await inline((t as Tokens.Em).tokens, ctx, { ...st, italics: true }, state)));
        break;
      case "del":
        out.push(...(await inline((t as Tokens.Del).tokens, ctx, { ...st, strike: true }, state)));
        break;
      case "codespan":
        out.push(run(decodeEntities((t as Tokens.Codespan).text), { ...cur, code: true }));
        break;
      case "br":
        out.push(new TextRun({ break: 1 }));
        break;
      case "link": {
        const l = t as Tokens.Link;
        const kids = await inline(l.tokens, ctx, { ...st, color: "0B5BD3" }, state);
        if (/^(https?:|mailto:)/i.test(l.href)) out.push(new ExternalHyperlink({ link: l.href, children: kids as TextRun[] }));
        else out.push(...kids);
        break;
      }
      case "image": {
        const im = t as Tokens.Image;
        const data = await resolveImage(im.href, ctx);
        if (data) out.push(imageRun(data));
        else out.push(run(`[${im.text || "imagem"}]`, { ...cur, italics: true, color: "888888" }));
        break;
      }
      case "html": {
        const tag = (t as Tokens.HTML).text.trim().toLowerCase();
        if (tag === "<mark>") state.mark = true;
        else if (tag === "</mark>") state.mark = false;
        else if (tag === "<small>") state.small = true;
        else if (tag === "</small>") state.small = false;
        else if (/^<br\s*\/?>$/.test(tag)) out.push(new TextRun({ break: 1 }));
        break;
      }
      default: {
        const raw = (t as { raw?: string }).raw;
        if (raw) out.push(run(raw, cur));
      }
    }
  }
  return out;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ---------- blocos ----------

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

function alignOf(a: string | null): Align | undefined {
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  if (a === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

async function listBlocks(list: Tokens.List, ctx: Ctx, level: number, align: string | null): Promise<Block[]> {
  const out: Block[] = [];
  const instance = ++ctx.numbering;
  for (const item of list.items) {
    const head: Token[] = [];
    const rest: Token[] = [];
    for (const t of item.tokens) (t.type === "list" || t.type === "code" || t.type === "table" ? rest : head).push(t);
    const kids: ParagraphChild[] = [];
    if (item.task) kids.push(run(item.checked ? "☑ " : "☐ ", {}));
    for (const t of head) {
      const sub = (t as Tokens.Text).tokens ?? (t as Tokens.Paragraph).tokens;
      if (sub) kids.push(...(await inline(sub, ctx)));
      else if (t.type === "text") kids.push(run((t as Tokens.Text).text, {}));
    }
    out.push(
      new Paragraph({
        children: kids,
        alignment: alignOf(align),
        numbering: { reference: list.ordered ? "numbers" : "bullets", level: Math.min(level, 5), instance },
        spacing: { after: 60 },
      })
    );
    for (const t of rest) {
      if (t.type === "list") out.push(...(await listBlocks(t as Tokens.List, ctx, level + 1, align)));
      else out.push(...(await blocks([t], ctx, align)));
    }
  }
  return out;
}

function codeBlock(text: string, label?: string): Block[] {
  const lines = text.replace(/\s+$/, "").split("\n");
  const out: Block[] = [];
  if (label) out.push(new Paragraph({ children: [run(label, { color: "6B7280", small: true })], spacing: { before: 120, after: 0 } }));
  lines.forEach((line, i) => {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: line || " ", font: MONO, size: 19 })],
        shading: { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" },
        spacing: { before: i === 0 && !label ? 120 : 0, after: i === lines.length - 1 ? 160 : 0, line: 252 },
        indent: { left: 120, right: 120 },
      })
    );
  });
  return out;
}

async function tableBlock(tb: Tokens.Table, ctx: Ctx): Promise<Block> {
  const cols = tb.header.length || 1;
  const cell = async (c: Tokens.TableCell, head: boolean, align: string | null) =>
    new TableCell({
      width: { size: Math.floor(100 / cols), type: WidthType.PERCENTAGE },
      shading: head ? { type: ShadingType.CLEAR, fill: "EEF0F3", color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: alignOf(align),
          children: await inline(c.tokens, ctx, head ? { bold: true } : {}),
        }),
      ],
    });
  const rows: TableRow[] = [];
  rows.push(new TableRow({ tableHeader: true, children: await Promise.all(tb.header.map((c, i) => cell(c, true, tb.align[i]))) }));
  for (const r of tb.rows) rows.push(new TableRow({ children: await Promise.all(r.map((c, i) => cell(c, false, tb.align[i]))) }));
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

async function blocks(tokens: Token[], ctx: Ctx, startAlign: string | null = null): Promise<Block[]> {
  const out: Block[] = [];
  let align = startAlign;
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        const h = t as Tokens.Heading;
        out.push(
          new Paragraph({
            heading: HEADINGS[Math.min(h.depth, 6) - 1],
            alignment: alignOf(align),
            children: await inline(h.tokens, ctx),
            spacing: { before: h.depth === 1 ? 320 : 240, after: 100 },
          })
        );
        break;
      }
      case "paragraph": {
        const p = t as Tokens.Paragraph;
        // parágrafo só com imagem fica centralizado
        const onlyImage = p.tokens.length === 1 && p.tokens[0].type === "image";
        out.push(
          new Paragraph({
            children: await inline(p.tokens, ctx),
            alignment: alignOf(align) ?? (onlyImage ? AlignmentType.CENTER : undefined),
            spacing: { after: 140, line: 300 },
          })
        );
        break;
      }
      case "text": {
        const x = t as Tokens.Text;
        out.push(new Paragraph({ children: await inline(x.tokens ?? [x], ctx), alignment: alignOf(align), spacing: { after: 100 } }));
        break;
      }
      case "list":
        out.push(...(await listBlocks(t as Tokens.List, ctx, 0, align)));
        break;
      case "blockquote": {
        // citação: parágrafos com barra lateral (listas e outros blocos entram normais)
        for (const q of (t as Tokens.Blockquote).tokens) {
          const sub = (q as Tokens.Paragraph).tokens;
          if (!sub) {
            if (q.type !== "space") out.push(...(await blocks([q], ctx, align)));
            continue;
          }
          out.push(
            new Paragraph({
              children: await inline(sub, ctx, { italics: true, color: "4B5563" }),
              indent: { left: 360 },
              border: { left: { style: BorderStyle.SINGLE, size: 18, color: "A5B4FC", space: 10 } },
              spacing: { after: 120 },
            })
          );
        }
        break;
      }
      case "code": {
        const c = t as Tokens.Code;
        const lang = (c.lang || "").trim().toLowerCase();
        if (lang === "mermaid") {
          const img = await mermaidImage(c.text);
          if (img) {
            out.push(new Paragraph({ children: [imageRun(img)], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 160 } }));
            break;
          }
        }
        out.push(...codeBlock(c.text, lang && !/^(text|txt|plain)$/.test(lang) ? lang : undefined));
        break;
      }
      case "table":
        out.push(await tableBlock(t as Tokens.Table, ctx));
        out.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        break;
      case "hr":
        out.push(
          new Paragraph({
            children: [],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D1D5DB", space: 1 } },
            spacing: { before: 120, after: 160 },
          })
        );
        break;
      case "html": {
        const raw = (t as Tokens.HTML).text.trim();
        const open = /^<div\s+align="(left|center|right|justify)">$/i.exec(raw);
        if (open) align = open[1].toLowerCase() === "left" ? null : open[1].toLowerCase();
        else if (/^<\/div>$/i.test(raw)) align = null;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

// ---------- documento ----------

export interface DocxOptions {
  markdown?: string;
  /** Pares PT/EN alinhados: gera uma tabela de duas colunas. */
  bilingual?: { pt: string; en: string }[];
  title: string;
  docPath: string | null;
  pageSize: "A4" | "Letter";
}

const bulletLevels = ["•", "◦", "▪", "•", "◦", "▪"].map((text, level) => ({
  level,
  format: LevelFormat.BULLET,
  text,
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 540 + level * 360, hanging: 270 } } },
}));

const numberLevels = [0, 1, 2, 3, 4, 5].map((level) => ({
  level,
  format: level % 2 ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL,
  text: `%${level + 1}.`,
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 540 + level * 360, hanging: 360 } } },
}));

export async function buildDocx(opts: DocxOptions): Promise<Uint8Array> {
  const ctx: Ctx = { docPath: opts.docPath, numbering: 0, images: new Map() };
  const children: Block[] = [];
  const empty = () => new Paragraph({ children: [] });

  if (opts.bilingual) {
    const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const rows: TableRow[] = [];
    for (const pair of opts.bilingual) {
      const mk = async (md: string) => {
        const kids = await blocks(marked.lexer(md), ctx);
        return kids.length ? kids : [empty()];
      };
      rows.push(
        new TableRow({
          cantSplit: false,
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 40, bottom: 40, left: 0, right: 200 },
              borders: { top: none, left: none, right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" }, bottom: none },
              children: await mk(pair.pt),
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 40, bottom: 40, left: 200, right: 0 },
              borders: { top: none, left: none, right: none, bottom: none },
              children: await mk(pair.en),
            }),
          ],
        })
      );
    }
    children.push(
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
      })
    );
  } else {
    children.push(...(await blocks(marked.lexer(opts.markdown ?? ""), ctx)));
  }
  if (!children.length) children.push(empty());

  const A4 = { width: 11906, height: 16838 };
  const LETTER = { width: 12240, height: 15840 };
  const doc = new Document({
    title: opts.title,
    creator: "mdOffice",
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [1, 2, 3, 4].map((n) => ({
        id: `Heading${n}`,
        name: `Heading ${n}`,
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: FONT, bold: true, size: [40, 32, 28, 24][n - 1], color: "1F2328" },
      })),
    },
    numbering: {
      config: [
        { reference: "bullets", levels: bulletLevels },
        { reference: "numbers", levels: numberLevels },
      ],
    },
    sections: [
      {
        properties: { page: { size: opts.pageSize === "A4" ? A4 : LETTER, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children,
      },
    ],
  });
  return new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer());
}
