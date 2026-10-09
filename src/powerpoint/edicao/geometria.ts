// Matemática da edição de formas no palco: caixas em % da lâmina (x e largura em % da largura; y e altura em % da altura),
// rotação em graus (sentido horário, como no PowerPoint), redimensionar por alça, girar e encaixar em guias.
// Tudo puro (sem DOM), para dar para testar no Node.
import type { Shape, ShapeBox } from "../schema";

/** Tamanho da lâmina em pt (para converter % de largura e de altura numa unidade só). */
export interface Dim {
  w: number;
  h: number;
}

export type Alca = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RAD = Math.PI / 180;

export interface Ret {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Caixa em % -> retângulo em pt. */
export function paraPt(b: ShapeBox, d: Dim): Ret {
  return { x: (b.x / 100) * d.w, y: (b.y / 100) * d.h, w: (b.w / 100) * d.w, h: (b.h / 100) * d.h };
}

/** Retângulo em pt -> caixa em %. */
export function dePt(r: Ret, d: Dim): ShapeBox {
  return { x: (r.x / d.w) * 100, y: (r.y / d.h) * 100, w: (r.w / d.w) * 100, h: (r.h / d.h) * 100 };
}

export function centro(r: Ret): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Gira o ponto (px,py) em torno de (cx,cy). */
export function girarPonto(px: number, py: number, cx: number, cy: number, graus: number): { x: number; y: number } {
  const a = graus * RAD;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

/** Os 4 cantos de um retângulo girado (em pt). */
export function cantos(r: Ret, rot: number): { x: number; y: number }[] {
  const c = centro(r);
  return [
    girarPonto(r.x, r.y, c.x, c.y, rot),
    girarPonto(r.x + r.w, r.y, c.x, c.y, rot),
    girarPonto(r.x + r.w, r.y + r.h, c.x, c.y, rot),
    girarPonto(r.x, r.y + r.h, c.x, c.y, rot),
  ];
}

/** Menor retângulo (em %) que contém a forma girada. */
export function envolvente(s: Pick<Shape, "box" | "rot">, d: Dim): ShapeBox {
  if (!s.rot || s.rot % 360 === 0) return { ...s.box };
  const cs = cantos(paraPt(s.box, d), s.rot);
  const xs = cs.map((p) => p.x);
  const ys = cs.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return dePt({ x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }, d);
}

/** Retângulo (em %) que contém várias formas (já considerando a rotação de cada uma). */
export function envolventeDe(lista: Pick<Shape, "box" | "rot">[], d: Dim): ShapeBox | null {
  if (!lista.length) return null;
  const caixas = lista.map((s) => envolvente(s, d));
  const x0 = Math.min(...caixas.map((b) => b.x));
  const y0 = Math.min(...caixas.map((b) => b.y));
  const x1 = Math.max(...caixas.map((b) => b.x + b.w));
  const y1 = Math.max(...caixas.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const MIN_PT = 1;

export interface OpcoesRedim {
  /** mantém a proporção (Shift) */
  proporcao?: boolean;
  /** redimensiona a partir do centro (Alt) */
  doCentro?: boolean;
}

/**
 * Redimensiona arrastando uma alça. `inicial` é a caixa antes do arraste; (dx, dy) é o quanto o ponteiro andou, em pt,
 * no espaço da lâmina. A alça oposta fica parada, mesmo com a forma girada.
 */
export function redimensionar(inicial: ShapeBox, rot: number, alca: Alca, dx: number, dy: number, d: Dim, op: OpcoesRedim = {}): ShapeBox {
  const r0 = paraPt(inicial, d);
  // movimento do ponteiro nos eixos da própria forma
  const l = girarPonto(dx, dy, 0, 0, -rot);
  const temE = alca.includes("e");
  const temW = alca.includes("w");
  const temS = alca.includes("s");
  const temN = alca.includes("n");
  const k = op.doCentro ? 2 : 1;
  let w = r0.w + (temE ? l.x * k : temW ? -l.x * k : 0);
  let h = r0.h + (temS ? l.y * k : temN ? -l.y * k : 0);
  w = Math.max(MIN_PT, w);
  h = Math.max(MIN_PT, h);
  if (op.proporcao && r0.w > 0 && r0.h > 0) {
    const sw = w / r0.w;
    const sh = h / r0.h;
    const so_h = !temE && !temW; // alça de cima/baixo: a largura acompanha
    const so_w = !temN && !temS; // alça lateral: a altura acompanha
    const s = so_h ? sh : so_w ? sw : Math.abs(sw - 1) > Math.abs(sh - 1) ? sw : sh;
    w = Math.max(MIN_PT, r0.w * s);
    h = Math.max(MIN_PT, r0.h * s);
  }
  // âncora: o ponto da alça oposta (no espaço local, relativo ao centro) não se mexe
  const c0 = centro(r0);
  let cx = c0.x;
  let cy = c0.y;
  if (!op.doCentro) {
    const ax0 = temE ? -r0.w / 2 : temW ? r0.w / 2 : 0;
    const ay0 = temS ? -r0.h / 2 : temN ? r0.h / 2 : 0;
    const ax1 = temE ? -w / 2 : temW ? w / 2 : 0;
    const ay1 = temS ? -h / 2 : temN ? h / 2 : 0;
    const ancora = girarPonto(c0.x + ax0, c0.y + ay0, c0.x, c0.y, rot);
    // novo centro = âncora - R(rot) * (ax1, ay1)
    const off = girarPonto(ax1, ay1, 0, 0, rot);
    cx = ancora.x - off.x;
    cy = ancora.y - off.y;
  }
  return dePt({ x: cx - w / 2, y: cy - h / 2, w, h }, d);
}

/** Ângulo (graus, 0 = para cima, horário) do ponteiro em relação ao centro da forma. */
export function anguloDoPonteiro(px: number, py: number, cx: number, cy: number): number {
  return Math.atan2(py - cy, px - cx) / RAD + 90;
}

/** Normaliza para 0-360. */
export function normalizarAngulo(a: number): number {
  return ((a % 360) + 360) % 360;
}

export interface Guia {
  /** "v" = linha vertical (posição em x, %), "h" = horizontal (posição em y, %) */
  eixo: "v" | "h";
  pos: number;
}

export interface Encaixe {
  dx: number;
  dy: number;
  guias: Guia[];
}

/**
 * Encaixa uma caixa que está sendo movida nas bordas e no centro da lâmina e das outras formas.
 * `limiar` está em % (por exemplo 0,6). Devolve o ajuste a somar ao movimento e as guias para desenhar.
 */
export function encaixar(movel: ShapeBox, outras: ShapeBox[], limiar: number): Encaixe {
  const xs = [0, 50, 100];
  const ys = [0, 50, 100];
  for (const b of outras) {
    xs.push(b.x, b.x + b.w / 2, b.x + b.w);
    ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  const meusX = [movel.x, movel.x + movel.w / 2, movel.x + movel.w];
  const meusY = [movel.y, movel.y + movel.h / 2, movel.y + movel.h];
  const melhor = (meus: number[], alvos: number[]): { ajuste: number; pos: number } | null => {
    let best: { ajuste: number; pos: number } | null = null;
    for (const m of meus)
      for (const a of alvos) {
        const dist = a - m;
        if (Math.abs(dist) <= limiar && (!best || Math.abs(dist) < Math.abs(best.ajuste))) best = { ajuste: dist, pos: a };
      }
    return best;
  };
  const bx = melhor(meusX, xs);
  const by = melhor(meusY, ys);
  const guias: Guia[] = [];
  if (bx) guias.push({ eixo: "v", pos: bx.pos });
  if (by) guias.push({ eixo: "h", pos: by.pos });
  return { dx: bx?.ajuste ?? 0, dy: by?.ajuste ?? 0, guias };
}

/** Caixa (em %) de um rótulo de seleção por arraste (marquee), normalizada. */
export function caixaDeDuasPontas(x0: number, y0: number, x1: number, y1: number): ShapeBox {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

/** Duas caixas se tocam? */
export function seCruzam(a: ShapeBox, b: ShapeBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
