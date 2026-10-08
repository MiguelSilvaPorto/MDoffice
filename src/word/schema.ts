// Modelo do documento Word: o que um documento pode conter (parágrafos, títulos, listas,
// tabelas, imagens, quebra de página) e as marcas de texto (negrito, fonte, tamanho, cor…).
import { Schema, type DOMOutputSpec, type MarkSpec, type Node as PMNode, type NodeSpec } from "prosemirror-model";
import { tableNodes } from "prosemirror-tables";

export type Align = "left" | "center" | "right" | "justify";

/** Atributos de formatação de parágrafo (iguais em parágrafos e títulos). */
export interface ParaAttrs {
  align: Align | null;
  /** espaço antes/depois, em pontos */
  spaceBefore: number | null;
  spaceAfter: number | null;
  /** entrelinha como múltiplo (1, 1.15, 1.5, 2…) */
  lineHeight: number | null;
  /** recuo à esquerda e da primeira linha, em pontos */
  indentLeft: number | null;
  indentFirst: number | null;
}

const paraAttrs = {
  align: { default: null as Align | null },
  spaceBefore: { default: null as number | null },
  spaceAfter: { default: null as number | null },
  lineHeight: { default: null as number | null },
  indentLeft: { default: null as number | null },
  indentFirst: { default: null as number | null },
};

function num(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Converte "12px" / "12pt" / "1cm" em pontos. */
function toPt(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return null;
  if (/px$/.test(v)) return Math.round(n * 0.75 * 10) / 10;
  if (/cm$/.test(v)) return Math.round(n * 28.3465 * 10) / 10;
  if (/in$/.test(v)) return n * 72;
  return n;
}

function paraStyle(attrs: Record<string, unknown>): string {
  const a = attrs as unknown as ParaAttrs;
  const css: string[] = [];
  if (a.align) css.push(`text-align:${a.align}`);
  if (a.spaceBefore != null) css.push(`margin-top:${a.spaceBefore}pt`);
  if (a.spaceAfter != null) css.push(`margin-bottom:${a.spaceAfter}pt`);
  if (a.lineHeight != null) css.push(`line-height:${a.lineHeight}`);
  if (a.indentLeft != null) css.push(`margin-left:${a.indentLeft}pt`);
  if (a.indentFirst != null) css.push(`text-indent:${a.indentFirst}pt`);
  return css.join(";");
}

function paraFromDOM(dom: HTMLElement): Partial<ParaAttrs> {
  const st = dom.style;
  const align = st.textAlign as Align;
  return {
    align: (["left", "center", "right", "justify"] as string[]).includes(align) ? align : null,
    spaceBefore: toPt(st.marginTop),
    spaceAfter: toPt(st.marginBottom),
    lineHeight: num(st.lineHeight) && !/[a-z%]/i.test(st.lineHeight) ? num(st.lineHeight) : null,
    indentLeft: toPt(st.marginLeft),
    indentFirst: toPt(st.textIndent),
  };
}

const withStyle = (tag: string, attrs: Record<string, unknown>, extra: Record<string, string> = {}): DOMOutputSpec => {
  const style = paraStyle(attrs);
  return [tag, { ...extra, ...(style ? { style } : {}) }, 0];
};

const nodes: Record<string, NodeSpec> = {
  doc: { content: "block+" },

  paragraph: {
    content: "inline*",
    group: "block",
    attrs: { ...paraAttrs, pid: { default: null as string | null } },
    parseDOM: [{
      tag: "p",
      getAttrs: (d) => {
        const el = d as HTMLElement;
        return { ...paraFromDOM(el), pid: el.getAttribute("data-pid") || null };
      },
    }],
    toDOM: (n) => withStyle("p", n.attrs, n.attrs.pid ? { "data-pid": n.attrs.pid } : {}),
  },

  heading: {
    content: "inline*",
    group: "block",
    defining: true,
    attrs: { ...paraAttrs, level: { default: 1 }, pid: { default: null as string | null } },
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
      tag: `h${level}`,
      getAttrs: (d: HTMLElement | string) => {
        const el = d as HTMLElement;
        return { level, ...paraFromDOM(el), pid: el.getAttribute?.("data-pid") || null };
      },
    })),
    toDOM: (n) => withStyle(`h${n.attrs.level}`, n.attrs, n.attrs.pid ? { "data-pid": n.attrs.pid } : {}),
  },

  blockquote: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{ tag: "blockquote" }],
    toDOM: () => ["blockquote", 0],
  },

  code_block: {
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
    toDOM: () => ["pre", ["code", 0]],
  },

  horizontal_rule: {
    group: "block",
    parseDOM: [{ tag: "hr" }],
    toDOM: () => ["hr"],
  },

  page_break: {
    group: "block",
    atom: true,
    selectable: true,
    parseDOM: [{ tag: "div.wd-pagebreak" }],
    toDOM: () => ["div", { class: "wd-pagebreak", contenteditable: "false" }, ["span", "Quebra de página"]],
  },

  bullet_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM: () => ["ul", 0],
  },

  ordered_list: {
    content: "list_item+",
    group: "block",
    attrs: { order: { default: 1 } },
    parseDOM: [{ tag: "ol", getAttrs: (d) => ({ order: (d as HTMLElement).hasAttribute("start") ? +(d as HTMLElement).getAttribute("start")! : 1 }) }],
    toDOM: (n) => (n.attrs.order === 1 ? ["ol", 0] : ["ol", { start: n.attrs.order }, 0]),
  },

  list_item: {
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: "li" }],
    toDOM: () => ["li", 0],
  },

  image: {
    inline: true,
    group: "inline",
    draggable: true,
    attrs: { src: {}, alt: { default: null }, width: { default: null as number | null }, height: { default: null as number | null } },
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs: (d) => {
          const el = d as HTMLImageElement;
          return {
            src: el.getAttribute("src"),
            alt: el.getAttribute("alt"),
            width: num(el.getAttribute("width")) ?? num(el.style.width),
            height: num(el.getAttribute("height")) ?? num(el.style.height),
          };
        },
      },
    ],
    toDOM: (n) => {
      const { src, alt, width, height } = n.attrs;
      const style = [width ? `width:${width}px` : "", height ? `height:${height}px` : ""].filter(Boolean).join(";");
      return ["img", { src, ...(alt ? { alt } : {}), ...(style ? { style } : {}) }];
    },
  },

  hard_break: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM: () => ["br"],
  },

  text: { group: "inline" },

  ...tableNodes({
    tableGroup: "block",
    cellContent: "block+",
    cellAttributes: {
      background: {
        default: null,
        getFromDOM: (dom) => (dom as HTMLElement).style.backgroundColor || null,
        setDOMAttr: (value, attrs) => {
          if (value) attrs.style = `${attrs.style ?? ""};background-color:${value}`;
        },
      },
    },
  }),
};

