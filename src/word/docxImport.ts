// Importa um arquivo .docx do Word para o modelo do motor (documento + configuração da página).
// Lê: parágrafos e estilos, títulos, listas (com níveis), tabelas (colunas/linhas mescladas),
// imagens, links, quebras de página, tamanho/margens da página, cabeçalho e rodapé.
import JSZip from "jszip";
import type { Mark, Node as PMNode } from "prosemirror-model";
import { schema, type Align } from "./schema";
import { DEFAULT_SETUP, type PageSetup } from "./model";

type El = Element;

// ---------- utilidades de XML ----------

const kids = (el: El | null | undefined, name?: string): El[] =>
  el ? (Array.from(el.childNodes).filter((n) => n.nodeType === 1 && (!name || (n as El).nodeName === name)) as El[]) : [];
const first = (el: El | null | undefined, name: string): El | null => kids(el, name)[0] ?? null;
const attr = (el: El | null | undefined, name: string): string | null => (el ? el.getAttribute(name) : null);
const val = (el: El | null | undefined): string | null => attr(el, "w:val");
/** Marcação do Word: presente e não explicitamente desligada. */
const on = (el: El | null | undefined): boolean => !!el && !["0", "false", "off", "none"].includes((val(el) ?? "").toLowerCase());
const twipsToPt = (v: string | null): number | null => (v == null || v === "" || isNaN(+v) ? null : Math.round((+v / 20) * 10) / 10);

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

const HIGHLIGHT: Record<string, string> = {
  yellow: "#ffff00",
  green: "#00ff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  blue: "#0000ff",
  red: "#ff0000",
  darkBlue: "#000080",
  darkCyan: "#008080",
  darkGreen: "#008000",
  darkMagenta: "#800080",
  darkRed: "#800000",
  darkYellow: "#808000",
  darkGray: "#808080",
  lightGray: "#c0c0c0",
  black: "#000000",
};

// ---------- propriedades de texto e parágrafo ----------

interface RunProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  size?: number;
  font?: string;
  highlight?: string;
  vert?: "sup" | "sub";
}

interface ParaProps {
  align?: Align;
  before?: number;
  after?: number;
  line?: number;
  left?: number;
  first?: number;
  numId?: string;
  ilvl?: number;
  styleId?: string;
  pageBreakBefore?: boolean;
}

function readRPr(rPr: El | null): RunProps {
  const p: RunProps = {};
  if (!rPr) return p;
  const b = first(rPr, "w:b");
  if (b) p.bold = on(b);
  const i = first(rPr, "w:i");
  if (i) p.italic = on(i);
  const u = first(rPr, "w:u");
  if (u) p.underline = on(u);
  const s = first(rPr, "w:strike") ?? first(rPr, "w:dstrike");
  if (s) p.strike = on(s);
  const c = val(first(rPr, "w:color"));
  if (c && c !== "auto" && /^[0-9a-f]{6}$/i.test(c)) p.color = `#${c}`;
  const sz = val(first(rPr, "w:sz"));
  if (sz && !isNaN(+sz)) p.size = +sz / 2;
  const f = first(rPr, "w:rFonts");
  const font = attr(f, "w:ascii") ?? attr(f, "w:hAnsi") ?? attr(f, "w:cs");
  if (font) p.font = font;
  const hl = val(first(rPr, "w:highlight"));
  if (hl && hl !== "none") p.highlight = HIGHLIGHT[hl] ?? "#ffff00";
  const shd = first(rPr, "w:shd");
  if (!p.highlight && shd) {
    const fill = attr(shd, "w:fill");
    if (fill && fill !== "auto" && /^[0-9a-f]{6}$/i.test(fill)) p.highlight = `#${fill}`;
  }
  const va = val(first(rPr, "w:vertAlign"));
  if (va === "superscript") p.vert = "sup";
  if (va === "subscript") p.vert = "sub";
  return p;
}

