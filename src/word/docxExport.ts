// Exporta o documento do motor para um .docx de verdade (abre no Word, LibreOffice e Google Docs).
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingSide,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  WidthType,
  HeadingLevel,
  PageBreak,
  type IImageOptions,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";
import type { Mark, Node as PMNode } from "prosemirror-model";
import { HEADING_STYLE, CM_TO_PX, pageSizePx, type PageSetup, type PaperSize } from "./model";
import { dadosDaImagem, ehFlutuante, type DadosFlutuante } from "./imagemFlutuante";

type Block = Paragraph | Table;

/**
 * Medidas de cada papel em twips (1 cm = 567), retrato — as mesmas do `PAPER_SIZES` do modelo.
 * O Word lê `w:pgSz` da seção; trocar o papel aqui é o que faz o .docx abrir com A3/A2.
 */
const PAPER_TWIPS: Record<PaperSize, { width: number; height: number }> = {
  A5: { width: 8391, height: 11906 },
  A4: { width: 11906, height: 16838 },
  A3: { width: 16838, height: 23811 },
  A2: { width: 23811, height: 33676 },
  Letter: { width: 12240, height: 15840 },
};

interface Ctx {
  setup: PageSetup;
  listInstance: number;
}

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

const pt = (v: number) => Math.round(v * 20); // pontos → twips
const hex = (c: string): string | undefined => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (m) return (m[1].length === 3 ? m[1].replace(/./g, (d) => d + d) : m[1]).toUpperCase();
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(c.trim());
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return undefined;
};

function dataUrlBytes(url: string): { bytes: Uint8Array; type: "png" | "jpg" | "gif" | "bmp" } | null {
  const m = /^data:image\/([a-z0-9.+-]+)(;base64)?,(.*)$/is.exec(url);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const type = kind === "png" ? "png" : kind === "jpeg" || kind === "jpg" ? "jpg" : kind === "gif" ? "gif" : kind === "bmp" ? "bmp" : null;
  if (!type) return null;
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type };
}

