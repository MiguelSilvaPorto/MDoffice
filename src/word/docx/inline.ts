// Texto corrido de um parágrafo: runs, links, imagens e quebras de página.

import { type Mark } from "prosemirror-model";
import { schema } from "../schema";
import { type El, kids, first, attr, val } from "./xml";
import { type RunProps, readRPr } from "./props";
import { type Ctx } from "./context";
import { resolveStyle } from "./styles";
import type { Node as PMNode } from "prosemirror-model";

export const EMU_PER_PX = 9525;

export function marksFor(ctx: Ctx, props: RunProps, base: RunProps, link: string | null, isHeading: boolean): Mark[] {
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

export type Inline = PMNode;

/** Lê um parágrafo e devolve o texto em partes, separando onde há quebra de página. */
export function readParagraphInlines(ctx: Ctx, p: El, styleRun: RunProps, isHeading: boolean): { parts: Inline[][]; breaks: number } {
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