function readPPr(pPr: El | null): ParaProps {
  const p: ParaProps = {};
  if (!pPr) return p;
  const jc = val(first(pPr, "w:jc"));
  if (jc) p.align = jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : jc === "both" || jc === "distribute" ? "justify" : "left";
  const sp = first(pPr, "w:spacing");
  if (sp) {
    const before = twipsToPt(attr(sp, "w:before"));
    const after = twipsToPt(attr(sp, "w:after"));
    if (before != null) p.before = before;
    if (after != null) p.after = after;
    const line = attr(sp, "w:line");
    const rule = attr(sp, "w:lineRule");
    if (line && (!rule || rule === "auto") && !isNaN(+line)) p.line = Math.round((+line / 240) * 100) / 100;
  }
  const ind = first(pPr, "w:ind");
  if (ind) {
    const left = twipsToPt(attr(ind, "w:left") ?? attr(ind, "w:start"));
    const firstLine = twipsToPt(attr(ind, "w:firstLine"));
    const hanging = twipsToPt(attr(ind, "w:hanging"));
    if (left != null) p.left = left;
    if (firstLine != null) p.first = firstLine;
    else if (hanging != null) p.first = -hanging;
  }
  const num = first(pPr, "w:numPr");
  if (num) {
    p.numId = val(first(num, "w:numId")) ?? undefined;
    p.ilvl = +(val(first(num, "w:ilvl")) ?? 0);
  }
  p.styleId = val(first(pPr, "w:pStyle")) ?? undefined;
  if (on(first(pPr, "w:pageBreakBefore"))) p.pageBreakBefore = true;
  return p;
}

// ---------- estilos e numeração ----------

interface StyleDef {
  id: string;
  name: string;
  basedOn?: string;
  type: string;
  run: RunProps;
  para: ParaProps;
  /** nível de título (1–6) quando é um estilo de título */
  heading?: number;
}

interface Ctx {
  zip: JSZip;
  /** propriedades de texto do documento comum (padrões + estilo Normal) */
  base: RunProps;
  styles: Map<string, StyleDef>;
  defaults: RunProps;
  defaultPara: ParaProps;
  /** numId → formato por nível */
  numbering: Map<string, { fmt: string; start: number }[]>;
  rels: Map<string, { target: string; external: boolean }>;
  media: Map<string, string>;
}

function headingLevel(id: string, name: string): number | undefined {
  const n = name.toLowerCase();
  const m = /^heading\s*(\d)$/.exec(n) ?? /^t[ií]tulo\s*(\d)$/.exec(n) ?? /^heading(\d)$/i.exec(id) ?? /^t[ií]tulo(\d)$/i.exec(id);
  if (m) return Math.min(6, Math.max(1, +m[1]));
  if (n === "title" || n === "título" || n === "titulo") return 1;
  return undefined;
}

function readStyles(doc: Document | null): { styles: Map<string, StyleDef>; defaults: RunProps; defaultPara: ParaProps } {
  const styles = new Map<string, StyleDef>();
  let defaults: RunProps = {};
  let defaultPara: ParaProps = {};
  if (!doc) return { styles, defaults, defaultPara };
  const root = doc.documentElement;
  const dd = first(root, "w:docDefaults");
  if (dd) {
    defaults = readRPr(first(first(dd, "w:rPrDefault"), "w:rPr"));
    defaultPara = readPPr(first(first(dd, "w:pPrDefault"), "w:pPr"));
  }
  for (const st of kids(root, "w:style")) {
    const id = attr(st, "w:styleId");
    if (!id) continue;
    const name = val(first(st, "w:name")) ?? id;
    styles.set(id, {
      id,
      name,
      basedOn: val(first(st, "w:basedOn")) ?? undefined,
      type: attr(st, "w:type") ?? "paragraph",
      run: readRPr(first(st, "w:rPr")),
      para: readPPr(first(st, "w:pPr")),
      heading: headingLevel(id, name),
    });
  }
  return { styles, defaults, defaultPara };
}

/** Junta as propriedades do estilo com as dos estilos em que ele se baseia. */
function resolveStyle(ctx: Ctx, id: string | undefined): { run: RunProps; para: ParaProps; heading?: number } {
  const chain: StyleDef[] = [];
  let cur = id ? ctx.styles.get(id) : undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.basedOn ? ctx.styles.get(cur.basedOn) : undefined;
  }
  let run: RunProps = {};
  let para: ParaProps = {};
  let heading: number | undefined;
  for (const s of chain) {
    run = { ...run, ...s.run };
    para = { ...para, ...s.para };
    if (s.heading) heading = s.heading;
  }
  return { run, para, heading };
}