/** SVG e WebP viram PNG para o Word aceitar. */
async function toPng(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || 400;
    c.height = img.naturalHeight || 300;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

function markValue(marks: readonly Mark[], name: string): Mark | undefined {
  return marks.find((m) => m.type.name === name);
}

/** EMU por pixel (1 px = 1/96 pol) — a unidade de posição do Word. */
const EMU_PX = 9525;

/**
 * A imagem flutuante no `.docx`: vira um desenho ANCORADO (`wp:anchor`), com a quebra de
 * texto e a posição que o app mostra. O contorno vai como `wrapTight`/`wrapThrough` — o Word
 * recalcula o contorno real do desenho quando a imagem é mexida lá.
 */
function flutuanteDoDocx(d: DadosFlutuante, ctx: Ctx, largura: number): NonNullable<IImageOptions["floating"]> {
  const s = ctx.setup;
  const conteudo = pageSizePx(s).w - Math.round((s.margins.left + s.margins.right) * CM_TO_PX);
  // posição horizontal a partir da coluna (a área de texto)
  let x = d.hOffset;
  if (d.hAlign === "center") x = Math.round((conteudo - largura) / 2) + d.hOffset;
  else if (d.hAlign === "right") x = conteudo - largura - d.hOffset;
  const folga = Math.max(0, Math.round(d.shapeMargin));
  const tipo =
    d.wrap === "contorno"
      ? TextWrappingType.TIGHT
      : d.wrap === "atravessar"
        ? TextWrappingType.THROUGH
        : d.wrap === "topo-base"
          ? TextWrappingType.TOP_AND_BOTTOM
          : d.wrap === "atras" || d.wrap === "frente"
            ? TextWrappingType.NONE
            : TextWrappingType.SQUARE;
  // de que lado o texto passa (o "Lados da Quebra" do Word)
  const lado =
    d.lados === "esquerda"
      ? TextWrappingSide.LEFT
      : d.lados === "direita"
        ? TextWrappingSide.RIGHT
        : TextWrappingSide.LARGEST;
  // "fixar na página": a altura conta do PAPEL (e não do parágrafo)
  const alturaNaPagina = Math.round((d.pageOffset + Math.round(s.margins.top * CM_TO_PX)) * EMU_PX);
  return {
    horizontalPosition: {
      relative: HorizontalPositionRelativeFrom.COLUMN,
      offset: Math.round(x * EMU_PX),
    },
    verticalPosition: d.fixa
      ? { relative: VerticalPositionRelativeFrom.PAGE, offset: alturaNaPagina }
      : { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round(d.vOffset * EMU_PX) },
    wrap: {
      type: tipo,
      side: lado,
      margins: { distL: folga * EMU_PX, distR: folga * EMU_PX },
    },
    // "atrás do texto": a imagem fica no fundo da página
    behindDocument: d.wrap === "atras",
    allowOverlap: true,
  };
}

async function inlineRuns(node: PMNode, ctx: Ctx): Promise<ParagraphChild[]> {
  const out: ParagraphChild[] = [];
  const pending: Promise<void>[] = [];
  const slots: ParagraphChild[][] = [];
  node.forEach((child) => {
    const slot: ParagraphChild[] = [];
    slots.push(slot);
    const marks = child.marks;
    if (child.isText) {
      const text = child.text ?? "";
      const family = markValue(marks, "font_family")?.attrs.name as string | undefined;
      const size = markValue(marks, "font_size")?.attrs.size as number | undefined;
      const color = markValue(marks, "text_color")?.attrs.color as string | undefined;
      const hl = markValue(marks, "highlight")?.attrs.color as string | undefined;
      const code = !!markValue(marks, "code");
      const base = {
        bold: !!markValue(marks, "bold") || undefined,
        italics: !!markValue(marks, "italic") || undefined,
        underline: markValue(marks, "underline") ? {} : undefined,
        strike: !!markValue(marks, "strike") || undefined,
        superScript: !!markValue(marks, "sup") || undefined,
        subScript: !!markValue(marks, "sub") || undefined,
        font: code ? "Consolas" : family,
        size: size ? Math.round(size * 2) : code ? 20 : undefined,
        color: color ? hex(color) : undefined,
        shading: hl ? { type: ShadingType.CLEAR, fill: hex(hl) ?? "FFFF00", color: "auto" } : code ? { type: ShadingType.CLEAR, fill: "EEF0F3", color: "auto" } : undefined,
      };
      const runs: ParagraphChild[] = [];
      text.split(/(\t)/).forEach((piece) => {
        if (piece === "\t") runs.push(new TextRun({ ...base, children: [new Tab()] }));
        else if (piece) runs.push(new TextRun({ ...base, text: piece }));
      });
      const link = markValue(marks, "link")?.attrs.href as string | undefined;
      if (link && /^(https?:|mailto:)/i.test(link)) {
        slot.push(new ExternalHyperlink({ link, children: runs as TextRun[] }));
      } else slot.push(...runs);
    } else if (child.type.name === "hard_break") {
      slot.push(new TextRun({ break: 1 }));
    } else if (child.type.name === "image") {
      pending.push(
        (async () => {
          let src = String(child.attrs.src);
          let data = dataUrlBytes(src);
          if (!data) {
            const png = await toPng(src);
            data = png ? dataUrlBytes(png) : null;
          }
          if (!data) {
            slot.push(new TextRun({ text: `[imagem${child.attrs.alt ? ": " + child.attrs.alt : ""}]`, italics: true, color: "888888" }));
            return;
          }
          let w = Number(child.attrs.width) || 0;
          let h = Number(child.attrs.height) || 0;
          if (!w || !h) {
            try {
              const im = new Image();
              im.src = src;
              await im.decode();
              w = im.naturalWidth;
              h = im.naturalHeight;
            } catch {
              w = 400;
              h = 300;
            }
          }
          const max = 600;
          const k = w > max ? max / w : 1;
          // imagem flutuante: vai ancorada no .docx, com a quebra de texto e a posição
          const dados = dadosDaImagem(child.attrs as Record<string, unknown>);
          const opcoes: IImageOptions = {
            type: data.type,
            data: data.bytes,
            transformation: { width: Math.round(w * k), height: Math.round(h * k) },
            ...(ehFlutuante(dados) ? { floating: flutuanteDoDocx(dados, ctx, Math.round(w * k)) } : {}),
          };
          slot.push(new ImageRun(opcoes));
          src = "";
        })()
      );
    }
  });
  await Promise.all(pending);
  for (const s of slots) out.push(...s);
  return out;
}

function alignOf(a: string | null): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  if (a === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

function spacingOf(attrs: Record<string, unknown>, headingLevel?: number) {
  const hs = headingLevel ? HEADING_STYLE[headingLevel] : undefined;
  const before = (attrs.spaceBefore as number | null) ?? hs?.before;
  const after = (attrs.spaceAfter as number | null) ?? hs?.after;
  const line = attrs.lineHeight as number | null;
  return {
    ...(before != null ? { before: pt(before) } : {}),
    ...(after != null ? { after: pt(after) } : {}),
    ...(line ? { line: Math.round(line * 240), lineRule: LineRuleType.AUTO } : {}),
  };
}

function indentOf(attrs: Record<string, unknown>, extraLeft = 0) {
  const left = ((attrs.indentLeft as number | null) ?? 0) + extraLeft;
  const right = attrs.indentRight as number | null;
  const first = attrs.indentFirst as number | null;
  return {
    ...(left ? { left: pt(left) } : {}),
    ...(right ? { right: pt(right) } : {}),
    ...(first ? (first < 0 ? { hanging: pt(-first) } : { firstLine: pt(first) }) : {}),
  };
}

async function paragraphFrom(node: PMNode, ctx: Ctx, extra: Partial<IParagraphOptions> = {}): Promise<Paragraph> {
  const isHeading = node.type.name === "heading";
  const level = isHeading ? Number(node.attrs.level) : undefined;
  return new Paragraph({
    heading: level ? HEADINGS[Math.min(6, Math.max(1, level)) - 1] : undefined,
    alignment: alignOf(node.attrs.align),
    spacing: spacingOf(node.attrs, level),
    indent: indentOf(node.attrs),
    children: await inlineRuns(node, ctx),
    ...extra,
  });
}

async function blocksOf(parent: PMNode, ctx: Ctx, quote = false): Promise<Block[]> {
  const out: Block[] = [];
  const kidsList: PMNode[] = [];
  parent.forEach((c) => kidsList.push(c));
  for (const node of kidsList) {
    switch (node.type.name) {
      case "paragraph":
      case "heading":
        out.push(
          await paragraphFrom(
            node,
            ctx,
            quote ? { indent: { left: 360 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: "A5B4FC", space: 10 } } } : {}
          )
        );
        break;
      case "blockquote":
        out.push(...(await blocksOf(node, ctx, true)));
        break;
      case "code_block": {
        const lines = node.textContent.replace(/\n$/, "").split("\n");
        lines.forEach((line, i) =>
          out.push(
            new Paragraph({
              children: [new TextRun({ text: line || " ", font: "Consolas", size: 19 })],
              shading: { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" },
              spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 160 : 0 },
              indent: { left: 120, right: 120 },
            })
          )
        );
        break;
      }
      case "horizontal_rule":
        out.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "9CA3AF", space: 1 } }, spacing: { before: 120, after: 160 } }));
        break;
      case "page_break":
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case "bullet_list":
      case "ordered_list":
        out.push(...(await listBlocks(node, ctx, 0)));
        break;
      case "table": {
        out.push(await tableFrom(node, ctx));
        // o Word exige um parágrafo entre duas tabelas e depois da última; nos outros casos não precisa
        const next = kidsList[kidsList.indexOf(node) + 1];
        if (!next || next.type.name === "table") out.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        break;
      }
      default:
        break;
    }
  }
  return out;
}

