// Desenho das formas "ricas" (vindas de um .pptx): geometria em SVG (em pt, escala exata), preenchimento
// sólido/gradiente/imagem, contorno, sombra, imagem recortada e texto formatado por parágrafo e trecho.
// Todas as medidas saem em `cqw` (a lâmina é um container de tamanho), então a lâmina escala inteira.
import type { EmbeddedFont, Fill, Line, Para, Run, Shape } from "../schema";
import { PRESETS_CONHECIDOS, tracadoDoPreset, tracadoLivre, type Traçado } from "./presets";

export interface CtxRender {
  /** tamanho da lâmina em pt */
  larguraPt: number;
  alturaPt: number;
  /** imagens do deck (id -> data URL) */
  media: Record<string, string>;
  selecionada?: string | null;
  /** texto editável (palco) ou só desenho (miniaturas) */
  editavel: boolean;
}

/** Forma que veio de um .pptx (tem geometria própria) — desenhada por este módulo. */
export function ehRica(s: Shape): boolean {
  return s.geom !== undefined;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n3 = (n: number) => (Math.round(n * 1000) / 1000).toString();

// ---------------------------------------------------------------------------
// imagens (data URL -> blob URL, uma vez por imagem)
// ---------------------------------------------------------------------------

const blobs = new Map<string, string>();

export function urlDaMidia(src: string, media: Record<string, string>): string {
  if (!src.startsWith("media:")) return src;
  const data = media[src.slice(6)];
  if (!data) return "";
  const cache = blobs.get(data);
  if (cache) return cache;
  let url = data;
  try {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(data);
    if (m && m[2] && typeof URL !== "undefined" && URL.createObjectURL) {
      const bin = atob(m[3]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      url = URL.createObjectURL(new Blob([bytes], { type: m[1] }));
    }
  } catch {
    url = data;
  }
  blobs.set(data, url);
  return url;
}

// ---------------------------------------------------------------------------
// fontes
// ---------------------------------------------------------------------------

const registradas = new Set<string>();
const razoes = new Map<string, number>();

/** Registra as fontes embutidas do deck (@font-face via FontFace) e espera carregarem. */
export async function registrarFontes(fontes: EmbeddedFont[] | undefined): Promise<void> {
  if (!fontes?.length || typeof FontFace === "undefined") return;
  const tarefas: Promise<unknown>[] = [];
  for (const f of fontes) {
    const chave = `${f.family}|${f.weight}|${f.italic}|${f.src.length}`;
    if (registradas.has(chave)) continue;
    registradas.add(chave);
    try {
      const face = new FontFace(f.family, `url(${f.src})`, { weight: String(f.weight), style: f.italic ? "italic" : "normal" });
      tarefas.push(
        face
          .load()
          .then(() => {
            document.fonts.add(face);
            razoes.clear();
          })
          .catch(() => {})
      );
    } catch {
      /* fonte inválida: segue com a de reserva */
    }
  }
  await Promise.all(tarefas);
}

const SERIFADAS = /times|georgia|cambria|garamond|palatino|bookman|serif(?!.*sans)|minion|baskerville|didot/i;
const MONO = /consolas|courier|mono|menlo|lucida console/i;

const PESOS_NOME: [RegExp, number][] = [
  [/\s+(Thin|Hairline)$/i, 100],
  [/\s+(ExtraLight|UltraLight)$/i, 200],
  [/\s+Light$/i, 300],
  [/\s+(Regular|Normal)$/i, 400],
  [/\s+Medium$/i, 500],
  [/\s+(SemiBold|DemiBold)$/i, 600],
  [/\s+(ExtraBold|UltraBold)$/i, 800],
  [/\s+(Black|Heavy)$/i, 900],
  [/\s+Bold$/i, 700],
];

/**
 * O PowerPoint trata cada peso como uma família ("Montserrat Black"); na tela usamos a família-base com o peso
 * certo (Montserrat 900), que é o mesmo desenho e funciona com fonte variável ou instalada.
 */
export function fonteCss(nome: string, negrito: boolean): { stack: string; peso: number } {
  let base = nome.replace(/'/g, "").trim();
  let peso = negrito ? 700 : 400;
  for (const [re, p] of PESOS_NOME) {
    if (re.test(base)) {
      base = base.replace(re, "");
      peso = negrito ? Math.max(p, 700) : p;
      break;
    }
  }
  const generica = MONO.test(base) ? "monospace" : SERIFADAS.test(base) ? "serif" : "sans-serif";
  return { stack: `'${base}',${generica}`, peso };
}

/** Pilha de fontes (sem peso), para as medições. */
function pilhaDeFonte(nome: string): string {
  return fonteCss(nome, false).stack;
}

let aoCarregarFonte: (() => void) | null = null;
let avisoAgendado = false;
const carregando = new Set<string>();

/** Quem desenha chama isto para ser avisado quando uma fonte da web terminar de carregar (as medidas mudam). */
export function aoCarregarFontes(cb: () => void): void {
  aoCarregarFonte = cb;
}

function carregarDepois(spec: string): void {
  if (carregando.has(spec) || typeof document === "undefined" || !document.fonts) return;
  carregando.add(spec);
  void document.fonts
    .load(spec)
    .catch(() => {})
    .then(() => {
      carregando.delete(spec);
      razoes.clear();
      if (avisoAgendado) return;
      avisoAgendado = true;
      setTimeout(() => {
        avisoAgendado = false;
        aoCarregarFonte?.();
      }, 30);
    });
}

/** Altura natural da linha da fonte (entrelinha 100% do PowerPoint), medida na própria fonte. */
function razaoDeLinha(nome: string, negrito: boolean): number {
  const fc = fonteCss(nome, negrito);
  const spec = `${fc.peso} 100px ${fc.stack}`;
  const chave = spec;
  const guardada = razoes.get(chave);
  if (guardada) return guardada;
  // fonte da web ainda não carregada: não medir (mediria a fonte de reserva); pede o carregamento e mede depois
  if (typeof document !== "undefined" && document.fonts && !document.fonts.check(spec)) {
    carregarDepois(spec);
    return 1.2;
  }
  let r = 1.2;
  try {
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas").getContext("2d");
      if (c) {
        c.font = spec;
        const m = c.measureText("Hxg");
        const asc = (m as TextMetrics).fontBoundingBoxAscent;
        const desc = (m as TextMetrics).fontBoundingBoxDescent;
        if (asc && desc) r = (asc + desc) / 100;
      }
    }
  } catch {
    r = 1.2;
  }
  razoes.set(chave, r);
  return r;
}

// ---------------------------------------------------------------------------
// preenchimento e contorno
// ---------------------------------------------------------------------------

function rgba(hex: string, alpha = 1): string {
  if (alpha >= 1) return `#${hex}`;
  const h = hex.padEnd(6, "0");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${n3(alpha)})`;
}

/** Valor CSS de `background` para o fundo de uma lâmina (sólido, gradiente ou imagem); "" quando não há. */
export function fundoValor(bg: Fill | undefined, media: Record<string, string>): string {
  if (!bg || bg.kind === "none") return "";
  if (bg.kind === "solid") return rgba(bg.color ?? "FFFFFF", bg.alpha ?? 1);
  if (bg.kind === "gradient" && bg.stops?.length) {
    const paradas = bg.stops.map((p) => `${rgba(p.color, p.alpha)} ${n3(p.pos)}%`).join(",");
    return bg.radial ? `radial-gradient(circle at 50% 50%,${paradas})` : `linear-gradient(${n3((bg.angle ?? 0) + 90)}deg,${paradas})`;
  }
  if (bg.kind === "image" && bg.src) {
    const url = urlDaMidia(bg.src, media);
    return bg.tile ? `url("${url}") repeat` : `url("${url}") center/cover no-repeat`;
  }
  return "";
}

const DASH_REL: Record<string, number[]> = {
  dash: [4, 3],
  lgDash: [8, 3],
  sysDash: [3, 1],
  dot: [1, 3],
  sysDot: [1, 1],
  dashDot: [4, 3, 1, 3],
};

function atributosDeTraco(ln: Line | undefined): string {
  if (!ln || ln.w <= 0) return `stroke="none"`;
  const partes = [`stroke="#${ln.color}"`, `stroke-width="${n3(Math.max(ln.w, 0.1))}"`];
  if (ln.alpha < 1) partes.push(`stroke-opacity="${n3(ln.alpha)}"`);
  partes.push(`stroke-linecap="${ln.cap ?? "butt"}"`, `stroke-linejoin="${ln.join ?? "miter"}"`);
  const d = ln.dash && DASH_REL[ln.dash];
  if (d) partes.push(`stroke-dasharray="${d.map((x) => n3(x * Math.max(ln.w, 1))).join(" ")}"`);
  return partes.join(" ");
}

function defsDeFill(id: string, fill: Fill | undefined, w: number, h: number, ctx: CtxRender): { defs: string; ref: string; alpha: number } {
  if (!fill || fill.kind === "none") return { defs: "", ref: "none", alpha: 1 };
  if (fill.kind === "solid") return { defs: "", ref: `#${fill.color ?? "000000"}`, alpha: fill.alpha ?? 1 };
  if (fill.kind === "gradient" && fill.stops?.length) {
    const stops = fill.stops.map((p) => `<stop offset="${n3(p.pos)}%" stop-color="#${p.color}" stop-opacity="${n3(p.alpha)}"/>`).join("");
    if (fill.radial) return { defs: `<radialGradient id="g${id}" cx="50%" cy="50%" r="70%">${stops}</radialGradient>`, ref: `url(#g${id})`, alpha: 1 };
    const a = (((fill.angle ?? 0) % 360) * Math.PI) / 180;
    const dx = Math.cos(a) / 2;
    const dy = Math.sin(a) / 2;
    return {
      defs: `<linearGradient id="g${id}" x1="${n3(0.5 - dx)}" y1="${n3(0.5 - dy)}" x2="${n3(0.5 + dx)}" y2="${n3(0.5 + dy)}">${stops}</linearGradient>`,
      ref: `url(#g${id})`,
      alpha: 1,
    };
  }
  if (fill.kind === "image" && fill.src) {
    const url = urlDaMidia(fill.src, ctx.media);
    // retângulo onde a imagem inteira é esticada: a forma menos o "inset" (negativo = passa da forma); o recorte aumenta a imagem
    const ins = fill.inset ?? [0, 0, 0, 0];
    const cr = fill.crop ?? [0, 0, 0, 0];
    const rx = (ins[0] / 100) * w;
    const ry = (ins[1] / 100) * h;
    const rw = w * (1 - (ins[0] + ins[2]) / 100);
    const rh = h * (1 - (ins[1] + ins[3]) / 100);
    const fw = Math.max(0.01, 1 - (cr[0] + cr[2]) / 100);
    const fh = Math.max(0.01, 1 - (cr[1] + cr[3]) / 100);
    const iw = rw / fw;
    const ih = rh / fh;
    const ix = rx - (cr[0] / 100) * iw;
    const iy = ry - (cr[1] / 100) * ih;
    return {
      defs: `<pattern id="p${id}" patternUnits="userSpaceOnUse" width="${n3(w)}" height="${n3(h)}"><image href="${url}" x="${n3(ix)}" y="${n3(iy)}" width="${n3(iw)}" height="${n3(ih)}" preserveAspectRatio="none"/></pattern>`,
      ref: `url(#p${id})`,
      alpha: fill.alpha ?? 1,
    };
  }
  return { defs: "", ref: "none", alpha: 1 };
}

// ---------------------------------------------------------------------------
// geometria (SVG)
// ---------------------------------------------------------------------------

function tracadosDa(s: Shape, w: number, h: number): Traçado[] {
  if (s.paths?.length) return tracadoLivre(s.paths, w, h);
  const g = s.geom ?? "rect";
  if (!PRESETS_CONHECIDOS.has(g)) avisarPresetDesconhecido(g);
  return tracadoDoPreset(g, w, h, s.adj);
}

const avisados = new Set<string>();
/** Presets que ainda não têm desenho próprio (viram retângulo). Útil para o diagnóstico. */
export const presetsSemDesenho = avisados;
function avisarPresetDesconhecido(g: string): void {
  avisados.add(g);
}

function marcadorDeSeta(id: string, tipo: string, cor: string, fim: boolean): string {
  const forma =
    tipo === "oval"
      ? `<circle cx="5" cy="5" r="4" fill="#${cor}"/>`
      : tipo === "diamond"
        ? `<path d="M0 5L5 0L10 5L5 10Z" fill="#${cor}"/>`
        : tipo === "stealth"
          ? `<path d="M0 0L10 5L0 10L3 5Z" fill="#${cor}"/>`
          : `<path d="M0 0L10 5L0 10Z" fill="#${cor}"/>`;
  return `<marker id="${id}" viewBox="0 0 10 10" refX="${fim ? 8 : 2}" refY="5" markerWidth="5" markerHeight="5" markerUnits="strokeWidth" orient="${fim ? "auto" : "auto-start-reverse"}">${forma}</marker>`;
}

function cq(pt: number, ctx: CtxRender): string {
  return `${n3((pt * 100) / ctx.larguraPt)}cqw`;
}

function svgDaForma(s: Shape, ctx: CtxRender, soContorno = false): string {
  const w = (s.box.w / 100) * ctx.larguraPt;
  const h = (s.box.h / 100) * ctx.alturaPt;
  // a geometria usa o tamanho REAL (uma linha vertical tem largura 0), mas o SVG precisa de pelo menos 1 pt de cada lado:
  // o navegador não pinta um SVG de tamanho zero, e as linhas conectoras sumiam
  const hh = Math.max(h, 0);
  const ww = Math.max(w, 0);
  const sh = Math.max(h, 1);
  const sw = Math.max(w, 1);
  const tr = tracadosDa(s, ww, hh);
  const fill = soContorno ? undefined : s.fillX;
  const { defs, ref, alpha } = defsDeFill(s.id, fill, Math.max(ww, 0.01), Math.max(hh, 0.01), ctx);
  let marcas = "";
  let mi = "";
  let mf = "";
  if (s.ln?.head) {
    marcas += marcadorDeSeta(`mh${s.id}`, s.ln.head, s.ln.color, false);
    mi = ` marker-start="url(#mh${s.id})"`;
  }
  if (s.ln?.tail) {
    marcas += marcadorDeSeta(`mt${s.id}`, s.ln.tail, s.ln.color, true);
    mf = ` marker-end="url(#mt${s.id})"`;
  }
  const traco = atributosDeTraco(s.ln);
  const caminhos = tr
    .map((t) => {
      const preenche = t.preenche && ref !== "none";
      const fillAttr = preenche ? `fill="${ref}"${alpha < 1 ? ` fill-opacity="${n3(alpha)}"` : ""}${t.evenodd ? ` fill-rule="evenodd"` : ""}` : `fill="none"`;
      const tr2 = t.traco === false ? `stroke="none"` : traco;
      return `<path d="${t.d}" ${fillAttr} ${tr2}${t.preenche ? "" : mi + mf}/>`;
    })
    .join("");
  const flip = (s.flipH ? -1 : 1) + "," + (s.flipV ? -1 : 1);
  const mover = `translate(${s.flipH ? n3(ww) : 0} ${s.flipV ? n3(hh) : 0}) scale(${flip})`;
  let sombra = "";
  if (s.shadow && !soContorno) {
    const a = (s.shadow.dir * Math.PI) / 180;
    const dx = Math.cos(a) * s.shadow.dist;
    const dy = Math.sin(a) * s.shadow.dist;
    sombra = `filter:drop-shadow(${cq(dx, ctx)} ${cq(dy, ctx)} ${cq(s.shadow.blur / 2, ctx)} ${rgba(s.shadow.color, s.shadow.alpha)});`;
  }
  return (
    `<svg class="pp-geo" viewBox="0 0 ${n3(sw)} ${n3(sh)}" style="width:${cq(sw, ctx)};height:${cq(sh, ctx)};${sombra}" aria-hidden="true">` +
    `<defs>${defs}${marcas}</defs><g transform="${mover}">${caminhos}</g></svg>`
  );
}

// ---------------------------------------------------------------------------
// texto
// ---------------------------------------------------------------------------

function numeracao(auto: string, n: number): string {
  const letra = (k: number, maius: boolean) => {
    let t = "";
    let x = k;
    while (x > 0) {
      x--;
      t = String.fromCharCode(97 + (x % 26)) + t;
      x = Math.floor(x / 26);
    }
    return maius ? t.toUpperCase() : t;
  };
  const romano = (k: number, maius: boolean) => {
    const v: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
    let t = "";
    for (const [val, sim] of v) while (k >= val) { t += sim; k -= val; }
    return maius ? t.toUpperCase() : t;
  };
  if (auto.startsWith("alphaLc")) return letra(n, false) + (auto.endsWith("ParenR") ? ")" : ".");
  if (auto.startsWith("alphaUc")) return letra(n, true) + (auto.endsWith("ParenR") ? ")" : ".");
  if (auto.startsWith("romanLc")) return romano(n, false) + ".";
  if (auto.startsWith("romanUc")) return romano(n, true) + ".";
  if (auto === "arabicParenR") return `${n})`;
  if (auto === "arabicPlain") return String(n);
  return `${n}.`;
}

function htmlRun(r: Run, ctx: CtxRender): string {
  if (r.br) return "<br>";
  const fc = fonteCss(r.font, r.bold);
  const est: string[] = [`font-family:${fc.stack}`, `font-size:${cq(r.size, ctx)}`, `color:${rgba(r.color, r.alpha ?? 1)}`, `font-weight:${fc.peso}`];
  if (r.italic) est.push("font-style:italic");
  const deco = [r.underline ? "underline" : "", r.strike ? "line-through" : ""].filter(Boolean).join(" ");
  if (deco) est.push(`text-decoration:${deco}`);
  if (r.caps) est.push("text-transform:uppercase");
  if (r.spc) est.push(`letter-spacing:${cq(r.spc, ctx)}`);
  if (r.baseline) est.push(`font-size:${cq(r.size * 0.65, ctx)}`, "position:relative", `top:${r.baseline > 0 ? "-0.45em" : "0.25em"}`);
  return `<span style="${est.join(";")}">${esc(r.text)}</span>`;
}

function htmlParagrafo(p: Para, i: number, ctx: CtxRender, contagem: { auto: number }): string {
  const tam = p.runs[0]?.size ?? p.endSize;
  const fonte = p.runs[0]?.font ?? "sans-serif";
  const negrito = !!p.runs[0]?.bold;
  const razao = razaoDeLinha(fonte, negrito);
  const lh = p.lnSpc?.pts !== undefined ? cq(p.lnSpc.pts, ctx) : n3(razao * (p.lnSpc?.pct ?? 1));
  const est: string[] = [
    `text-align:${p.align === "centro" ? "center" : p.align === "direita" ? "right" : p.align === "justificado" ? "justify" : "left"}`,
    `line-height:${lh}`,
    `padding-left:${cq(p.marL, ctx)}`,
    `text-indent:${cq(p.indent, ctx)}`,
    `font-size:${cq(p.runs.length ? tam : p.endSize, ctx)}`,
  ];
  if (i > 0 && p.spcBef) est.push(`margin-top:${cq(p.spcBef, ctx)}`);
  if (p.spcAft) est.push(`margin-bottom:${cq(p.spcAft, ctx)}`);
  let marcador = "";
  if (p.bullet) {
    const b = p.bullet;
    let sim: string;
    if (b.auto) {
      contagem.auto = b.startAt ?? contagem.auto + 1;
      sim = numeracao(b.auto, contagem.auto);
    } else sim = b.char ?? "•";
    const primeira = p.runs[0];
    const e: string[] = [`display:inline-block`, `min-width:${cq(Math.max(-p.indent, tam * 0.9), ctx)}`, `text-indent:0`];
    if (b.color) e.push(`color:#${b.color}`);
    else if (primeira) e.push(`color:${rgba(primeira.color, primeira.alpha ?? 1)}`);
    if (b.sizePct) e.push(`font-size:${cq((tam * b.sizePct) / 100, ctx)}`);
    if (b.font && !/wingdings|symbol/i.test(b.font)) e.push(`font-family:${pilhaDeFonte(b.font)}`);
    marcador = `<span style="${e.join(";")}">${esc(sim === "§" || sim === "Ø" || sim === "ü" ? "•" : sim)}</span>`;
  } else contagem.auto = 0;
  const corpo = p.runs.length ? p.runs.map((r) => htmlRun(r, ctx)).join("") : "&#8203;";
  return `<p style="${est.join(";")}">${marcador}${corpo}</p>`;
}

function htmlTexto(s: Shape, ctx: CtxRender): string {
  if (!s.paras?.length) return "";
  const ins = s.ins ?? [7.2, 3.6, 7.2, 3.6];
  const est: string[] = [
    `padding:${cq(ins[1], ctx)} ${cq(ins[2], ctx)} ${cq(ins[3], ctx)} ${cq(ins[0], ctx)}`,
    `justify-content:${s.anchor === "ctr" ? "center" : s.anchor === "b" ? "flex-end" : "flex-start"}`,
  ];
  if (s.wrap === false) est.push("white-space:pre");
  if (s.vert === "vert" || s.vert === "eaVert") est.push("writing-mode:vertical-rl");
  if (s.vert === "vert270") est.push("writing-mode:vertical-rl", "transform:rotate(180deg)");
  const contagem = { auto: 0 };
  const paras = s.paras.map((p, i) => htmlParagrafo(p, i, ctx, contagem)).join("");
  const editavel = ctx.editavel ? ` contenteditable="true" spellcheck="false"` : "";
  return `<div class="pp-shape-text pp-rt"${editavel} style="${est.join(";")}">${paras}</div>`;
}

// ---------------------------------------------------------------------------
// forma completa
// ---------------------------------------------------------------------------

function moldura(s: Shape, ctx: CtxRender): string {
  const w = (s.box.w / 100) * ctx.larguraPt;
  const h = (s.box.h / 100) * ctx.alturaPt;
  if (s.geom === "ellipse") return "border-radius:50%;";
  if (s.geom === "roundRect") return `border-radius:${cq((Math.min(w, h) * Math.min(s.adj?.adj ?? 16667, 50000)) / 100000, ctx)};`;
  return "";
}

/** HTML de uma forma rica. O container recebe os eventos de seleção/arraste do palco. */
export function htmlFormaRica(s: Shape, ctx: CtxRender): string {
  const sel = ctx.selecionada === s.id;
  const est = [`left:${n3(s.box.x)}%`, `top:${n3(s.box.y)}%`, `width:${n3(s.box.w)}%`, `height:${n3(s.box.h)}%`];
  if (s.rot) est.push(`transform:rotate(${n3(s.rot)}deg)`);
  if (s.opacity !== undefined && s.opacity < 1) est.push(`opacity:${n3(s.opacity)}`);
  const classes = `pp-shape pp-rica${sel ? " selected" : ""}${s.fixa ? " pp-fixa" : ""}`;
  const attrs = `class="${classes}" data-shape="${s.id}" data-kind="${s.kind}" style="${est.join(";")}"`;
  if (s.kind === "imagem" && s.src) {
    const url = urlDaMidia(s.src, ctx.media);
    const c = s.crop ?? [0, 0, 0, 0];
    const fw = Math.max(0.01, 1 - (c[0] + c[2]) / 100);
    const fh = Math.max(0.01, 1 - (c[1] + c[3]) / 100);
    const img = `<img src="${url}" alt="" draggable="false" style="position:absolute;left:${n3((-c[0] / 100 / fw) * 100)}%;top:${n3((-c[1] / 100 / fh) * 100)}%;width:${n3(100 / fw)}%;height:${n3(100 / fh)}%;max-width:none;display:block"/>`;
    const contorno = s.ln ? svgDaForma({ ...s, fillX: undefined }, ctx, true) : "";
    return `<div ${attrs}><div class="pp-pic" style="${moldura(s, ctx)}">${img}</div>${contorno}<span class="pp-handle"></span></div>`;
  }
  return `<div ${attrs}>${svgDaForma(s, ctx)}${htmlTexto(s, ctx)}<span class="pp-handle"></span></div>`;
}

// ---------------------------------------------------------------------------
// edição: manter a formatação quando o texto ou o estilo da forma mudam
// ---------------------------------------------------------------------------

/** Estilo único (o do primeiro trecho) aplicado a um texto novo: usado quando a edição mexe nas quebras de parágrafo. */
function parasComEstiloUnico(paras: Para[], texto: string): Para[] {
  const linhas = texto.split("\n");
  return linhas.map((linha, i) => {
    const modelo = paras[Math.min(i, paras.length - 1)];
    const r0 = modelo.runs[0] ?? paras.find((p) => p.runs.length)?.runs[0];
    const run: Run | undefined = linha
      ? r0
        ? { ...r0, text: linha, br: undefined }
        : { text: linha, size: modelo.endSize, bold: false, italic: false, underline: false, strike: false, color: "000000", font: "sans-serif" }
      : undefined;
    return { ...modelo, runs: run ? [run] : [] };
  });
}

/**
 * Texto novo sobre os parágrafos existentes, mexendo só no que mudou: acha o trecho alterado (prefixo e sufixo
 * em comum) e troca apenas ali, então cores, fontes e tamanhos do resto do texto continuam como estavam.
 * Quando a edição cria ou apaga parágrafos, cai no estilo único do primeiro trecho de cada parágrafo.
 */
export function parasComTexto(paras: Para[], texto: string): Para[] {
  const textoDe = (p: Para) => p.runs.map((r) => r.text).join("");
  const antigo = paras.map(textoDe).join("\n");
  if (antigo === texto) return paras;
  let p = 0;
  while (p < antigo.length && p < texto.length && antigo[p] === texto[p]) p++;
  let q = 0;
  while (q < antigo.length - p && q < texto.length - p && antigo[antigo.length - 1 - q] === texto[texto.length - 1 - q]) q++;
  const removido = antigo.slice(p, antigo.length - q);
  const inserido = texto.slice(p, texto.length - q);
  // linhas novas no FIM do texto: os parágrafos antigos ficam intactos e os novos herdam o estilo do último
  if (removido === "" && p === antigo.length && inserido.startsWith("\n")) {
    const ultimo = paras[paras.length - 1];
    const modelo = [...ultimo.runs].reverse().find((r) => !r.br);
    const extras = inserido
      .slice(1)
      .split("\n")
      .map<Para>((linha) => ({ ...ultimo, runs: linha && modelo ? [{ ...modelo, text: linha }] : [] }));
    return [...paras, ...extras];
  }
  if (removido.includes("\n") || inserido.includes("\n")) return parasComEstiloUnico(paras, texto);

  // parágrafo onde a mudança começa
  let inicio = 0;
  let alvo = -1;
  for (let i = 0; i < paras.length; i++) {
    const len = textoDe(paras[i]).length;
    if (p >= inicio && p <= inicio + len) {
      alvo = i;
      break;
    }
    inicio += len + 1;
  }
  if (alvo < 0) return parasComEstiloUnico(paras, texto);
  const par = paras[alvo];
  const a0 = p - inicio;
  const b0 = a0 + removido.length;
  if (b0 > textoDe(par).length) return parasComEstiloUnico(paras, texto);

  const novos: Run[] = [];
  let off = 0;
  let inseriu = false;
  const modeloRun = par.runs.find((r) => !r.br) ?? par.runs[0];
  for (const r of par.runs) {
    const rs = off;
    const re = off + r.text.length;
    off = re;
    // parte do trecho que sobra antes e depois da área removida
    const antes = r.text.slice(0, Math.max(0, Math.min(r.text.length, a0 - rs)));
    const depois = r.text.slice(Math.max(0, Math.min(r.text.length, b0 - rs)));
    // a inserção vai no trecho que termina em a0 (digitar prolonga o trecho anterior); no começo do parágrafo, no primeiro
    const recebe = !inseriu && (a0 <= re || r === par.runs[par.runs.length - 1]) && (a0 > rs || a0 === 0 || r === par.runs[0]);
    if (recebe) {
      inseriu = true;
      const t = antes + inserido + (b0 > re ? "" : depois);
      if (t) novos.push({ ...r, text: t });
      else if (r.br) novos.push(r);
    } else {
      const t = antes + depois;
      if (r.br) {
        if (rs >= a0 && re <= b0 && removido) continue;
        novos.push(r);
      } else if (t) novos.push({ ...r, text: t });
    }
  }
  if (!inseriu && inserido) {
    novos.push(
      modeloRun
        ? { ...modeloRun, text: inserido, br: undefined }
        : { text: inserido, size: par.endSize, bold: false, italic: false, underline: false, strike: false, color: "000000", font: "sans-serif" }
    );
  }
  return paras.map((x, i) => (i === alvo ? { ...x, runs: novos } : x));
}

/** Aplica fonte, tamanho, cor, negrito, itálico ou alinhamento a todos os trechos de uma forma rica. */
export function parasComEstilo(paras: Para[], p: Partial<Pick<Shape, "fontFamily" | "fontSize" | "color" | "bold" | "italic" | "align">>): Para[] {
  return paras.map((par) => ({
    ...par,
    align: p.align ?? par.align,
    endSize: p.fontSize ?? par.endSize,
    runs: par.runs.map((r) => ({
      ...r,
      font: p.fontFamily ?? r.font,
      size: p.fontSize ?? r.size,
      color: p.color ?? r.color,
      bold: p.bold ?? r.bold,
      italic: p.italic ?? r.italic,
    })),
  }));
}