const marks: Record<string, MarkSpec> = {
  bold: {
    parseDOM: [{ tag: "strong" }, { tag: "b" }, { style: "font-weight", getAttrs: (v) => /^(bold|[6-9]00)$/.test(v as string) && null }],
    toDOM: () => ["strong", 0],
  },
  italic: {
    parseDOM: [{ tag: "i" }, { tag: "em" }, { style: "font-style=italic" }],
    toDOM: () => ["em", 0],
  },
  underline: {
    parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
    toDOM: () => ["u", 0],
  },
  strike: {
    parseDOM: [{ tag: "s" }, { tag: "del" }, { tag: "strike" }, { style: "text-decoration=line-through" }],
    toDOM: () => ["s", 0],
  },
  sub: {
    excludes: "sup",
    parseDOM: [{ tag: "sub" }],
    toDOM: () => ["sub", 0],
  },
  sup: {
    excludes: "sub",
    parseDOM: [{ tag: "sup" }],
    toDOM: () => ["sup", 0],
  },
  code: {
    parseDOM: [{ tag: "code" }],
    toDOM: () => ["code", 0],
  },
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [{ tag: "a[href]", getAttrs: (d) => ({ href: (d as HTMLElement).getAttribute("href"), title: (d as HTMLElement).getAttribute("title") }) }],
    toDOM: (m) => ["a", { href: m.attrs.href, title: m.attrs.title, rel: "noopener noreferrer" }, 0],
  },
  font_family: {
    attrs: { name: {} },
    parseDOM: [
      {
        style: "font-family",
        getAttrs: (v) => ({ name: String(v).split(",")[0].replace(/["']/g, "").trim() }),
      },
    ],
    toDOM: (m) => ["span", { style: `font-family:'${m.attrs.name}'` }, 0],
  },
  font_size: {
    attrs: { size: {} },
    parseDOM: [{ style: "font-size", getAttrs: (v) => ({ size: toPt(String(v)) ?? 11 }) }],
    toDOM: (m) => ["span", { style: `font-size:${m.attrs.size}pt` }, 0],
  },
  text_color: {
    attrs: { color: {} },
    parseDOM: [{ style: "color", getAttrs: (v) => ({ color: String(v) }) }],
    toDOM: (m) => ["span", { style: `color:${m.attrs.color}` }, 0],
  },
  highlight: {
    attrs: { color: { default: "#ffe14d" } },
    parseDOM: [{ tag: "mark", getAttrs: (d) => ({ color: (d as HTMLElement).style.backgroundColor || "#ffe14d" }) }, { style: "background-color", getAttrs: (v) => ({ color: String(v) }) }],
    toDOM: (m) => ["mark", { style: `background-color:${m.attrs.color}` }, 0],
  },
};

export const schema = new Schema({ nodes, marks });

/** Documento vazio (um parágrafo). */
export function emptyDoc(): PMNode {
  return schema.node("doc", null, [schema.node("paragraph")]);
}

/** Texto puro do documento, um parágrafo por linha (busca, estatísticas, histórico). */
export function plainText(doc: PMNode): string {
  const out: string[] = [];
  doc.descendants((node) => {
    if (node.isTextblock) {
      out.push(node.textContent);
      return false;
    }
    return true;
  });
  return out.join("\n");
}

export const FONT_FAMILIES = [
  "Aptos",
  "Calibri",
  "Inter",
  "Arial",
  "Times New Roman",
  "Georgia",
  "Cambria",
  "Verdana",
  "Tahoma",
  "Segoe UI",
  "Trebuchet MS",
  "Garamond",
  "Courier New",
  "Consolas",
];

export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 60, 72];