function readNumbering(doc: Document | null): Map<string, { fmt: string; start: number }[]> {
  const out = new Map<string, { fmt: string; start: number }[]>();
  if (!doc) return out;
  const root = doc.documentElement;
  const abstracts = new Map<string, { fmt: string; start: number }[]>();
  for (const a of kids(root, "w:abstractNum")) {
    const levels: { fmt: string; start: number }[] = [];
    for (const l of kids(a, "w:lvl")) {
      levels[+(attr(l, "w:ilvl") ?? 0)] = { fmt: val(first(l, "w:numFmt")) ?? "decimal", start: +(val(first(l, "w:start")) ?? 1) };
    }
    abstracts.set(attr(a, "w:abstractNumId") ?? "", levels);
  }
  for (const n of kids(root, "w:num")) {
    const levels = abstracts.get(val(first(n, "w:abstractNumId")) ?? "");
    if (levels) out.set(attr(n, "w:numId") ?? "", levels);
  }
  return out;
}

function readRels(text: string | null): Map<string, { target: string; external: boolean }> {
  const out = new Map<string, { target: string; external: boolean }>();
  if (!text) return out;
  for (const r of Array.from(parseXml(text).getElementsByTagName("Relationship"))) {
    out.set(r.getAttribute("Id") ?? "", { target: r.getAttribute("Target") ?? "", external: r.getAttribute("TargetMode") === "External" });
  }
  return out;
}

// ---------- imagens ----------

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml", webp: "image/webp" };

async function loadMedia(zip: JSZip, rels: Map<string, { target: string; external: boolean }>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const [id, rel] of rels) {
    if (rel.external) continue;
    const ext = rel.target.split(".").pop()?.toLowerCase() ?? "";
    if (!MIME[ext]) continue;
    const path = rel.target.startsWith("/") ? rel.target.slice(1) : `word/${rel.target.replace(/^\.\//, "")}`;
    const file = zip.file(path);
    if (!file) continue;
    out.set(id, `data:${MIME[ext]};base64,${await file.async("base64")}`);
  }
  return out;
}

// ---------- conversão do corpo ----------

const EMU_PER_PX = 9525;

function marksFor(ctx: Ctx, props: RunProps, base: RunProps, link: string | null, isHeading: boolean): Mark[] {
  const marks: Mark[] = [];
  const p = props;
  const d = base;
  void ctx;
  if (p.bold ?? (isHeading ? undefined : d.bold)) marks.push(schema.marks.bold.create());
  if (p.italic ?? (isHeading ? undefined : d.italic)) marks.push(schema.marks.italic.create());
  if (p.underline ?? d.underline) marks.push(schema.marks.underline.create());
  if (p.strike ?? d.strike) marks.push(schema.marks.strike.create());
  if (p.vert === "sup") marks.push(schema.marks.sup.create());
  if (p.vert === "sub") marks.push(schema.marks.sub.create());
  if (p.font && p.font !== d.font && !isHeading) marks.push(schema.marks.font_family.create({ name: p.font }));
  if (p.size && p.size !== d.size && !isHeading) marks.push(schema.marks.font_size.create({ size: p.size }));
  if (p.color && !isHeading) marks.push(schema.marks.text_color.create({ color: p.color }));
  if (p.highlight) marks.push(schema.marks.highlight.create({ color: p.highlight }));
  if (link) marks.push(schema.marks.link.create({ href: link }));
  return marks;
}

type Inline = PMNode;

