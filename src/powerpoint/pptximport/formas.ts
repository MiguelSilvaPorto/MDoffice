// Formas de uma lâmina do .pptx -> Shape do modelo: posição exata (com grupos aplicados), geometria, preenchimento,
// contorno, sombra, imagem recortada e texto formatado. Placeholders herdam do layout e do mestre.
import type { CustPath, Fill, GradStop, Line, Shadow, Shape } from "../schema";
import { corDentro, resolverCor, type ContextoCor, type CorResolvida, type Tema } from "./cores";
import { mimeDe, paraDataUrl, Pacote, type Relacao } from "./pacote";
import { estiloDoMestre, lerParagrafos, lerRProps, textoPuro, type RProps } from "./texto";
import { caminho, filho, filhos, num, type No } from "./xmltree";

const EMU_PT = 12700;

/** Tudo que a leitura de uma lâmina precisa saber. */
export interface CtxForma {
  pac: Pacote;
  tema: Tema;
  mapa: Record<string, string>;
  /** tamanho da lâmina em EMU */
  larg: number;
  alt: number;
  /** mídia deduplicada: caminho no zip -> id; e o conteúdo por id */
  midiaIds: Map<string, string>;
  midia: Record<string, string>;
  avisos: Set<string>;
  /** estilo padrão de texto da apresentação (defaultTextStyle) */
  textoPadrao: No | undefined;
  mestre: No | undefined;
  /** placeholders do layout e do mestre (para herdar posição e estilo) */
  layoutTree: No | undefined;
  mestreTree: No | undefined;
  /** parte que está sendo lida e suas relações (para achar imagens) */
  parte: string;
  rels: Map<string, Relacao>;
  numeroSlide: number;
  /** contador para ids únicos de forma */
  seq: { n: number };
  /** formas que o importador não desenhou, com o motivo (diagnóstico) */
  descartes: string[];
}

export function ctxCor(c: CtxForma, phClr?: CorResolvida): ContextoCor {
  return { tema: c.tema, mapa: c.mapa, phClr };
}

// ---------------------------------------------------------------------------
// placeholders
// ---------------------------------------------------------------------------

function tipoNorm(t: string | undefined): string {
  if (!t) return "body";
  if (t === "ctrTitle") return "title";
  if (t === "subTitle") return "body";
  return t;
}

/** Acha, numa árvore de layout/mestre, o placeholder correspondente ao da forma. */
function acharPh(arvore: No | undefined, ph: No): No | undefined {
  if (!arvore) return undefined;
  const lista = filhos(arvore, "sp");
  const idx = ph.a.idx;
  if (idx !== undefined) {
    const porIdx = lista.find((sp) => caminho(sp, "nvSpPr/nvPr/ph")?.a.idx === idx);
    if (porIdx) return porIdx;
  }
  const t = tipoNorm(ph.a.type);
  return lista.find((sp) => {
    const p = caminho(sp, "nvSpPr/nvPr/ph");
    return p && tipoNorm(p.a.type) === t && (idx === undefined || p.a.idx === undefined || t !== "body");
  });
}

// ---------------------------------------------------------------------------
// transformações (grupos)
// ---------------------------------------------------------------------------

