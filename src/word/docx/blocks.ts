// Blocos do corpo: parágrafos, títulos, listas com níveis e tabelas.

import { schema } from "../schema";
import { type El, kids, first, attr, val } from "./xml";
import { type ParaProps, readPPr } from "./props";
import { type Ctx } from "./context";
import { resolveStyle } from "./styles";
import { readParagraphInlines } from "./inline";
import type { Node as PMNode } from "prosemirror-model";

export interface ListNode {
  ordered: boolean;
  start: number;
  items: { para: PMNode; sub: ListNode[] }[];
}

export function toPM(list: ListNode): PMNode {
  const items = list.items.map((it) => schema.nodes.list_item.create(null, [it.para, ...it.sub.map(toPM)]));
  return list.ordered ? schema.nodes.ordered_list.create({ order: list.start }, items) : schema.nodes.bullet_list.create(null, items);
}

export function paraAttrs(props: ParaProps, defaults: ParaProps, isHeading: boolean) {
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

export function readBlocks(ctx: Ctx, container: El): PMNode[] {
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

export function readTable(ctx: Ctx, tbl: El): PMNode | null {
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