/** Lê um parágrafo e devolve o texto em partes, separando onde há quebra de página. */
function readParagraphInlines(ctx: Ctx, p: El, styleRun: RunProps, isHeading: boolean): { parts: Inline[][]; breaks: number } {
  const parts: Inline[][] = [[]];
  let breaks = 0;
  const push = (n: Inline | null) => {
    if (n) parts[parts.length - 1].push(n);
  };

  const walk = (container: El, link: string | null, inherited: RunProps) => {
    for (const child of kids(container)) {
      switch (child.nodeName) {
        case "w:r":
          readRun(child, link, inherited);
          break;
        case "w:hyperlink": {
          const rid = attr(child, "r:id");
          const href = rid ? ctx.rels.get(rid)?.target ?? null : null;
          walk(child, href && /^(https?:|mailto:)/i.test(href) ? href : link, inherited);
          break;
        }
        case "w:ins":
        case "w:smartTag":
        case "w:sdt":
        case "w:fldSimple":
          walk(first(child, "w:sdtContent") ?? child, link, inherited);
          break;
        case "w:sdtContent":
          walk(child, link, inherited);
          break;
        default:
          break; // w:del, w:bookmark*, w:proofErr…
      }
    }
  };

  const readRun = (r: El, link: string | null, inherited: RunProps) => {
    const rStyle = val(first(first(r, "w:rPr"), "w:rStyle"));
    const charStyle = rStyle ? resolveStyle(ctx, rStyle).run : {};
    const direct: RunProps = { ...inherited, ...charStyle, ...readRPr(first(r, "w:rPr")) };
    // texto comum herda o formato do estilo do parágrafo; títulos usam o visual padrão de título
    const use = marksFor(ctx, isHeading ? direct : { ...styleRun, ...direct }, ctx.base, link, isHeading);
    let text = "";
    const flush = () => {
      if (text) {
        push(schema.text(text, use));
        text = "";
      }
    };
    for (const c of kids(r)) {
      switch (c.nodeName) {
        case "w:t":
          text += c.textContent ?? "";
          break;
        case "w:tab":
          text += "\t";
          break;
        case "w:noBreakHyphen":
          text += "‑";
          break;
        case "w:sym":
          text += " ";
          break;
        case "w:br": {
          const type = attr(c, "w:type");
          flush();
          if (type === "page") {
            breaks++;
            parts.push([]);
          } else if (type !== "column") push(schema.nodes.hard_break.create());
          break;
        }
        case "w:drawing":
        case "w:pict": {
          flush();
          const img = readImage(c);
          if (img) push(img);
          break;
        }
        default:
          break;
      }
    }
    flush();
  };

  const readImage = (el: El): Inline | null => {
    const blip = el.getElementsByTagName("a:blip")[0];
    const rid = blip?.getAttribute("r:embed") ?? el.getElementsByTagName("v:imagedata")[0]?.getAttribute("r:id");
    if (!rid) return null;
    const src = ctx.media.get(rid);
    if (!src) return null;
    const ext = el.getElementsByTagName("wp:extent")[0];
    const cx = ext ? +(ext.getAttribute("cx") ?? 0) : 0;
    const cy = ext ? +(ext.getAttribute("cy") ?? 0) : 0;
    const docPr = el.getElementsByTagName("wp:docPr")[0];
    return schema.nodes.image.create({
      src,
      alt: docPr?.getAttribute("descr") || null,
      width: cx ? Math.round(cx / EMU_PER_PX) : null,
      height: cy ? Math.round(cy / EMU_PER_PX) : null,
    });
  };

  walk(p, null, {});
  return { parts, breaks };
}

interface ListNode {
  ordered: boolean;
  start: number;
  items: { para: PMNode; sub: ListNode[] }[];
}

function toPM(list: ListNode): PMNode {
  const items = list.items.map((it) => schema.nodes.list_item.create(null, [it.para, ...it.sub.map(toPM)]));
  return list.ordered ? schema.nodes.ordered_list.create({ order: list.start }, items) : schema.nodes.bullet_list.create(null, items);
}

function paraAttrs(props: ParaProps, defaults: ParaProps, isHeading: boolean) {
  const diff = <T,>(v: T | undefined, d: T | undefined): T | null => (v === undefined || v === d ? null : v);
  return {
    align: props.align && props.align !== "left" ? props.align : null,
    spaceBefore: isHeading ? null : diff(props.before, defaults.before),
    spaceAfter: isHeading ? null : diff(props.after, defaults.after),
    lineHeight: isHeading ? null : diff(props.line, defaults.line),
    indentLeft: props.left && props.left > 0 ? props.left : null,
    indentFirst: props.first && props.first !== 0 ? props.first : null,
  };
}