async function listBlocks(list: PMNode, ctx: Ctx, level: number): Promise<Block[]> {
  const out: Block[] = [];
  const ordered = list.type.name === "ordered_list";
  const instance = ++ctx.listInstance;
  const items: PMNode[] = [];
  list.forEach((c) => items.push(c));
  for (const item of items) {
    let firstPara = true;
    const parts: PMNode[] = [];
    item.forEach((c) => parts.push(c));
    for (const part of parts) {
      if (part.type.name === "bullet_list" || part.type.name === "ordered_list") {
        out.push(...(await listBlocks(part, ctx, level + 1)));
      } else if (part.type.name === "paragraph" && firstPara) {
        firstPara = false;
        out.push(
          await paragraphFrom(part, ctx, {
            indent: undefined,
            numbering: { reference: ordered ? "numbers" : "bullets", level: Math.min(level, 8), instance },
            spacing: { ...spacingOf(part.attrs), after: pt((part.attrs.spaceAfter as number | null) ?? 3) },
          })
        );
      } else {
        out.push(...(await blocksOf(schemaWrap(part), ctx)));
      }
    }
  }
  return out;
}

/** Embrulha um nó solto num "doc" falso só para reutilizar blocksOf. */
function schemaWrap(node: PMNode): PMNode {
  return node.type.schema.nodes.doc.create(null, [node]);
}

