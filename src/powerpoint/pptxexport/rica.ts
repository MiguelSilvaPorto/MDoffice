// Escrita FIEL das lâminas: o inverso do importador. Gera o XML do PowerPoint (DrawingML) a partir das formas do
// modelo — geometria, preenchimento, contorno, sombra, imagem recortada, texto por trecho — sem passar pelo
// PptxGenJS (que não sabe de gradiente, formas livres nem formatação por trecho).
// O PptxGenJS continua montando o pacote (mestre, layout, tema, notas); este módulo só troca o conteúdo das lâminas.
import { aspectSize, type CustPath, type DeckSetup, type Fill, type Line, type Para, type Run, type Shape, type Slide } from "../schema";
import { coresTema } from "./theme";

const EMU_POL = 914400;
const EMU_PT = 12700;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emu = (n: number) => Math.round(n);
const hex = (c: string) => (c || "000000").replace(/^#/, "").toUpperCase().padEnd(6, "0").slice(0, 6);

/** Imagens que a lâmina usa: cada uma ganha um arquivo em ppt/media e uma relação na lâmina. */
export interface Midia {
  /** nome do arquivo dentro de ppt/media */
  arquivo: string;
  bytes: Uint8Array;
  ext: string;
}

export interface SaidaLamina {
  xml: string;
  /** relações (id -> arquivo em ppt/media) que o XML usa */
  imagens: { id: string; arquivo: string }[];
}

/** Contexto de escrita de todo o deck: mídia deduplicada entre as lâminas. */
export class Escritor {
  readonly midias: Midia[] = [];
  private porFonte = new Map<string, Midia>();
  readonly largEmu: number;
  readonly altEmu: number;

  constructor(private setup: DeckSetup) {
    const { w, h } = aspectSize(setup);
    this.largEmu = Math.round(w * EMU_POL);
    this.altEmu = Math.round(h * EMU_POL);
  }

  /** Registra uma imagem (media:ID ou data URL) e devolve o arquivo; undefined quando não dá para ler. */
  private arquivoDe(src: string): Midia | undefined {
    let m = this.porFonte.get(src);
    if (m) return m;
    const data = src.startsWith("media:") ? this.setup.media?.[src.slice(6)] : src;
    const r = data ? /^data:([^;,]+);base64,(.*)$/s.exec(data) : null;
    if (!r) return undefined;
    const mime = r[1];
    const ext = mime === "image/jpeg" ? "jpeg" : mime === "image/svg+xml" ? "svg" : mime === "image/gif" ? "gif" : mime === "image/webp" ? "webp" : mime === "image/bmp" ? "bmp" : "png";
    const bin = atob(r[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    m = { arquivo: `mdc${this.midias.length + 1}.${ext}`, bytes, ext };
    this.midias.push(m);
    this.porFonte.set(src, m);
    return m;
  }

  /** XML completo de uma lâmina. */
  lamina(s: Slide): SaidaLamina {
    const imagens: { id: string; arquivo: string }[] = [];
    const idImagem = (src: string): string | undefined => {
      const m = this.arquivoDe(src);
      if (!m) return undefined;
      let ex = imagens.find((i) => i.arquivo === m.arquivo);
      if (!ex) {
        ex = { id: `rIdM${imagens.length + 1}`, arquivo: m.arquivo };
        imagens.push(ex);
      }
      return ex.id;
    };
    const ctx: Ctx = { larg: this.largEmu, alt: this.altEmu, idImagem, setup: this.setup, seq: 1 };
    const bg = fillXml(s.bg ?? { kind: "solid", color: coresTema(this.setup).bg }, ctx);
    const formas = s.shapes.map((f) => formaXml(f, ctx)).join("");
    const xml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
      `<p:cSld><p:bg><p:bgPr>${bg}<a:effectLst/></p:bgPr></p:bg><p:spTree>` +
      `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
      `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
      formas +
      `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
    return { xml, imagens };
  }
}

interface Ctx {
  larg: number;
  alt: number;
  idImagem: (src: string) => string | undefined;
  setup: DeckSetup;
  seq: number;
}

// ---------------------------------------------------------------------------
// cor, preenchimento, contorno, sombra
// ---------------------------------------------------------------------------

function corXml(cor: string, alpha = 1): string {
  return alpha < 1 ? `<a:srgbClr val="${hex(cor)}"><a:alpha val="${Math.round(alpha * 100000)}"/></a:srgbClr>` : `<a:srgbClr val="${hex(cor)}"/>`;
}

function fillXml(f: Fill | undefined, ctx: Ctx): string {
  if (!f || f.kind === "none") return "<a:noFill/>";
  if (f.kind === "solid") return `<a:solidFill>${corXml(f.color ?? "000000", f.alpha ?? 1)}</a:solidFill>`;
  if (f.kind === "gradient" && f.stops?.length) {
    const gs = f.stops.map((p) => `<a:gs pos="${Math.round(p.pos * 1000)}">${corXml(p.color, p.alpha)}</a:gs>`).join("");
    const dir = f.radial
      ? `<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>`
      : `<a:lin ang="${Math.round((f.angle ?? 0) * 60000)}" scaled="0"/>`;
    return `<a:gradFill rotWithShape="1"><a:gsLst>${gs}</a:gsLst>${dir}</a:gradFill>`;
  }
  if (f.kind === "image" && f.src) {
    const id = ctx.idImagem(f.src);
    if (id) {
      const alfa = f.alpha !== undefined && f.alpha < 1 ? `<a:alphaModFix amt="${Math.round(f.alpha * 100000)}"/>` : "";
      const c = f.crop;
      const src = c ? `<a:srcRect l="${Math.round(c[0] * 1000)}" t="${Math.round(c[1] * 1000)}" r="${Math.round(c[2] * 1000)}" b="${Math.round(c[3] * 1000)}"/>` : "<a:srcRect/>";
      const i = f.inset;
      const rect = i ? `<a:fillRect l="${Math.round(i[0] * 1000)}" t="${Math.round(i[1] * 1000)}" r="${Math.round(i[2] * 1000)}" b="${Math.round(i[3] * 1000)}"/>` : "<a:fillRect/>";
      return `<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${id}">${alfa}</a:blip>${src}${f.tile ? "<a:tile/>" : `<a:stretch>${rect}</a:stretch>`}</a:blipFill>`;
    }
  }
  return "<a:noFill/>";
}

function lnXml(ln: Line | undefined): string {
  if (!ln || ln.w <= 0) return `<a:ln><a:noFill/></a:ln>`;
  const attrs = [`w="${Math.round(ln.w * EMU_PT)}"`];
  if (ln.cap) attrs.push(`cap="${ln.cap === "round" ? "rnd" : ln.cap === "square" ? "sq" : "flat"}"`);
  let dentro = `<a:solidFill>${corXml(ln.color, ln.alpha)}</a:solidFill>`;
  if (ln.dash && ln.dash !== "solid") dentro += `<a:prstDash val="${ln.dash}"/>`;
  dentro += ln.join === "round" ? "<a:round/>" : ln.join === "bevel" ? "<a:bevel/>" : ln.join === "miter" ? `<a:miter lim="800000"/>` : "";
  if (ln.head) dentro += `<a:headEnd type="${ln.head}"/>`;
  if (ln.tail) dentro += `<a:tailEnd type="${ln.tail}"/>`;
  return `<a:ln ${attrs.join(" ")}>${dentro}</a:ln>`;
}

function sombraXml(s: Shape): string {
  if (!s.shadow) return "";
  const sh = s.shadow;
  return (
    `<a:effectLst><a:outerShdw blurRad="${Math.round(sh.blur * EMU_PT)}" dist="${Math.round(sh.dist * EMU_PT)}" dir="${Math.round(sh.dir * 60000)}" algn="ctr" rotWithShape="0">` +
    `${corXml(sh.color, sh.alpha)}</a:outerShdw></a:effectLst>`
  );
}

// ---------------------------------------------------------------------------
// geometria
// ---------------------------------------------------------------------------

function pathsXml(paths: CustPath[]): string {
  const caminhos = paths
    .map((p) => {
      let d = "";
      const c = p.cmds;
      const pt = (x: number, y: number) => `<a:pt x="${Math.round(x)}" y="${Math.round(y)}"/>`;
      for (let i = 0; i < c.length; ) {
        const cmd = c[i++] as string;
        if (cmd === "M") d += `<a:moveTo>${pt(c[i++] as number, c[i++] as number)}</a:moveTo>`;
        else if (cmd === "L") d += `<a:lnTo>${pt(c[i++] as number, c[i++] as number)}</a:lnTo>`;
        else if (cmd === "C") d += `<a:cubicBezTo>${pt(c[i++] as number, c[i++] as number)}${pt(c[i++] as number, c[i++] as number)}${pt(c[i++] as number, c[i++] as number)}</a:cubicBezTo>`;
        else if (cmd === "Q") d += `<a:quadBezTo>${pt(c[i++] as number, c[i++] as number)}${pt(c[i++] as number, c[i++] as number)}</a:quadBezTo>`;
        else if (cmd === "A") d += `<a:arcTo wR="${Math.round(c[i++] as number)}" hR="${Math.round(c[i++] as number)}" stAng="${Math.round((c[i++] as number) * 60000)}" swAng="${Math.round((c[i++] as number) * 60000)}"/>`;
        else if (cmd === "Z") d += "<a:close/>";
        else break;
      }
      const attrs = [`w="${Math.round(p.w)}"`, `h="${Math.round(p.h)}"`];
      if (p.fill === "none") attrs.push(`fill="none"`);
      if (p.stroke === false) attrs.push(`stroke="0"`);
      return `<a:path ${attrs.join(" ")}>${d}</a:path>`;
    })
    .join("");
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst>${caminhos}</a:pathLst></a:custGeom>`;
}

function geomXml(s: Shape): string {
  if (s.paths?.length) return pathsXml(s.paths);
  const adj = s.adj ? Object.entries(s.adj).map(([k, v]) => `<a:gd name="${k}" fmla="val ${Math.round(v)}"/>`).join("") : "";
  return `<a:prstGeom prst="${s.geom && s.geom !== "custom" ? s.geom : "rect"}"><a:avLst>${adj}</a:avLst></a:prstGeom>`;
}

// ---------------------------------------------------------------------------
// texto
// ---------------------------------------------------------------------------

function runXml(r: Run): string {
  if (r.br) return `<a:br><a:rPr lang="pt-BR" sz="${Math.round(r.size * 100)}"/></a:br>`;
  const attrs = [`lang="pt-BR"`, `sz="${Math.round(r.size * 100)}"`, `b="${r.bold ? 1 : 0}"`, `i="${r.italic ? 1 : 0}"`];
  if (r.underline) attrs.push(`u="sng"`);
  if (r.strike) attrs.push(`strike="sngStrike"`);
  if (r.caps) attrs.push(`cap="all"`);
  if (r.spc) attrs.push(`spc="${Math.round(r.spc * 100)}"`);
  if (r.baseline) attrs.push(`baseline="${Math.round(r.baseline * 1000)}"`);
  const fonte = esc(r.font);
  return (
    `<a:r><a:rPr ${attrs.join(" ")}><a:solidFill>${corXml(r.color, r.alpha ?? 1)}</a:solidFill>` +
    `<a:latin typeface="${fonte}"/><a:ea typeface="${fonte}"/><a:cs typeface="${fonte}"/></a:rPr><a:t>${esc(r.text)}</a:t></a:r>`
  );
}

function paraXml(p: Para): string {
  const alinha = p.align === "centro" ? "ctr" : p.align === "direita" ? "r" : p.align === "justificado" ? "just" : "l";
  let pPr = "";
  if (p.lnSpc?.pct !== undefined) pPr += `<a:lnSpc><a:spcPct val="${Math.round(p.lnSpc.pct * 100000)}"/></a:lnSpc>`;
  else if (p.lnSpc?.pts !== undefined) pPr += `<a:lnSpc><a:spcPts val="${Math.round(p.lnSpc.pts * 100)}"/></a:lnSpc>`;
  pPr += `<a:spcBef><a:spcPts val="${Math.round(p.spcBef * 100)}"/></a:spcBef><a:spcAft><a:spcPts val="${Math.round(p.spcAft * 100)}"/></a:spcAft>`;
  const b = p.bullet;
  if (b) {
    if (b.color) pPr += `<a:buClr>${corXml(b.color)}</a:buClr>`;
    if (b.sizePct) pPr += `<a:buSzPct val="${Math.round(b.sizePct * 1000)}"/>`;
    if (b.font) pPr += `<a:buFont typeface="${esc(b.font)}"/>`;
    pPr += b.auto ? `<a:buAutoNum type="${b.auto}"${b.startAt && b.startAt > 1 ? ` startAt="${b.startAt}"` : ""}/>` : `<a:buChar char="${esc(b.char ?? "•")}"/>`;
  } else pPr += "<a:buNone/>";
  const attrs = `marL="${Math.round(p.marL * EMU_PT)}" indent="${Math.round(p.indent * EMU_PT)}" algn="${alinha}" lvl="${p.lvl}"`;
  const fim = `<a:endParaRPr lang="pt-BR" sz="${Math.round(p.endSize * 100)}"/>`;
  return `<a:p><a:pPr ${attrs}>${pPr}</a:pPr>${p.runs.map(runXml).join("")}${fim}</a:p>`;
}

function corpoXml(s: Shape, paras: Para[]): string {
  const ins = s.ins ?? [7.2, 3.6, 7.2, 3.6];
  const attrs = [
    `wrap="${s.wrap === false ? "none" : "square"}"`,
    `lIns="${Math.round(ins[0] * EMU_PT)}"`,
    `tIns="${Math.round(ins[1] * EMU_PT)}"`,
    `rIns="${Math.round(ins[2] * EMU_PT)}"`,
    `bIns="${Math.round(ins[3] * EMU_PT)}"`,
    `anchor="${s.anchor ?? "t"}"`,
    `rtlCol="0"`,
  ];
  if (s.vert) attrs.push(`vert="${s.vert}"`);
  return `<p:txBody><a:bodyPr ${attrs.join(" ")}><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras.map(paraXml).join("")}</p:txBody>`;
}

/** Forma criada no app (sem formatação por trecho): vira um parágrafo com o estilo único dela. */
function parasDeFormaSimples(s: Shape): Para[] {
  const linhas = (s.text || "").split("\n");
  // o app guarda o tamanho como o do palco; o PptxGenJS (caminho antigo) gravava 75% dele em pt
  const tam = Math.max(4, Math.round(s.fontSize * 0.75));
  return linhas.map((l) => ({
    runs: l ? [{ text: l, size: tam, bold: s.bold, italic: s.italic, underline: false, strike: false, color: hex(s.color), font: (s.fontFamily || "Arial").replace(/["']/g, "") }] : [],
    align: s.align,
    lvl: 0,
    marL: 0,
    indent: 0,
    spcBef: 0,
    spcAft: 0,
    endSize: tam,
  }));
}

// ---------------------------------------------------------------------------
// uma forma
// ---------------------------------------------------------------------------

function formaXml(s: Shape, ctx: Ctx): string {
  const id = ++ctx.seq;
  const nome = esc(s.name || `Forma ${id}`);
  const x = emu((s.box.x / 100) * ctx.larg);
  const y = emu((s.box.y / 100) * ctx.alt);
  const w = emu((s.box.w / 100) * ctx.larg);
  const h = emu((s.box.h / 100) * ctx.alt);
  const xfrm =
    `<a:xfrm${s.rot ? ` rot="${Math.round(s.rot * 60000)}"` : ""}${s.flipH ? ` flipH="1"` : ""}${s.flipV ? ` flipV="1"` : ""}>` +
    `<a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`;

  if (s.kind === "imagem" && s.src) {
    const rid = ctx.idImagem(s.src);
    if (rid) {
      const c = s.crop;
      const src = c ? `<a:srcRect l="${Math.round(c[0] * 1000)}" t="${Math.round(c[1] * 1000)}" r="${Math.round(c[2] * 1000)}" b="${Math.round(c[3] * 1000)}"/>` : "<a:srcRect/>";
      const alfa = s.opacity !== undefined && s.opacity < 1 ? `<a:alphaModFix amt="${Math.round(s.opacity * 100000)}"/>` : "";
      return (
        `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${nome}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
        `<p:blipFill><a:blip r:embed="${rid}">${alfa}</a:blip>${src}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
        `<p:spPr>${xfrm}${geomXml(s)}<a:noFill/>${lnXml(s.ln)}${sombraXml(s)}</p:spPr></p:pic>`
      );
    }
  }

  const rica = s.geom !== undefined;
  const paras = s.paras?.length ? s.paras : s.text ? parasDeFormaSimples(s) : [];
  let preench: string;
  if (rica) preench = fillXml(s.fillX, ctx);
  else preench = s.kind === "forma" && s.fill ? `<a:solidFill>${corXml(s.fill)}</a:solidFill>` : "<a:noFill/>";
  const ln = rica ? lnXml(s.ln) : s.kind === "forma" && s.fill ? `<a:ln><a:solidFill>${corXml(s.fill)}</a:solidFill></a:ln>` : `<a:ln><a:noFill/></a:ln>`;
  const semVisual = rica ? !s.fillX && !s.ln : !(s.kind === "forma" && s.fill);
  const txBox = paras.length && semVisual ? ` txBox="1"` : "";
  const corpo = paras.length ? corpoXml(s, paras) : "";
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${nome}"/><p:cNvSpPr${txBox}/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrm}${geomXml(s)}${preench}${ln}${sombraXml(s)}</p:spPr>${corpo}</p:sp>`
  );
}