function readBlocks(ctx: Ctx, container: El): PMNode[] {
  const out: PMNode[] = [];
  // listas: pilha de níveis abertos
  let stack: ListNode[] = [];
  let stackNum: string | null = null;

  const closeLists = () => {
    if (stack.length) {
      out.push(toPM(stack[0]));
      stack = [];
      stackNum = null;
    }
  };

  const addToList = (para: PMNode, numId: string, ilvl: number) => {
    const levels = ctx.numbering.get(numId) ?? [];
    const fmt = levels[ilvl]?.fmt ?? "bullet";
    const ordered = fmt !== "bullet" && fmt !== "none";
    // um nível interno com outro numId (lista dentro de lista) continua a lista de fora
    const nestedInside = ilvl > 0 && stack.length >= ilvl;
    if (stackNum !== null && stackNum !== numId && !nestedInside) closeLists();
    if (stackNum === null) stackNum = numId;
    // desce até o nível pedido
    while (stack.length < ilvl + 1) {
      const lvl = stack.length;
      const lf = levels[lvl]?.fmt ?? fmt;
      const node: ListNode = { ordered: lf !== "bullet" && lf !== "none", start: levels[lvl]?.start ?? 1, items: [] };
      if (lvl === 0) stack.push(node);
      else {
        const parent = stack[lvl - 1];
        if (!parent.items.length) parent.items.push({ para: schema.nodes.paragraph.create(), sub: [] });
        parent.items[parent.items.length - 1].sub.push(node);
        stack.push(node);
      }
    }
    stack.length = ilvl + 1;
    const target = stack[ilvl];
    if (!target.items.length) target.ordered = ordered;
    target.items.push({ para, sub: [] });
  };

  for (const el of kids(container)) {
    if (el.nodeName === "w:p") {
      const direct = readPPr(first(el, "w:pPr"));
      const style = resolveStyle(ctx, direct.styleId);
      const props: ParaProps = { ...style.para, ...direct };
      const level = style.heading;
      const isHeading = !!level;
      const { parts } = readParagraphInlines(ctx, el, style.run, isHeading);

      if (props.pageBreakBefore) {
        closeLists();
        out.push(schema.nodes.page_break.create());
      }
      const attrs = paraAttrs(props, ctx.defaultPara, isHeading);
      parts.forEach((inlines, idx) => {
        // parágrafos vazios que só existem por causa da quebra de página não valem a pena
        const skip = inlines.length === 0 && parts.length > 1;
        if (!skip) {
          const node = isHeading
            ? schema.nodes.heading.create({ ...attrs, level }, inlines)
            : schema.nodes.paragraph.create(attrs, inlines);
          if (props.numId && props.numId !== "0" && !isHeading) addToList(node, props.numId, props.ilvl ?? 0);
          else {
            closeLists();
            out.push(node);
          }
        }
        if (idx < parts.length - 1) {
          closeLists();
          out.push(schema.nodes.page_break.create());
        }
      });
    } else if (el.nodeName === "w:tbl") {
      closeLists();
      const t = readTable(ctx, el);
      if (t) out.push(t);
    } else if (el.nodeName === "w:sdt") {
      closeLists();
      out.push(...readBlocks(ctx, first(el, "w:sdtContent") ?? el));
    }
  }
  closeLists();
  return out;
}

function readTable(ctx: Ctx, tbl: El): PMNode | null {
  const rows: PMNode[] = [];
  // célula de origem de cada coluna, para as mesclagens verticais
  const above: ({ cell: { rowspan: number } } | null)[] = [];
  const grid: { cells: { colspan: number; rowspan: number; content: PMNode[]; background: string | null; skip: boolean }[] }[] = [];

  for (const tr of kids(tbl, "w:tr")) {
    const rowCells: { colspan: number; rowspan: number; content: PMNode[]; background: string | null; skip: boolean }[] = [];
    let col = 0;
    for (const tc of kids(tr, "w:tc")) {
      const pr = first(tc, "w:tcPr");
      const span = +(val(first(pr, "w:gridSpan")) ?? 1) || 1;
      const vm = first(pr, "w:vMerge");
      const fill = attr(first(pr, "w:shd"), "w:fill");
      const background = fill && fill !== "auto" && /^[0-9a-f]{6}$/i.test(fill) ? `#${fill}` : null;
      if (vm && (val(vm) ?? "continue") !== "restart") {
        // continua a célula de cima
        const origin = above[col];
        if (origin) origin.cell.rowspan += 1;
        rowCells.push({ colspan: span, rowspan: 1, content: [], background, skip: true });
      } else {
        let content = readBlocks(ctx, tc);
        if (!content.length) content = [schema.nodes.paragraph.create()];
        const cell = { colspan: span, rowspan: 1, content, background, skip: false };
        rowCells.push(cell);
        for (let k = 0; k < span; k++) above[col + k] = { cell };
      }
      col += span;
    }
    grid.push({ cells: rowCells });
  }
  for (const r of grid) {
    const cells = r.cells
      .filter((c) => !c.skip)
      .map((c) =>
        schema.nodes.table_cell.create(
          { colspan: c.colspan, rowspan: c.rowspan, colwidth: null, background: c.background },
          c.content
        )
      );
    if (cells.length) rows.push(schema.nodes.table_row.create(null, cells));
  }
  return rows.length ? schema.nodes.table.create(null, rows) : null;
}

// ---------- configuração da página, cabeçalho e rodapé ----------