async function tableFrom(table: PMNode, ctx: Ctx): Promise<Table> {
  const rows: TableRow[] = [];
  const rowNodes: PMNode[] = [];
  table.forEach((r) => rowNodes.push(r));
  let maxCols = 1;
  for (const r of rowNodes) {
    let n = 0;
    r.forEach((c) => (n += Number(c.attrs.colspan) || 1));
    maxCols = Math.max(maxCols, n);
  }
  for (const r of rowNodes) {
    const cells: TableCell[] = [];
    const cellNodes: PMNode[] = [];
    r.forEach((c) => cellNodes.push(c));
    for (const c of cellNodes) {
      const span = Number(c.attrs.colspan) || 1;
      const bg = c.attrs.background ? hex(String(c.attrs.background)) : undefined;
      const content = await blocksOf(c, ctx);
      cells.push(
        new TableCell({
          columnSpan: span > 1 ? span : undefined,
          rowSpan: Number(c.attrs.rowspan) > 1 ? Number(c.attrs.rowspan) : undefined,
          width: { size: Math.floor((100 * span) / maxCols), type: WidthType.PERCENTAGE },
          shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: "auto" } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: content.length ? content : [new Paragraph({ children: [] })],
        })
      );
    }
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

const bulletLevels = Array.from({ length: 9 }, (_, level) => ({
  level,
  format: LevelFormat.BULLET,
  text: ["•", "◦", "▪"][level % 3],
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
}));

const numberLevels = Array.from({ length: 9 }, (_, level) => ({
  level,
  format: level % 3 === 1 ? LevelFormat.LOWER_LETTER : level % 3 === 2 ? LevelFormat.LOWER_ROMAN : LevelFormat.DECIMAL,
  text: `%${level + 1}.`,
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
}));

export async function exportDocx(doc: PMNode, setup: PageSetup, title = "Documento"): Promise<Uint8Array> {
  const ctx: Ctx = { setup, listInstance: 0 };
  const children = await blocksOf(doc, ctx);
  if (!children.length) children.push(new Paragraph({ children: [] }));

  const cm = (v: number) => Math.round(v * 567);
  // o papel escolhido no Configurar Página / na fita vai nas medidas da seção (twips; 1 cm = 567)
  const base = PAPER_TWIPS[setup.size] ?? PAPER_TWIPS.A4;

  const headers = setup.header.trim()
    ? {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: setup.header.replace(/\{pagina\}|\{total\}/gi, ""), color: "6B7280", size: 18 })] })],
        }),
      }
    : undefined;
  const footParts: ParagraphChild[] = [];
  if (setup.footer.trim()) footParts.push(new TextRun({ text: setup.footer.replace(/\{pagina\}|\{total\}/gi, ""), color: "6B7280", size: 18 }));
  if (setup.pageNumbers) {
    if (footParts.length) footParts.push(new TextRun({ text: "   ·   ", color: "6B7280", size: 18 }));
    footParts.push(new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], color: "6B7280", size: 18 }));
  }
  const footers = footParts.length ? { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: footParts })] }) } : undefined;

  const headingStyles = [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `Heading${n}`,
    name: `Heading ${n}`,
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { font: setup.defaultFont, bold: HEADING_STYLE[n].bold, italics: HEADING_STYLE[n].italic, size: HEADING_STYLE[n].size * 2, color: "1F2328" },
    paragraph: { spacing: { before: pt(HEADING_STYLE[n].before), after: pt(HEADING_STYLE[n].after) }, keepNext: true },
  }));

  const document = new Document({
    title,
    creator: "mdOffice",
    styles: {
      default: { document: { run: { font: setup.defaultFont, size: Math.round(setup.defaultSize * 2) }, paragraph: { spacing: { after: pt(6), line: 276, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: headingStyles,
    },
    numbering: {
      config: [
        { reference: "bullets", levels: bulletLevels },
        { reference: "numbers", levels: numberLevels },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: base.width, height: base.height, orientation: setup.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: cm(setup.margins.top), bottom: cm(setup.margins.bottom), left: cm(setup.margins.left), right: cm(setup.margins.right) },
          },
        },
        headers,
        footers,
        children,
      },
    ],
  });
  return new Uint8Array(await (await Packer.toBlob(document)).arrayBuffer());
}
