// Propriedades de texto (negrito, cor, fonte…) e de parágrafo (alinhamento, espaçamento, recuo).

import { type Align } from "../schema";
import { type El, first, attr, val, on, twipsToPt, HIGHLIGHT } from "./xml";

export interface RunProps {
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

export interface ParaProps {
  align?: Align;
  before?: number;
  after?: number;
  line?: number;
  left?: number;
  right?: number;
  first?: number;
  numId?: string;
  ilvl?: number;
  styleId?: string;
  pageBreakBefore?: boolean;
}

export function readRPr(rPr: El | null): RunProps {
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

export function readPPr(pPr: El | null): ParaProps {
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
    const right = twipsToPt(attr(ind, "w:right") ?? attr(ind, "w:end"));
    const firstLine = twipsToPt(attr(ind, "w:firstLine"));
    const hanging = twipsToPt(attr(ind, "w:hanging"));
    if (left != null) p.left = left;
    if (right != null) p.right = right;
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
