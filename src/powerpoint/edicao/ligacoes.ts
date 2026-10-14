// Ligações entre formas (PowerPoint): a ferramenta "Conectar" prende uma forma na outra por
// pontos das bordas e o conector é DERIVADO — ao mover ou redimensionar qualquer lado ele se
// redesenha. A cor acompanha as caixas: o traço sai com a cor da ORIGEM e o trecho final (depois
// do último canto) fica com a cor do DESTINO, como num organograma desenhado à mão. A geometria
// reaproveita a ideia do Fluxo do Mermaid: cantos de 90° com curva.
import { uid } from "../../util";
import type { Lado, Liga, Shape, ShapeBox, Slide } from "../schema";
import type { EstiloDeck } from "./criar";
import { ajustarCor } from "./formato";
import { paraPt, type Dim, type Ret } from "./geometria";

/** Raio das curvas dos cantos (o mesmo do fluxo do Mermaid). */
const RAIO = 9;
/** Espessura do traço da ligação. */
const TRACO = 1.75;
/** Folga da caixa do conector em volta do caminho (o traço não encosta na borda). */
const PAD = 4;

export interface Pto {
  x: number;
  y: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const dist = (a: Pto, b: Pto) => Math.hypot(b.x - a.x, b.y - a.y);
const uni = (a: Pto, b: Pto): Pto => {
  const d = dist(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};

/** Ponto da borda (no meio do lado), em pt. */
export function pontoDaBorda(r: Ret, lado: Lado): Pto {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  if (lado === "topo") return { x: cx, y: r.y };
  if (lado === "base") return { x: cx, y: r.y + r.h };
  if (lado === "esq") return { x: r.x, y: cy };
  return { x: r.x + r.w, y: cy };
}

/** Rota ortogonal entre as duas bordas (2 a 4 pontos): reta quando dá, "Z" ou "L" quando não. */
export function rotaDaLigacao(a: Pto, ladoDe: Lado, b: Pto, ladoPara: Lado): Pto[] {
  const vertA = ladoDe === "topo" || ladoDe === "base";
  const vertB = ladoPara === "topo" || ladoPara === "base";
  if (vertA && vertB) {
    if (Math.abs(b.x - a.x) < 0.5) return [a, b];
    const meio = (a.y + b.y) / 2;
    return [a, { x: a.x, y: meio }, { x: b.x, y: meio }, b];
  }
  if (!vertA && !vertB) {
    if (Math.abs(b.y - a.y) < 0.5) return [a, b];
    const meio = (a.x + b.x) / 2;
    return [a, { x: meio, y: a.y }, { x: meio, y: b.y }, b];
  }
  return vertA ? [a, { x: a.x, y: b.y }, b] : [a, { x: b.x, y: a.y }, b];
}

/**
 * O caminho em comandos, partido em duas partes: a espinha (origem até o corte antes do último
 * canto, já com os cantos anteriores arredondados) e a descida (do corte até o destino, com a
 * curva do último canto). Sem cantos só existe a descida — a rota é uma reta.
 * Os dois trechos compartilham o ponto de corte, então o traço sai contínuo.
 */
export function caminhoDaLigacao(pts: Pto[]): { de: (string | number)[] | null; para: (string | number)[] } {
  const cmds: (string | number)[] = ["M", r2(pts[0].x), r2(pts[0].y)];
  let corte = -1; // índice (no cmds) do "L" que entra no último canto
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const r = Math.max(1, Math.min(RAIO, dist(p0, p1) / 2, dist(p1, p2) / 2));
    const d1 = uni(p0, p1);
    const d2 = uni(p1, p2);
    cmds.push("L", r2(p1.x - d1.x * r), r2(p1.y - d1.y * r));
    if (i === pts.length - 2) corte = cmds.length - 3;
    cmds.push("Q", r2(p1.x), r2(p1.y), r2(p1.x + d2.x * r), r2(p1.y + d2.y * r));
  }
  cmds.push("L", r2(pts[pts.length - 1].x), r2(pts[pts.length - 1].y));
  const para = corte < 0 ? cmds : (["M", cmds[corte + 1], cmds[corte + 2], ...cmds.slice(corte + 3)] as (string | number)[]);
  const de = corte < 0 ? null : cmds.slice(0, corte + 3);
  return { de, para };
}

const quaseBranco = (hex: string): boolean => {
  const c = hex.padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 228;
};

/** Cor "do ramo" da forma (o preenchimento com cor; senão o contorno); vazio quando é branca/clara. */
export function corDaForma(s: Shape): string {
  const fundo = s.fillX?.kind === "solid" ? s.fillX.color : s.fillX?.kind === "gradient" ? s.fillX.stops?.[0]?.color : s.fill;
  for (const c of [fundo, s.ln?.color]) if (c && !quaseBranco(c)) return c;
  return "";
}

/** Comandos -> forma do conector (geometria livre; caixa = caminho + folga). */
function parteDe(cmds: (string | number)[], cor: string, comSeta: boolean, refs: Liga, d: Dim, est: EstiloDeck): Shape {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < cmds.length; ) {
    const c = cmds[i] as string;
    const q = c === "M" || c === "L" ? 2 : c === "Q" ? 4 : 0;
    for (let k = 0; k < q; k += 2) {
      const x = cmds[i + 1 + k] as number;
      const y = cmds[i + 2 + k] as number;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    i += 1 + q;
  }
  const x0 = minX - PAD;
  const y0 = minY - PAD;
  const w = Math.max(maxX - minX + PAD * 2, 0.01);
  const h = Math.max(maxY - minY + PAD * 2, 0.01);
  const locais: (string | number)[] = [];
  for (let i = 0; i < cmds.length; ) {
    const c = cmds[i++] as string;
    locais.push(c);
    const q = c === "M" || c === "L" ? 2 : c === "Q" ? 4 : 0;
    for (let k = 0; k < q; k += 2) locais.push(r2((cmds[i + k] as number) - x0), r2((cmds[i + k + 1] as number) - y0));
    i += q;
  }
  const box: ShapeBox = { x: (x0 / d.w) * 100, y: (y0 / d.h) * 100, w: (w / d.w) * 100, h: (h / d.h) * 100 };
  return {
    id: uid(),
    kind: "forma",
    box,
    text: "",
    fontFamily: est.fonte,
    fontSize: est.tamanho,
    color: est.corTexto,
    bold: false,
    italic: false,
    align: "centro",
    fill: "",
    src: "",
    rot: 0,
    name: "Ligação",
    geom: "custom",
    paths: [{ w: r2(w), h: r2(h), cmds: locais }],
    ln: { color: cor, alpha: 1, w: TRACO, dash: "solid", join: "round", cap: "round", ...(comSeta ? { tail: "triangle" as const } : {}) },
    fillX: { kind: "none" },
    grupo: refs.grupo,
    liga: refs,
  };
}

const refs = (de: string, ladoDe: Lado, para: string, ladoPara: Lado, parte: "a" | "b", grupo: string): Liga => ({
  de,
  ladoDe,
  para,
  ladoPara,
  parte,
  grupo,
});

/** Cria as formas da ligação entre duas formas: a espinha (cor da origem) e a descida (cor do destino). */
export function ligacaoParaFormas(de: Shape, ladoDe: Lado, para: Shape, ladoPara: Lado, d: Dim, est: EstiloDeck): Shape[] {
  const a = pontoDaBorda(paraPt(de.box, d), ladoDe);
  const b = pontoDaBorda(paraPt(para.box, d), ladoPara);
  const { de: cmdDe, para: cmdPara } = caminhoDaLigacao(rotaDaLigacao(a, ladoDe, b, ladoPara));
  const corPadrao = ajustarCor(est.acento, 0.9);
  const corDe = corDaForma(de) || corPadrao;
  const corPara = corDaForma(para) || corDe;
  const g = uid();
  const formas: Shape[] = [];
  if (cmdDe) formas.push(parteDe(cmdDe, corDe, false, refs(de.id, ladoDe, para.id, ladoPara, "a", g), d, est));
  formas.push(parteDe(cmdPara, corPara, true, refs(de.id, ladoDe, para.id, ladoPara, "b", g), d, est));
  return formas;
}

/** Recalcula UMA parte da ligação a partir das caixas atuais (mantendo id e nome da forma). */
function recomputarParte(s: Shape, de: Shape, para: Shape, d: Dim, destaque: string): Shape | null {
  const l = s.liga!;
  const a = pontoDaBorda(paraPt(de.box, d), l.ladoDe);
  const b = pontoDaBorda(paraPt(para.box, d), l.ladoPara);
  const { de: cmdDe, para: cmdPara } = caminhoDaLigacao(rotaDaLigacao(a, l.ladoDe, b, l.ladoPara));
  const cmds = l.parte === "a" ? cmdDe : cmdPara;
  if (!cmds) return null; // a rota ficou reta: a espinha deixa de existir
  const corPadrao = ajustarCor(destaque, 0.9);
  const corDe = corDaForma(de) || corPadrao;
  const cor = l.parte === "a" ? corDe : corDaForma(para) || corDe;
  const est: EstiloDeck = { fonte: s.fontFamily, tamanho: s.fontSize, corTexto: s.color, acento: destaque, paleta: [] };
  const nova = parteDe(cmds, cor, l.parte === "b", l, d, est);
  nova.id = s.id;
  nova.name = s.name;
  return nova;
}

/**
 * Recalcula todas as ligações da lâmina: mover/redimensionar qualquer lado redesenha o traço, e
 * a caixa apagada leva a ligação junto. É chamada a cada mudança da lâmina (no `substituirSlide`).
 */
export function atualizarLigacoes(slide: Slide, d: Dim, destaque: string): Slide {
  if (!slide.shapes.some((s) => s.liga)) return slide;
  const porId = new Map(slide.shapes.map((s) => [s.id, s]));
  const saida: Shape[] = [];
  for (const s of slide.shapes) {
    if (!s.liga) {
      saida.push(s);
      continue;
    }
    const de = porId.get(s.liga.de);
    const para = porId.get(s.liga.para);
    if (!de || !para) continue;
    const nova = recomputarParte(s, de, para, d, destaque);
    if (nova) saida.push(nova);
  }
  return { ...slide, shapes: saida };
}
