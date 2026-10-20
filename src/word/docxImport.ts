// Importa um arquivo .docx do Word para o modelo do motor (documento + configuração da página).
// Lê: parágrafos e estilos, títulos, listas (com níveis), tabelas (colunas/linhas mescladas),
// imagens, links, quebras de página, tamanho/margens da página, cabeçalho e rodapé.
// As peças ficam em docx/: xml · props · context · styles · media · inline · blocks · page.
import JSZip from "jszip";
import { DEFAULT_SETUP, PAPER_SIZES, type PageSetup } from "./model";
import { schema } from "./schema";
import type { Node as PMNode } from "prosemirror-model";
import { first, attr, parseXml } from "./docx/xml";
import { type Ctx } from "./docx/context";
import { readStyles, resolveStyle, readNumbering, readRels } from "./docx/styles";
import { loadMedia } from "./docx/media";
import { readBlocks } from "./docx/blocks";
import { readHeaderFooter } from "./docx/page";

export async function importDocx(bytes: Uint8Array | ArrayBuffer): Promise<{ doc: PMNode; setup: PageSetup }> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Este arquivo não parece ser um documento (.docx).");
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
    // o papel mais PRÓXIMO do que veio no arquivo (A5, A4, A3, A2 ou Carta): um A3 importado não
    // pode virar A4 só porque a lista antiga tinha dois tamanhos
    setup.size = PAPER_SIZES.reduce((melhor, p) => (Math.abs(p.w - short) < Math.abs(melhor.w - short) ? p : melhor), PAPER_SIZES[1]).id;
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