interface Xf {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

interface Grupo {
  off: { x: number; y: number };
  ext: { w: number; h: number };
  chOff: { x: number; y: number };
  chExt: { w: number; h: number };
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

function lerXfrm(no: No | undefined): Xf | undefined {
  const x = filho(no, "xfrm");
  if (!x) return undefined;
  const off = filho(x, "off");
  const ext = filho(x, "ext");
  if (!off || !ext) return undefined;
  return {
    x: num(off, "x"),
    y: num(off, "y"),
    w: num(ext, "cx"),
    h: num(ext, "cy"),
    rot: num(x, "rot") / 60000,
    flipH: x.a.flipH === "1" || x.a.flipH === "true",
    flipV: x.a.flipV === "1" || x.a.flipV === "true",
  };
}

function lerGrupo(no: No | undefined): Grupo | undefined {
  const x = filho(no, "xfrm");
  if (!x) return undefined;
  const off = filho(x, "off");
  const ext = filho(x, "ext");
  const chOff = filho(x, "chOff");
  const chExt = filho(x, "chExt");
  if (!off || !ext) return undefined;
  const ew = num(ext, "cx");
  const eh = num(ext, "cy");
  return {
    off: { x: num(off, "x"), y: num(off, "y") },
    ext: { w: ew, h: eh },
    chOff: { x: num(chOff, "x"), y: num(chOff, "y") },
    chExt: { w: num(chExt, "cx") || ew, h: num(chExt, "cy") || eh },
    rot: num(x, "rot") / 60000,
    flipH: x.a.flipH === "1" || x.a.flipH === "true",
    flipV: x.a.flipV === "1" || x.a.flipV === "true",
  };
}

/** Leva um retângulo do espaço de filhos de um grupo para o espaço do pai. */
function aplicarGrupo(xf: Xf, g: Grupo): Xf {
  const sx = g.chExt.w ? g.ext.w / g.chExt.w : 1;
  const sy = g.chExt.h ? g.ext.h / g.chExt.h : 1;
  let x = g.off.x + (xf.x - g.chOff.x) * sx;
  let y = g.off.y + (xf.y - g.chOff.y) * sy;
  const w = xf.w * sx;
  const h = xf.h * sy;
  let flipH = xf.flipH;
  let flipV = xf.flipV;
  let rot = xf.rot;
  if (g.flipH) {
    x = g.off.x + g.ext.w - (x - g.off.x) - w;
    flipH = !flipH;
    rot = -rot;
  }
  if (g.flipV) {
    y = g.off.y + g.ext.h - (y - g.off.y) - h;
    flipV = !flipV;
    rot = -rot;
  }
  if (g.rot) {
    // gira o centro da forma em torno do centro do grupo
    const gcx = g.off.x + g.ext.w / 2;
    const gcy = g.off.y + g.ext.h / 2;
    const cx = x + w / 2 - gcx;
    const cy = y + h / 2 - gcy;
    const a = (g.rot * Math.PI) / 180;
    const nx = cx * Math.cos(a) - cy * Math.sin(a);
    const ny = cx * Math.sin(a) + cy * Math.cos(a);
    x = gcx + nx - w / 2;
    y = gcy + ny - h / 2;
    rot += g.rot;
  }
  return { x, y, w, h, rot: ((rot % 360) + 360) % 360, flipH, flipV };
}

// ---------------------------------------------------------------------------
// preenchimento, contorno, efeitos
// ---------------------------------------------------------------------------

function lerGradiente(no: No, cc: ContextoCor): Fill | undefined {
  const stops: GradStop[] = [];
  for (const gs of filhos(filho(no, "gsLst"), "gs")) {
    const cor = corDentro(gs, cc);
    if (cor) stops.push({ pos: num(gs, "pos") / 1000, color: cor.hex, alpha: cor.alpha });
  }
  if (!stops.length) return undefined;
  stops.sort((a, b) => a.pos - b.pos);
  const lin = filho(no, "lin");
  const path = filho(no, "path");
  const f: Fill = { kind: "gradient", stops };
  if (path) f.radial = true;
  else f.angle = lin ? num(lin, "ang") / 60000 : 0;
  return f;
}

async function lerImagemFill(no: No, c: CtxForma): Promise<Fill | undefined> {
  const blip = filho(no, "blip");
  const src = await registrarImagem(blip?.a["r:embed"], c);
  if (!src) return undefined;
  const f: Fill = { kind: "image", src };
  if (filho(no, "tile")) f.tile = true;
  const fr = filho(filho(no, "stretch"), "fillRect");
  if (fr) {
    const inset: [number, number, number, number] = [num(fr, "l") / 1000, num(fr, "t") / 1000, num(fr, "r") / 1000, num(fr, "b") / 1000];
    if (inset.some((v) => v !== 0)) f.inset = inset;
  }
  const sr = filho(no, "srcRect");
  if (sr) {
    const crop: [number, number, number, number] = [num(sr, "l") / 1000, num(sr, "t") / 1000, num(sr, "r") / 1000, num(sr, "b") / 1000];
    if (crop.some((v) => v !== 0)) f.crop = crop;
  }
  const a = num(filho(blip, "alphaModFix"), "amt", 100000) / 100000;
  if (a < 1) f.alpha = a;
  return f;
}

/** Lê o preenchimento declarado num nó (spPr/bgPr). undefined = nada declarado (herdar). */
export async function lerPreenchimento(no: No | undefined, c: CtxForma, phClr?: CorResolvida): Promise<Fill | undefined> {
  if (!no) return undefined;
  const cc = ctxCor(c, phClr);
  for (const f of no.c) {
    switch (f.n) {
      case "noFill":
        return { kind: "none" };
      case "solidFill": {
        const cor = corDentro(f, cc);
        return cor ? { kind: "solid", color: cor.hex, alpha: cor.alpha } : undefined;
      }
      case "gradFill":
        return lerGradiente(f, cc);
      case "blipFill":
        return await lerImagemFill(f, c);
      case "pattFill": {
        const cor = resolverCor(filho(f, "fgClr")?.c[0], cc);
        return cor ? { kind: "solid", color: cor.hex, alpha: cor.alpha } : undefined;
      }
    }
  }
  return undefined;
}

const DASH: Record<string, Line["dash"]> = {
  solid: "solid",
  dash: "dash",
  sysDash: "sysDash",
  dot: "dot",
  sysDot: "sysDot",
  dashDot: "dashDot",
  sysDashDot: "dashDot",
  lgDash: "lgDash",
  lgDashDot: "dashDot",
  lgDashDotDot: "dashDot",
  sysDashDotDot: "dashDot",
};

function lerContorno(ln: No | undefined, cc: ContextoCor, base?: Line): Line | null | undefined {
  if (!ln) return base;
  if (filho(ln, "noFill")) return null;
  const out: Line = { color: base?.color ?? "000000", alpha: base?.alpha ?? 1, w: base?.w ?? 0.75, ...(base ?? {}) };
  if (ln.a.w !== undefined) out.w = num(ln, "w") / EMU_PT;
  const sf = filho(ln, "solidFill");
  if (sf) {
    const cor = corDentro(sf, cc);
    if (cor) {
      out.color = cor.hex;
      out.alpha = cor.alpha;
    }
  } else {
    const gf = filho(ln, "gradFill");
    const g = gf ? lerGradiente(gf, cc) : undefined;
    if (g?.stops?.[0]) {
      out.color = g.stops[0].color;
      out.alpha = g.stops[0].alpha;
    } else if (!base) {
      // contorno declarado sem cor e sem estilo: PowerPoint não desenha
      if (ln.a.w === undefined) return base;
    }
  }
  const pd = filho(ln, "prstDash")?.a.val;
  if (pd) out.dash = DASH[pd] ?? "dash";
  if (ln.a.cap) out.cap = ln.a.cap === "rnd" ? "round" : ln.a.cap === "sq" ? "square" : "flat";
  if (filho(ln, "round")) out.join = "round";
  else if (filho(ln, "bevel")) out.join = "bevel";
  else if (filho(ln, "miter")) out.join = "miter";
  const ponta = (n: string): Line["head"] => {
    const t = filho(ln, n)?.a.type;
    if (!t || t === "none") return undefined;
    return t === "triangle" || t === "arrow" || t === "stealth" || t === "diamond" || t === "oval" ? t : "triangle";
  };
  const h = ponta("headEnd");
  const t = ponta("tailEnd");
  if (h) out.head = h;
  if (t) out.tail = t;
  return out;
}

function lerSombra(efeitos: No | undefined, cc: ContextoCor): Shadow | undefined {
  const sh = filho(efeitos, "outerShdw");
  if (!sh) return undefined;
  const cor = corDentro(sh, cc) ?? { hex: "000000", alpha: 0.4 };
  return {
    color: cor.hex,
    alpha: cor.alpha,
    blur: num(sh, "blurRad") / EMU_PT,
    dist: num(sh, "dist") / EMU_PT,
    dir: num(sh, "dir") / 60000,
  };
}

// ---------------------------------------------------------------------------
// imagens
// ---------------------------------------------------------------------------

async function registrarImagem(rId: string | undefined, c: CtxForma): Promise<string | undefined> {
  if (!rId) return undefined;
  const rel = c.rels.get(rId);
  if (!rel || rel.externo) return undefined;
  const mime = mimeDe(rel.alvo);
  if (mime === "image/x-emf" || mime === "image/x-wmf") {
    c.avisos.add(`Imagem ${rel.alvo.split("/").pop()}: formato ${rel.alvo.split(".").pop()?.toUpperCase()} (vetorial do Windows) ainda não é exibido`);
    return undefined;
  }
  let id = c.midiaIds.get(rel.alvo);
  if (!id) {
    const bytes = await c.pac.bytes(rel.alvo);
    if (!bytes) return undefined;
    id = `m${c.midiaIds.size + 1}`;
    c.midiaIds.set(rel.alvo, id);
    c.midia[id] = paraDataUrl(bytes, mime);
  }
  return `media:${id}`;
}

// ---------------------------------------------------------------------------
// geometria livre
// ---------------------------------------------------------------------------

function lerCustGeom(cg: No, c: CtxForma, caixa: Xf): CustPath[] {
  const out: CustPath[] = [];
  const valor = (v: string | undefined): number => {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    c.avisos.add("Geometria livre com fórmulas (guias) foi simplificada");
    return 0;
  };
  for (const p of filhos(filho(cg, "pathLst"), "path")) {
    const w = num(p, "w") || caixa.w;
    const h = num(p, "h") || caixa.h;
    const cmds: (string | number)[] = [];
    const pt = (n: No | undefined) => [valor(n?.a.x), valor(n?.a.y)];
    for (const k of p.c) {
      if (k.n === "moveTo") cmds.push("M", ...pt(filho(k, "pt")));
      else if (k.n === "lnTo") cmds.push("L", ...pt(filho(k, "pt")));
      else if (k.n === "cubicBezTo") {
        const [a, b, d] = filhos(k, "pt");
        cmds.push("C", ...pt(a), ...pt(b), ...pt(d));
      } else if (k.n === "quadBezTo") {
        const [a, b] = filhos(k, "pt");
        cmds.push("Q", ...pt(a), ...pt(b));
      } else if (k.n === "arcTo") cmds.push("A", valor(k.a.wR), valor(k.a.hR), num(k, "stAng") / 60000, num(k, "swAng") / 60000);
      else if (k.n === "close") cmds.push("Z");
    }
    const cp: CustPath = { w, h, cmds };
    if (p.a.fill) cp.fill = p.a.fill as CustPath["fill"];
    if (p.a.stroke === "0" || p.a.stroke === "false") cp.stroke = false;
    out.push(cp);
  }
  return out;
}

// ---------------------------------------------------------------------------
// uma forma
// ---------------------------------------------------------------------------

interface Heranca {
  /** nós <p:sp> do layout e do mestre correspondentes ao placeholder da forma */
  layout?: No;
  mestre?: No;
}

function mesclarBodyPr(...lista: (No | undefined)[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of lista) if (b) Object.assign(out, b.a);
  return out;
}

function gdValores(av: No | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const gd of filhos(av, "gd")) {
    const m = /^val\s+(-?\d+)/.exec(gd.a.fmla ?? "");
    if (m && gd.a.name) out[gd.a.name] = Number(m[1]);
  }
  return out;
}

async function lerForma(no: No, c: CtxForma, grupos: Grupo[], fixa: boolean, visual: "sp" | "pic" | "cxn"): Promise<Shape | undefined> {
  const nv = filho(no, visual === "sp" ? "nvSpPr" : visual === "pic" ? "nvPicPr" : "nvCxnSpPr");
  const cNv = filho(nv, "cNvPr");
  if (cNv?.a.hidden === "1") {
    c.descartes.push(`${cNv.a.name ?? "?"}: oculta`);
    return undefined;
  }
  const nome = cNv?.a.name ?? "";
  const ph = caminho(nv, "nvPr/ph");
  const heranca: Heranca = {};
  if (ph) {
    heranca.layout = acharPh(c.layoutTree, ph);
    const phLayout = caminho(heranca.layout, "nvSpPr/nvPr/ph");
    heranca.mestre = acharPh(c.mestreTree, phLayout ?? ph);
  }

  const spPr = filho(no, "spPr");
  let xf = lerXfrm(spPr) ?? lerXfrm(filho(heranca.layout, "spPr")) ?? lerXfrm(filho(heranca.mestre, "spPr"));
  if (!xf) {
    c.descartes.push(`${nome}: sem posição`);
    return undefined;
  }
  for (let i = grupos.length - 1; i >= 0; i--) xf = aplicarGrupo(xf, grupos[i]);

  const estilo = filho(no, "style");
  const refCor = (ref: No | undefined): CorResolvida | undefined => corDentro(ref, ctxCor(c));

  // ---- geometria ----
  const prst = filho(spPr, "prstGeom") ?? filho(filho(heranca.layout, "spPr"), "prstGeom") ?? filho(filho(heranca.mestre, "spPr"), "prstGeom");
  const cust = filho(spPr, "custGeom");
  const forma: Shape = {
    id: `s${++c.seq.n}`,
    kind: visual === "pic" ? "imagem" : "forma",
    box: { x: (xf.x / c.larg) * 100, y: (xf.y / c.alt) * 100, w: (xf.w / c.larg) * 100, h: (xf.h / c.alt) * 100 },
    text: "",
    fontFamily: c.tema.fonteMenor,
    fontSize: 18,
    color: "000000",
    bold: false,
    italic: false,
    align: "esquerda",
    fill: "",
    src: "",
    rot: xf.rot,
    name: nome,
    geom: visual === "cxn" && !prst ? "line" : (prst?.a.prst ?? "rect"),
    sizePt: [xf.w / EMU_PT, xf.h / EMU_PT],
  };
  if (xf.flipH) forma.flipH = true;
  if (xf.flipV) forma.flipV = true;
  if (fixa) forma.fixa = true;
  const adj = gdValores(filho(prst, "avLst"));
  if (Object.keys(adj).length) forma.adj = adj;
  if (cust) {
    forma.paths = lerCustGeom(cust, c, xf);
    forma.geom = "custom";
  }

  // ---- preenchimento ----
  const fillRef = filho(estilo, "fillRef");
  const phCorEstilo = refCor(fillRef);
  let fillX: Fill | undefined;
  if (visual !== "pic") {
    fillX = await lerPreenchimento(spPr, c);
    if (!fillX) fillX = await lerPreenchimento(filho(heranca.layout, "spPr"), c);
    if (!fillX) fillX = await lerPreenchimento(filho(heranca.mestre, "spPr"), c);
    if (!fillX && fillRef) {
      const idx = num(fillRef, "idx");
      if (idx === 0) fillX = { kind: "none" };
      else if (idx >= 1 && idx <= 999) {
        const est = idx >= 1001 ? c.tema.fundos[idx - 1001] : c.tema.preenchimentos[idx - 1];
        if (est) fillX = await lerPreenchimento({ n: "x", a: {}, c: [est], t: "" }, c, phCorEstilo);
      }
    }
    if (fillX && fillX.kind !== "none") forma.fillX = fillX;
    if (fillX?.kind === "solid" && fillX.color) forma.fill = fillX.color;
  } else {
    const bf = filho(no, "blipFill");
    const img = bf ? await lerImagemFill(bf, c) : undefined;
    if (!img?.src) {
      if (bf) c.avisos.add("Imagem não pôde ser carregada");
      return undefined;
    }
    forma.src = img.src;
    if (img.alpha !== undefined) forma.opacity = img.alpha;
    const sr = filho(bf, "srcRect");
    if (sr) {
      const crop: [number, number, number, number] = [num(sr, "l") / 1000, num(sr, "t") / 1000, num(sr, "r") / 1000, num(sr, "b") / 1000];
      if (crop.some((v) => v !== 0)) forma.crop = crop;
    }
  }

  // ---- contorno ----
  const lnRef = filho(estilo, "lnRef");
  let base: Line | undefined;
  if (lnRef && num(lnRef, "idx") > 0) {
    const est = c.tema.contornos[num(lnRef, "idx") - 1];
    const cor = refCor(lnRef) ?? { hex: "000000", alpha: 1 };
    if (est) base = (lerContorno(est, ctxCor(c, cor)) as Line | undefined) ?? undefined;
    if (base && !est.c.some((k) => k.n === "solidFill")) base = { ...base, color: cor.hex, alpha: cor.alpha };
  }
  const lnHer = filho(filho(heranca.layout, "spPr"), "ln") ?? filho(filho(heranca.mestre, "spPr"), "ln");
  const lnNo = filho(spPr, "ln") ?? lnHer;
  const ln = lerContorno(lnNo, ctxCor(c, refCor(lnRef)), base);
  if (ln) forma.ln = ln;

  // ---- efeitos ----
  const sombra = lerSombra(filho(spPr, "effectLst"), ctxCor(c));
  if (sombra) forma.shadow = sombra;
  else if (!filho(spPr, "effectLst")) {
    const effRef = filho(estilo, "effectRef");
    const idx = num(effRef, "idx");
    if (idx > 0) {
      const est = c.tema.efeitos[idx - 1];
      const s = lerSombra(filho(est, "effectLst"), ctxCor(c, refCor(effRef)));
      if (s) forma.shadow = s;
    }
  }

  // ---- texto ----
  const corpo = filho(no, "txBody");
  if (corpo && visual === "sp") {
    const tipoPh = ph?.a.type;
    const camadas: (No | undefined)[] = [c.textoPadrao];
    if (ph) {
      camadas.push(estiloDoMestre(c.mestre, tipoNorm(tipoPh) === "title" ? "title" : tipoPh));
      camadas.push(filho(filho(heranca.mestre, "txBody"), "lstStyle"));
      camadas.push(filho(filho(heranca.layout, "txBody"), "lstStyle"));
    }
    camadas.push(filho(corpo, "lstStyle"));
    const bodyPr = mesclarBodyPr(
      filho(filho(heranca.mestre, "txBody"), "bodyPr"),
      filho(filho(heranca.layout, "txBody"), "bodyPr"),
      filho(corpo, "bodyPr")
    );
    const fontRef = filho(estilo, "fontRef");
    let fr: RProps | undefined;
    if (fontRef) {
      fr = {};
      const cor = refCor(fontRef);
      if (cor) fr.cor = cor;
      if (fontRef.a.idx === "major") fr.font = c.tema.fonteMaior;
      else if (fontRef.a.idx === "minor") fr.font = c.tema.fonteMenor;
    }
    const norm = filho(filho(corpo, "bodyPr"), "normAutofit") ?? filho(filho(filho(heranca.layout, "txBody"), "bodyPr"), "normAutofit");
    const escala = norm?.a.fontScale ? num(norm, "fontScale") / 100000 : 1;
    const reducao = norm?.a.lnSpcReduction ? num(norm, "lnSpcReduction") / 100000 : 0;
    const paras = lerParagrafos(corpo, ctxCor(c), { camadas, fontRef: fr, escala, reducaoEsp: reducao, numeroSlide: c.numeroSlide });
    const texto = textoPuro(paras);
    if (texto.trim() !== "") {
      forma.paras = paras;
      forma.text = texto;
      const primeiro = paras.find((p) => p.runs.length)?.runs[0];
      if (primeiro) {
        forma.fontFamily = primeiro.font;
        forma.fontSize = primeiro.size;
        forma.color = primeiro.color;
        forma.bold = primeiro.bold;
        forma.italic = primeiro.italic;
      }
      forma.align = paras[0]?.align ?? "esquerda";
      forma.kind = forma.fillX || forma.ln ? "forma" : "texto";
    }
    const ins = (k: string, pad: number) => (bodyPr[k] !== undefined ? Number(bodyPr[k]) : pad) / EMU_PT;
    forma.ins = [ins("lIns", 91440), ins("tIns", 45720), ins("rIns", 91440), ins("bIns", 45720)];
    forma.anchor = bodyPr.anchor === "ctr" ? "ctr" : bodyPr.anchor === "b" ? "b" : "t";
    if (bodyPr.wrap === "none") forma.wrap = false;
    if (bodyPr.vert === "vert" || bodyPr.vert === "vert270" || bodyPr.vert === "eaVert") forma.vert = bodyPr.vert;
  }

  // forma sem nada visível: não entra
  const visivel = forma.kind === "imagem" || forma.fillX || forma.ln || forma.paras;
  if (!visivel) {
    c.descartes.push(`${nome} (${forma.geom}): sem preenchimento, contorno nem texto`);
    return undefined;
  }
  return forma;
}

/** Lê os filhos de uma árvore de formas (spTree ou grpSp) na ordem do documento. */
export async function lerArvore(arvore: No, c: CtxForma, fixa = false, grupos: Grupo[] = []): Promise<Shape[]> {
  const out: Shape[] = [];
  for (const no of arvore.c) {
    switch (no.n) {
      case "sp": {
        // placeholders do layout/mestre decoram só quando vistos de dentro deles (fixa) e são vazios: ignorados
        if (fixa && caminho(no, "nvSpPr/nvPr/ph")) break;
        const f = await lerForma(no, c, grupos, fixa, "sp");
        if (f) out.push(f);
        break;
      }
      case "pic": {
        const f = await lerForma(no, c, grupos, fixa, "pic");
        if (f) out.push(f);
        break;
      }
      case "cxnSp": {
        const f = await lerForma(no, c, grupos, fixa, "cxn");
        if (f) out.push(f);
        break;
      }
      case "grpSp": {
        const g = lerGrupo(filho(no, "grpSpPr"));
        out.push(...(await lerArvore(no, c, fixa, g ? [...grupos, g] : grupos)));
        break;
      }
      case "graphicFrame": {
        const uri = caminho(no, "graphic/graphicData")?.a.uri ?? "";
        c.avisos.add(
          uri.includes("table") ? "Tabela: ainda não é exibida" : uri.includes("chart") ? "Gráfico: ainda não é exibido" : uri.includes("diagram") ? "Diagrama SmartArt: ainda não é exibido" : "Objeto incorporado: ainda não é exibido"
        );
        break;
      }
      case "AlternateContent": {
        const alt = filho(no, "Fallback") ?? filho(no, "Choice");
        if (alt) out.push(...(await lerArvore(alt, c, fixa, grupos)));
        break;
      }
    }
  }
  return out;
}

export { lerRProps };