async function readHeaderFooter(ctx: Ctx, sect: El | null, kind: "header" | "footer"): Promise<{ text: string; page: boolean }> {
  const ref = kids(sect, kind === "header" ? "w:headerReference" : "w:footerReference").find((r) => (attr(r, "w:type") ?? "default") === "default");
  const rid = attr(ref, "r:id");
  const rel = rid ? ctx.rels.get(rid) : null;
  if (!rel) return { text: "", page: false };
  const file = ctx.zip.file(`word/${rel.target.replace(/^\.\//, "")}`);
  if (!file) return { text: "", page: false };
  const doc = parseXml(await file.async("string"));
  let page = false;
  const lines: string[] = [];
  for (const p of Array.from(doc.getElementsByTagName("w:p"))) {
    let text = "";
    for (const n of Array.from(p.getElementsByTagName("*"))) {
      if (n.nodeName === "w:t") text += n.textContent ?? "";
      else if (n.nodeName === "w:tab") text += " ";
      else if (n.nodeName === "w:instrText" && /\bPAGE\b/i.test(n.textContent ?? "")) page = true;
      else if (n.nodeName === "w:fldSimple" && /\bPAGE\b/i.test(n.getAttribute("w:instr") ?? "")) page = true;
    }
    if (text.trim()) lines.push(text.trim());
  }
  let text = lines.join(" · ");
  if (page) {
    // "Página 3 de 10": o número vem do campo; sobram só as palavras soltas
    text = text.replace(/(?:[\s·|-]*)(?:p[áa]gina|p[áa]g\.?|page)?\s*(?:de|of|\/)?\s*$/i, "").trim();
  }
  return { text, page };
}

export async function importDocx(bytes: Uint8Array | ArrayBuffer): Promise<{ doc: PMNode; setup: PageSetup }> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Este arquivo não parece ser um documento do Word (.docx).");
  const read = async (path: string) => (zip.file(path) ? await zip.file(path)!.async("string") : null);

  const stylesDoc = (await read("word/styles.xml")) ? parseXml((await read("word/styles.xml"))!) : null;
  const numDoc = (await read("word/numbering.xml")) ? parseXml((await read("word/numbering.xml"))!) : null;
  const { styles, defaults, defaultPara } = readStyles(stylesDoc);
  const rels = readRels(await read("word/_rels/document.xml.rels"));
  const ctx: Ctx = {
    zip,
    base: {},
    styles,
    defaults,
    defaultPara,
    numbering: readNumbering(numDoc),
    rels,
    media: await loadMedia(zip, rels),
  };

  ctx.base = { ...defaults, ...resolveStyle(ctx, "Normal").run };
  const body = first(parseXml(await docFile.async("string")).documentElement, "w:body");
  if (!body) throw new Error("O documento está vazio ou corrompido.");
  const blocks = readBlocks(ctx, body);
  const doc = schema.nodes.doc.create(null, blocks.length ? blocks : [schema.nodes.paragraph.create()]);

  // página
  const setup: PageSetup = { ...DEFAULT_SETUP, margins: { ...DEFAULT_SETUP.margins } };
  const sect = first(body, "w:sectPr");
  const pgSz = first(sect, "w:pgSz");
  if (pgSz) {
    const w = +(attr(pgSz, "w:w") ?? 0);
    const h = +(attr(pgSz, "w:h") ?? 0);
    const landscape = attr(pgSz, "w:orient") === "landscape" || (w > h && w > 0);
    const short = Math.min(w, h) / 567;
    setup.landscape = landscape;
    setup.size = Math.abs(short - 21.59) < Math.abs(short - 21) ? "Letter" : "A4";
  }
  const mar = first(sect, "w:pgMar");
  if (mar) {
    const cm = (n: string) => {
      const v = attr(mar, n);
      return v && !isNaN(+v) ? Math.round((+v / 567) * 100) / 100 : null;
    };
    setup.margins = {
      top: cm("w:top") ?? setup.margins.top,
      bottom: cm("w:bottom") ?? setup.margins.bottom,
      left: cm("w:left") ?? setup.margins.left,
      right: cm("w:right") ?? setup.margins.right,
    };
  }
  if (ctx.base.font) setup.defaultFont = ctx.base.font;
  if (ctx.base.size) setup.defaultSize = ctx.base.size;
  const head = await readHeaderFooter(ctx, sect, "header");
  const foot = await readHeaderFooter(ctx, sect, "footer");
  setup.header = head.text;
  setup.footer = foot.text;
  setup.pageNumbers = foot.page || head.page;
  return { doc, setup };
}
