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

/**
 * Lê uma imagem ANCORADA do Word (`wp:anchor`): a quebra de texto, o lado e a posição.
 * O que o app não entende do arquivo (o contorno exato, por exemplo) entra pelo que o
 * Word grava — e o desenho volta a ser o do app.
 */
function leituraDaAncoragem(anchor: El, margemTopoPx = 0): Record<string, unknown> {
  const wrapEl =
    anchor.getElementsByTagName("wp:wrapTight")[0] ??
    anchor.getElementsByTagName("wp:wrapThrough")[0] ??
    anchor.getElementsByTagName("wp:wrapSquare")[0] ??
    anchor.getElementsByTagName("wp:wrapTopAndBottom")[0];
  const wrap = anchor.getElementsByTagName("wp:wrapTight")[0]
    ? "contorno"
    : anchor.getElementsByTagName("wp:wrapThrough")[0]
      ? "atravessar"
      : anchor.getElementsByTagName("wp:wrapTopAndBottom")[0]
        ? "topo-base"
        : anchor.getElementsByTagName("wp:wrapNone")[0]
          ? anchor.getAttribute("behindDoc") === "1"
            ? "atras"
            : "frente"
          : "quadrado";
  // de que lado o texto passa (o "Lados da Quebra" do Word)
  const lado = (wrapEl?.getAttribute("wrapText") || "").toLowerCase();
  const lados = lado === "left" ? "esquerda" : lado === "right" ? "direita" : "maior";
  const posH = anchor.getElementsByTagName("wp:positionH")[0];
  const align = posH?.getElementsByTagName("wp:align")[0]?.textContent?.trim().toLowerCase();
  const offH = posH?.getElementsByTagName("wp:posOffset")[0]?.textContent;
  const posV = anchor.getElementsByTagName("wp:positionV")[0];
  const offV = posV?.getElementsByTagName("wp:posOffset")[0]?.textContent;
  const hAlign = align === "right" ? "right" : align === "center" ? "center" : "left";
  const hOffset = offH ? Math.round(+offH / EMU_PER_PX) : 0;
  const vOffset = offV ? Math.round(+offV / EMU_PER_PX) : 0;
  // "fixar na página": a altura relativa ao PAPEL vira a altura dentro da página
  const fixa = (posV?.getAttribute("relativeFrom") || "").toLowerCase() === "page";
  const pageOffset = fixa ? Math.max(0, Math.round(vOffset - margemTopoPx)) : 0;
  return { wrap, hAlign, hOffset, vOffset: fixa ? 0 : vOffset, lados, fixa, pageOffset };
}

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
    const attrs: Record<string, unknown> = {
      src,
      alt: docPr?.getAttribute("descr") || null,
      width: cx ? Math.round(cx / EMU_PER_PX) : null,
      height: cy ? Math.round(cy / EMU_PER_PX) : null,
    };
    // ancorada (`wp:anchor`)? então a imagem é flutuante: a quebra e a posição voltam do arquivo
    const anchor = el.getElementsByTagName("wp:anchor")[0];
    if (anchor) Object.assign(attrs, leituraDaAncoragem(anchor, ctx.margemTopoPx ?? 0));
    return schema.nodes.image.create(attrs);
  };

  walk(p, null, {});
  return { parts, breaks };
}
