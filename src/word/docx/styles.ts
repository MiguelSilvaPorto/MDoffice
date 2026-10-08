// Estilos, numeração de listas e relações (rels) do .docx.

import { kids, first, attr, val, parseXml } from "./xml";
import { type RunProps, type ParaProps, readRPr, readPPr } from "./props";
import { type StyleDef, type Ctx } from "./context";

export function headingLevel(id: string, name: string): number | undefined {
  const n = name.toLowerCase();
  const m = /^heading\s*(\d)$/.exec(n) ?? /^t[ií]tulo\s*(\d)$/.exec(n) ?? /^heading(\d)$/i.exec(id) ?? /^t[ií]tulo(\d)$/i.exec(id);
  if (m) return Math.min(6, Math.max(1, +m[1]));
  if (n === "title" || n === "título" || n === "titulo") return 1;
  return undefined;
}

export function readStyles(doc: Document | null): { styles: Map<string, StyleDef>; defaults: RunProps; defaultPara: ParaProps } {
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
export function resolveStyle(ctx: Ctx, id: string | undefined): { run: RunProps; para: ParaProps; heading?: number } {
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

export function readNumbering(doc: Document | null): Map<string, { fmt: string; start: number }[]> {
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

export function readRels(text: string | null): Map<string, { target: string; external: boolean }> {
  const out = new Map<string, { target: string; external: boolean }>();
  if (!text) return out;
  for (const r of Array.from(parseXml(text).getElementsByTagName("Relationship"))) {
    out.set(r.getAttribute("Id") ?? "", { target: r.getAttribute("Target") ?? "", external: r.getAttribute("TargetMode") === "External" });
  }
  return out;
}
