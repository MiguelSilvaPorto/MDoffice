// Quadro de desenho ASSISTIDO, usado embutido no documento (sem popup).
// - reconhece traços à mão livre e os transforma em formas alinhadas
// - encaixa ângulos/quadrados e alinha elementos entre si (ímã)
// - salva o desenho como PNG + um arquivo .json ao lado (para editar depois)
import { h, uid, clamp, toast, dataUrlPayload } from "./util";

export interface Pt {
  x: number;
  y: number;
}

export type ElType = "pen" | "line" | "arrow" | "rect" | "ellipse" | "text" | "poly";

interface BaseEl {
  id: string;
  type: ElType;
  color: string;
  width: number;
}

export interface PenEl extends BaseEl {
  type: "pen";
  points: Pt[];
}

export interface LineEl extends BaseEl {
  type: "line" | "arrow";
  a: Pt;
  b: Pt;
  /** id da forma onde a ponta inicial está ligada (se houver) */
  fromId?: string;
  /** id da forma onde a ponta final está ligada (se houver) */
  toId?: string;
  /** ângulo de fixação na borda da forma (guarda a posição da ligação) */
  fromAngle?: number;
  toAngle?: number;
}

export interface ShapeEl extends BaseEl {
  type: "rect" | "ellipse";
  a: Pt;
  b: Pt;
  fill: string | null;
}

export interface PolyEl extends BaseEl {
  type: "poly";
  points: Pt[];
  fill: string | null;
}

export interface TextEl extends BaseEl {
  type: "text";
  pos: Pt;
  text: string;
  fontSize: number;
}

export type DrEl = PenEl | LineEl | ShapeEl | PolyEl | TextEl;

export interface DrawDoc {
  version: number;
  w: number;
  h: number;
  elements: DrEl[];
}

type Tool = "select" | "pen" | "line" | "arrow" | "rect" | "ellipse" | "text" | "eraser";

const FONT_STACK = `Inter, "Segoe UI", system-ui, -apple-system, sans-serif`;
const LINE_HEIGHT = 1.25;
const OUT_PAD = 26;
const MAGNET = 6; // raio do "ímã" de alinhamento (px)

const dist2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function arrowHead(a: Pt, b: Pt, w: number): [Pt, Pt, Pt] {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = clamp(14 + w * 2.2, 14, 36);
  const half = len * 0.5;
  const p1 = { x: b.x - len * Math.cos(ang) + half * Math.sin(ang), y: b.y - len * Math.sin(ang) - half * Math.cos(ang) };
  const p2 = { x: b.x - len * Math.cos(ang) - half * Math.sin(ang), y: b.y - len * Math.sin(ang) + half * Math.cos(ang) };
  return [b, p1, p2];
}

export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return map[c];
  });
}

function measureText(text: string, fontSize: number): { w: number; h: number } {
  if (!measureText.ctx) measureText.ctx = document.createElement("canvas").getContext("2d");
  const ctx = measureText.ctx!;
  ctx.font = `${fontSize}px ${FONT_STACK}`;
  const lines = text.split("\n");
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  return { w, h: lines.length * fontSize * LINE_HEIGHT };
}
measureText.ctx = null as CanvasRenderingContext2D | null;

// ==========================================================================
// Geometria / reconhecimento de formas (funções puras, fáceis de testar)
// ==========================================================================

export function bboxOfPoints(points: Pt[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Simplificação Ramer–Douglas–Peucker. */
export function simplify(points: Pt[], eps: number): Pt[] {
  if (points.length <= 2) return points.slice();
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop()!;
    let maxDist = -1;
    let idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = distToSeg(points[i], points[i0], points[i1]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist > eps && idx > 0) {
      keep[idx] = true;
      stack.push([i0, idx], [idx, i1]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function distToRectEdge(p: Pt, b: { x: number; y: number; w: number; h: number }): number {
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const dx = Math.max(b.x - p.x, 0, p.x - x1);
  const dy = Math.max(b.y - p.y, 0, p.y - y1);
  const distOutside = Math.hypot(dx, dy);
  if (distOutside > 0) return distOutside;
  // dentro: distância até a borda mais próxima
  return Math.min(p.x - b.x, x1 - p.x, p.y - b.y, y1 - p.y);
}

function coversFourSides(points: Pt[], b: { x: number; y: number; w: number; h: number }, tol: number): number {
  const sides = { top: false, bottom: false, left: false, right: false };
  for (const p of points) {
    if (Math.abs(p.y - b.y) <= tol) sides.top = true;
    if (Math.abs(p.y - (b.y + b.h)) <= tol) sides.bottom = true;
    if (Math.abs(p.x - b.x) <= tol) sides.left = true;
    if (Math.abs(p.x - (b.x + b.w)) <= tol) sides.right = true;
  }
  return (sides.top ? 1 : 0) + (sides.bottom ? 1 : 0) + (sides.left ? 1 : 0) + (sides.right ? 1 : 0);
}

export interface StrokeStyle {
  id: string;
  color: string;
  width: number;
  fill: string | null;
}

export interface FittedLine {
  /** extremos ajustados (linha ideal) */
  a: Pt;
  b: Pt;
  /** ponto médio usado como origem do ajuste */
  origin: Pt;
  /** direção da reta (unitária) */
  dir: Pt;
  /** maior desvio perpendicular encontrado */
  maxDev: number;
}

/** Ajusta a reta ideal (mínimos quadrados) ao conjunto de pontos. */
export function fitLine(points: Pt[]): FittedLine | null {
  const n = points.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  let t0 = Infinity;
  let t1 = -Infinity;
  let maxDev = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    const t = dx * dir.x + dy * dir.y;
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
    maxDev = Math.max(maxDev, Math.abs(-dx * dir.y + dy * dir.x));
  }
  return {
    a: { x: mx + dir.x * t0, y: my + dir.y * t0 },
    b: { x: mx + dir.x * t1, y: my + dir.y * t1 },
    origin: { x: mx, y: my },
    dir,
    maxDev,
  };
}

/** Projeta um ponto sobre a reta ajustada (endireita os "ganchos" das pontas). */
export function projectOnFitted(p: Pt, fit: FittedLine): Pt {
  const t = (p.x - fit.origin.x) * fit.dir.x + (p.y - fit.origin.y) * fit.dir.y;
  return { x: fit.origin.x + fit.dir.x * t, y: fit.origin.y + fit.dir.y * t };
}

/** Suaviza o traço (Chaikin) mantendo o desenho, sem o tremor da mão. */
export function smoothStroke(points: Pt[], iterations = 2): Pt[] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    if (pts.length < 4) break;
    const out: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      out.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 });
      out.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j];
      count++;
    }
    out.push(sum / count);
  }
  return out;
}

/**
 * "Melhora" uma ondulação desenhada à mão: encontra o ritmo e a altura da onda
 * e devolve uma onda regular (limpa) parecida com o que foi desenhado.
 * Se o traço não for uma onda, devolve null (aí só vale a suavização normal).
 */
export function idealizeWave(points: Pt[]): Pt[] | null {
  const n = points.length;
  if (n < 24) return null;
  const first = points[0];
  const last = points[n - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const span = horizontal ? Math.abs(dx) : Math.abs(dy);
  if (span < 90) return null;

  const dir = (horizontal ? dx : dy) >= 0 ? 1 : -1;
  const mainVal = (p: Pt) => (horizontal ? p.x : p.y) * dir;
  const offVal = (p: Pt) => (horizontal ? p.y : p.x);
  const start = mainVal(first);

  const bins = 160;
  const sums = new Array<number>(bins).fill(0);
  const counts = new Array<number>(bins).fill(0);
  for (const p of points) {
    const rel = clamp((mainVal(p) - start) / span, 0, 1);
    const i = Math.min(bins - 1, Math.floor(rel * bins));
    sums[i] += offVal(p);
    counts[i]++;
  }
  const g: number[] = [];
  let lastVal = offVal(first);
  for (let i = 0; i < bins; i++) {
    if (counts[i] > 0) lastVal = sums[i] / counts[i];
    g.push(lastVal);
  }

  // 1ª passada: existe oscilação de verdade? (histerese ignora o tremor da mão)
  const base1 = movingAverage(g, 7);
  const mean1 = base1.reduce((s, v) => s + v, 0) / base1.length;
  const dev1 = base1.map((v) => v - mean1);
  const amp1 = Math.sqrt(dev1.reduce((s, v) => s + v * v, 0) / dev1.length) * Math.SQRT2;
  if (amp1 < 6) return null;
  let state = 0;
  let changes = 0;
  for (const v of dev1) {
    if (v > amp1 * 0.35 && state !== 1) {
      if (state === -1) changes++;
      state = 1;
    } else if (v < -amp1 * 0.35 && state !== -1) {
      if (state === 1) changes++;
      state = -1;
    }
  }
  if (changes < 2) return null; // menos de uma onda completa

  // 2ª passada: suaviza bem menos que a onda, só para tirar o tremor da mão
  const approxPeriod = span / Math.max(changes / 2, 1);
  if (approxPeriod < 45) return null; // rápido demais: é tremor, não onda
  const window = Math.max(5, Math.round((bins * approxPeriod) / span / 8));
  const smooth = movingAverage(g, window);
  const baseline = smooth.reduce((s, v) => s + v, 0) / smooth.length;
  const dev = smooth.map((v) => v - baseline);

  let ampMax = 0;
  for (const v of dev) ampMax = Math.max(ampMax, Math.abs(v));
  if (ampMax < 6) return null;

  const peaks: number[] = [];
  const troughs: number[] = [];
  for (let i = 1; i < dev.length - 1; i++) {
    const v = dev[i];
    if (v > dev[i - 1] && v >= dev[i + 1] && v > ampMax * 0.5) peaks.push(i);
    if (v < dev[i - 1] && v <= dev[i + 1] && v < -ampMax * 0.5) troughs.push(i);
  }
  if (peaks.length < 1 || troughs.length < 1) return null; // lombada/semiesboço não é onda

  // junta extremos vizinhos: o ruído às vezes cria "degraus" no topo/base do traço
  const minGapPx = Math.max(30, approxPeriod / 8);
  const merged: number[] = [];
  for (const pos of [...peaks, ...troughs].sort((a, b) => a - b)) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && (pos - prev) * (span / bins) < minGapPx) {
      if (Math.abs(dev[pos]) > Math.abs(dev[prev])) merged[merged.length - 1] = pos;
    } else {
      merged.push(pos);
    }
  }
  if (merged.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < merged.length; i++) gaps.push((merged[i] - merged[i - 1]) * (span / bins));
  const gapMean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
  const gapStd = Math.sqrt(gaps.reduce((s, v) => s + (v - gapMean) ** 2, 0) / gaps.length);
  if (gapMean < 40 || gapStd / gapMean > 0.5) return null; // ritmo irregular: melhor não mexer
  const halfPeriodPx = gapMean;

  const extremaVals = merged.map((i) => Math.abs(dev[i]));
  const amp = extremaVals.reduce((s, v) => s + v, 0) / extremaVals.length;
  if (amp < 6) return null;

  // onda mais senoidal ou mais "quadrada" (com platôs) conforme o desenho
  const plateau = dev.filter((v) => Math.abs(v) > amp * 0.62).length / dev.length;
  const squareness = clamp((plateau - 0.28) / 0.4, 0, 0.85);
  const power = 1 - 0.7 * squareness;

  // fase: alinha a onda idealizada no primeiro pico (ou vale) do desenho
  const firstExtremum = merged[0];
  const rel0 = firstExtremum / (bins - 1);
  const target = dev[firstExtremum] > 0 ? Math.PI / 2 : -Math.PI / 2;
  const phase = target - (Math.PI * rel0 * span) / halfPeriodPx;

  const steps = Math.max(90, Math.round(span / 3));
  const out: Pt[] = [];
  for (let s = 0; s <= steps; s++) {
    const rel = s / steps;
    const theta = (Math.PI * rel * span) / halfPeriodPx + phase;
    const sn = Math.sin(theta);
    const shaped = Math.sign(sn) * Math.pow(Math.abs(sn), power);
    const offset = baseline + amp * shaped;
    const mainPos = start + dir * (rel * span);
    out.push(horizontal ? { x: mainPos, y: offset } : { x: offset, y: mainPos });
  }

  // confere se a onda idealizada realmente parece com o traço original
  let err = 0;
  for (let i = 0; i < bins; i++) {
    const idx = Math.min(out.length - 1, Math.round((i / (bins - 1)) * (out.length - 1)));
    err += (offVal(out[idx]) - g[i]) ** 2;
  }
  const rmsErr = Math.sqrt(err / bins);
  if (rmsErr > amp * 0.6) return null;
  return out;
}

/**
 * Assistente de desenho: tenta transformar um traço à mão livre em uma forma
 * limpa (linha, retângulo, elipse/ círculo, triângulo ou polígono).
 * Devolve `null` quando é melhor manter o traço como está (desenho livre).
 */
export function recognizeStroke(points: Pt[], style: StrokeStyle): DrEl | null {
  if (points.length < 8) return null;
  const bb = bboxOfPoints(points);
  const diag = Math.hypot(bb.w, bb.h);
  if (diag < 34) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const gap = Math.hypot(first.x - last.x, first.y - last.y);
  const closed = gap <= Math.max(26, diag * 0.22);
  // Mais tolerante que um desenho técnico: reduz os tremores da mão antes
  // de contar os cantos, sem apagar o reconhecimento de uma forma livre.
  const eps = Math.max(4, diag * 0.045);
  const simplified = simplify(points, eps);
  const corners = closed && simplified.length > 2 ? simplified.slice(0, -1) : simplified;

  const base = { id: style.id, color: style.color, width: style.width };

  if (closed) {
    // --- retângulo? (4–6 cantos e todos os pontos junto da borda) ---
    if (corners.length >= 4 && corners.length <= 10) {
      let allNear = true;
      const tolEdge = Math.max(6, diag * 0.09);
      for (const p of points) {
        if (distToRectEdge(p, bb) > tolEdge) {
          allNear = false;
          break;
        }
      }
      if (allNear && coversFourSides(points, bb, tolEdge) >= 4) {
        // se o retângulo desenhado está "quase" alinhado → endireita nos eixos
        const a0 = corners[0];
        const a1 = corners[1];
        const ang = Math.atan2(a1.y - a0.y, a1.x - a0.x);
        const quarter = Math.PI / 2;
        const off = Math.abs(((ang % quarter) + quarter) % quarter);
        const offAxis = Math.min(off, quarter - off);
        if (offAxis < (24 * Math.PI) / 180) {
          return { ...base, type: "rect", a: { x: bb.x, y: bb.y }, b: { x: bb.x + bb.w, y: bb.y + bb.h }, fill: style.fill };
        }
        return { ...base, type: "poly", points: corners.map((p) => ({ ...p })), fill: style.fill };
      }
    }

    // --- elipse / círculo? (desvio médio em relação à elipse do bbox) ---
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;
    const rx = Math.max(bb.w / 2, 1);
    const ry = Math.max(bb.h / 2, 1);
    let dev = 0;
    for (const p of points) dev += Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
    const meanDev = dev / points.length;
    if (meanDev < 0.12) {
      return { ...base, type: "ellipse", a: { x: bb.x, y: bb.y }, b: { x: bb.x + bb.w, y: bb.y + bb.h }, fill: style.fill };
    }

    // --- triângulo ou outro polígono fechado ---
    if (corners.length >= 3 && corners.length <= 8) {
      return { ...base, type: "poly", points: corners.map((p) => ({ ...p })), fill: style.fill };
    }
    return null;
  }

  // --- linha reta? (corta os "ganchos" que a mão faz nas pontas do traço) ---
  const n = points.length;
  const trim = Math.max(2, Math.floor(n * 0.12));
  const inner = n > trim * 2 + 4 ? points.slice(trim, n - trim) : points;
  const fitInner = fitLine(inner);
  if (fitInner) {
    const innerLen = Math.hypot(fitInner.b.x - fitInner.a.x, fitInner.b.y - fitInner.a.y);
    const tol = Math.max(4.5, innerLen * 0.05);
    if (innerLen > 40 && fitInner.maxDev <= tol) {
      // miolo reto: projeta as pontas na reta ideal e limita a extensão
      const tOf = (p: Pt) =>
        (p.x - fitInner.origin.x) * fitInner.dir.x + (p.y - fitInner.origin.y) * fitInner.dir.y;
      const t0 = tOf(fitInner.a);
      const t1 = tOf(fitInner.b);
      const pad = Math.max(30, innerLen * 0.25);
      const tA = clamp(tOf(points[0]), t0 - pad, t1 + pad);
      const tB = clamp(tOf(points[n - 1]), t0 - pad, t1 + pad);
      if (Math.abs(tB - tA) > 40) {
        return {
          ...base,
          type: "line",
          a: {
            x: fitInner.origin.x + fitInner.dir.x * Math.min(tA, tB),
            y: fitInner.origin.y + fitInner.dir.y * Math.min(tA, tB),
          },
          b: {
            x: fitInner.origin.x + fitInner.dir.x * Math.max(tA, tB),
            y: fitInner.origin.y + fitInner.dir.y * Math.max(tA, tB),
          },
        };
      }
    }
  }
  return null;
}

/** Encaixa o ângulo em múltiplos de 45° quando estiver perto (assistido). */
export function snapAngle(a: Pt, b: Pt, tolRad = 0.14): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 24) return b;
  const step = Math.PI / 4;
  const ang = Math.atan2(dy, dx);
  const snapped = Math.round(ang / step) * step;
  if (Math.abs(ang - snapped) > tolRad) return b;
  return { x: a.x + Math.cos(snapped) * len, y: a.y + Math.sin(snapped) * len };
}

// ---------- ligações entre formas (setas/linhas que "grudam") ----------

/** Caixa usada para ligar pontas (caneta livre não entra). */
export function anchorBox(el: DrEl): { x: number; y: number; w: number; h: number } | null {
  switch (el.type) {
    case "rect":
    case "ellipse":
      return {
        x: Math.min(el.a.x, el.b.x),
        y: Math.min(el.a.y, el.b.y),
        w: Math.abs(el.b.x - el.a.x),
        h: Math.abs(el.b.y - el.a.y),
      };
    case "poly":
      return bboxOfPoints(el.points);
    case "text":
      return elBounds(el);
    default:
      return null;
  }
}

/** Centro da forma (usado nas ligações). */
export function shapeCenter(el: DrEl): Pt {
  const b = anchorBox(el) ?? elBounds(el);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Ângulo (em relação ao centro da forma) do ponto indicado. */
export function angleFrom(el: DrEl, p: Pt): number {
  const c = shapeCenter(el);
  return Math.atan2(p.y - c.y, p.x - c.x);
}

/** Ponto da borda da forma no ângulo indicado (fica fixo e acompanha a forma). */
export function borderPointAt(el: DrEl, angle: number): Pt {
  const b = anchorBox(el) ?? elBounds(el);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (el.type === "ellipse") {
    return { x: cx + (b.w / 2) * cos, y: cy + (b.h / 2) * sin };
  }
  const tx = cos !== 0 ? b.w / 2 / Math.abs(cos) : Infinity;
  const ty = sin !== 0 ? b.h / 2 / Math.abs(sin) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + cos * t, y: cy + sin * t };
}

/** Ponto da borda da forma na direção de `toward` (usado ao ligar as pontas). */
export function borderPointToward(el: DrEl, toward: Pt): Pt {
  return borderPointAt(el, angleFrom(el, toward));
}

/**
 * Distância até a borda da forma: positiva fora, negativa dentro
 * (o valor absoluto é a distância até o traço da forma).
 */
export function distanceToShapeBorder(el: DrEl, p: Pt): number {
  const b = anchorBox(el);
  if (!b || b.w === 0 || b.h === 0) return Infinity;
  if (el.type === "ellipse") {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = Math.max(b.w / 2, 1);
    const ry = Math.max(b.h / 2, 1);
    const v = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
    const minR = Math.min(rx, ry);
    return v <= 1 ? -(1 - v) * minR : (v - 1) * minR;
  }
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  if (p.x >= b.x && p.x <= x1 && p.y >= b.y && p.y <= y1) {
    return -Math.min(p.x - b.x, x1 - p.x, p.y - b.y, y1 - p.y);
  }
  const dx = Math.max(b.x - p.x, 0, p.x - x1);
  const dy = Math.max(b.y - p.y, 0, p.y - y1);
  return Math.hypot(dx, dy);
}

// ==========================================================================
// Board
// ==========================================================================

interface BoardOptions {
  w: number;
  h: number;
  /** true = a tela se ajusta à largura do contêiner (modo embutido) */
  fit: boolean;
  assist: boolean;
  autoHeight?: boolean;
}

export class Board {
  tool: Tool = "pen";
  color = "#1f2937";
  width = 3;
  fillEnabled = false;
  whiteBg = true;
  assist: boolean;
  onChange: (() => void) | null = null;

  readonly W: number;
  readonly H: number;

  private canvas: HTMLCanvasElement;
  private host: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private opts: BoardOptions;
  private els: DrEl[] = [];
  private selectedId: string | null = null;
  private draft: DrEl | null = null;
  private dragFrom: Pt | null = null;
  private dragOrig: DrEl | null = null;
  private dragMoved = false;
  private eraserStarted = false;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private raf = 0;
  private guidesX: number[] = [];
  private guidesY: number[] = [];
  private anchorHighlight: string[] = [];
  private clipboard: DrEl | null = null;
  private lastNudgeAt = 0;
  private zoom = 1;
  private resizeObs: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement, opts: BoardOptions) {
    this.canvas = canvas;
    this.host = host;
    this.opts = opts;
    this.W = opts.w;
    this.H = opts.h;
    this.assist = opts.assist;
    this.ctx = canvas.getContext("2d")!;

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("dblclick", this.onDblClick);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    if (opts.fit) {
      this.resizeObs = new ResizeObserver(() => this.fit());
      this.resizeObs.observe(canvas.parentElement ?? host);
    }
    this.fit();
    this.updateCursor();
    this.request();
  }

  dispose(): void {
    this.resizeObs?.disconnect();
  }

  /** Ajusta o tamanho visual do canvas à largura disponível (mantendo a proporção). */
  private fit(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const hostW = (this.canvas.parentElement ?? this.host).clientWidth;
    const avail = Math.max(160, hostW - (this.opts.fit ? 20 : 0));
    let cssW = this.W;
    let cssH = this.H;
    if (this.opts.fit) {
      cssW = Math.min(avail, this.W) * this.zoom;
      cssH = (cssW * this.H) / this.W;
      const maxH = Math.max(240, Math.round(window.innerHeight * 0.62)) * this.zoom;
      if (cssH > maxH) {
        cssH = maxH;
        cssW = (cssH * this.W) / this.H;
      }
    }
    this.canvas.style.width = `${Math.round(cssW)}px`;
    this.canvas.style.height = `${Math.round(cssH)}px`;
    // buffer do tamanho exibido (× densidade da tela): sem redução forte, a grade e os
    // traços de 1px continuam visíveis em qualquer zoom (antes pareciam sumir)
    const bufferScale = clamp(((cssW * dpr) / this.W), 0.1, 3);
    this.canvas.width = Math.max(1, Math.round(this.W * bufferScale));
    this.canvas.height = Math.max(1, Math.round(this.H * bufferScale));
    this.request();
  }

  // ---------- zoom ----------

  getZoom(): number {
    return this.zoom;
  }

  setZoom(zoom: number): void {
    this.zoom = clamp(Math.round(zoom * 100) / 100, 0.5, 3);
    this.fit();
  }

  // ---------- estado público ----------

  isEmpty(): boolean {
    return this.els.length === 0;
  }

  hasSelection(): boolean {
    return this.selectedEl() !== null;
  }

  hasClipboard(): boolean {
    return this.clipboard !== null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  serialize(): string {
    this.syncAnchors();
    const doc: DrawDoc = { version: 1, w: this.W, h: this.H, elements: this.els };
    return JSON.stringify(doc);
  }

  /** Usado ao reabrir um desenho salvo: adiciona elementos sem entrar no histórico. */
  addElement(el: DrEl): void {
    this.els.push(el);
    this.request();
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    if (tool !== "select") this.selectedId = null;
    this.clearGuides();
    this.updateCursor();
    this.request();
    this.onChange?.();
  }

  setColor(color: string): void {
    this.color = color;
    const sel = this.selectedEl();
    if (sel) {
      this.pushUndo();
      sel.color = color;
      if (sel.type === "rect" || sel.type === "ellipse" || sel.type === "poly") sel.fill = this.fillEnabled ? color : null;
    }
    this.request();
  }

  setWidth(w: number): void {
    this.width = w;
    const sel = this.selectedEl();
    if (sel) {
      this.pushUndo();
      sel.width = w;
    }
    this.request();
  }

  setFillEnabled(on: boolean): void {
    this.fillEnabled = on;
    const sel = this.selectedEl();
    if (sel && (sel.type === "rect" || sel.type === "ellipse" || sel.type === "poly")) {
      this.pushUndo();
      sel.fill = on ? this.color : null;
    }
    this.request();
  }

  setWhiteBg(on: boolean): void {
    this.whiteBg = on;
    this.request();
  }

  setAssist(on: boolean): void {
    this.assist = on;
    this.request();
  }

  private updateCursor(): void {
    const cursors: Record<Tool, string> = {
      select: "default",
      pen: "crosshair",
      line: "crosshair",
      arrow: "crosshair",
      rect: "crosshair",
      ellipse: "crosshair",
      text: "text",
      eraser: "cell",
    };
    this.canvas.style.cursor = cursors[this.tool] ?? "crosshair";
  }

  private selectedEl(): DrEl | null {
    if (!this.selectedId) return null;
    return this.els.find((e) => e.id === this.selectedId) ?? null;
  }

  private clearGuides(): void {
    this.guidesX = [];
    this.guidesY = [];
  }

  // ---------- histórico ----------

  private pushUndo(): void {
    this.undoStack.push(JSON.stringify(this.els));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify(this.els));
    this.els = JSON.parse(prev) as DrEl[];
    if (this.selectedId && !this.els.some((e) => e.id === this.selectedId)) this.selectedId = null;
    this.request();
    this.onChange?.();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify(this.els));
    this.els = JSON.parse(next) as DrEl[];
    this.request();
    this.onChange?.();
  }

  duplicateSelected(): void {
    const sel = this.selectedEl();
    if (!sel) return;
    this.pushUndo();
    const copy = JSON.parse(JSON.stringify(sel)) as DrEl;
    copy.id = uid();
    translateEl(copy, 24, 24);
    this.els.push(copy);
    this.selectedId = copy.id;
    this.request();
    this.onChange?.();
  }

  /** Guarda o elemento selecionado para colar depois (Ctrl+C). */
  copySelected(): boolean {
    const sel = this.selectedEl();
    if (!sel) return false;
    this.clipboard = cloneEl(sel);
    return true;
  }

  /** Cola a última cópia com um deslocamento, mantendo o padrão do desenho (Ctrl+V). */
  pasteClipboard(): boolean {
    if (!this.clipboard) return false;
    this.pushUndo();
    const copy = cloneEl(this.clipboard);
    copy.id = uid();
    translateEl(copy, 24, 24);
    translateEl(this.clipboard, 24, 24);
    this.els.push(copy);
    this.selectedId = copy.id;
    this.request();
    this.onChange?.();
    return true;
  }

  /** Move o elemento selecionado em passos pequenos (setas do teclado). */
  nudgeSelected(dx: number, dy: number): boolean {
    const sel = this.selectedEl();
    if (!sel) return false;
    const now = Date.now();
    if (now - this.lastNudgeAt > 700) this.pushUndo();
    this.lastNudgeAt = now;
    translateEl(sel, dx, dy);
    this.request();
    this.onChange?.();
    return true;
  }

  deleteSelected(): void {
    const sel = this.selectedEl();
    if (!sel) return;
    this.pushUndo();
    this.els = this.els.filter((e) => e.id !== sel.id);
    this.selectedId = null;
    this.request();
    this.onChange?.();
  }

  clearAll(): void {
    if (this.els.length === 0) return;
    this.pushUndo();
    this.els = [];
    this.selectedId = null;
    this.request();
    this.onChange?.();
  }

  // ---------- ímã / alinhamento automático ----------

  private targets(): { x: number[]; y: number[] } {
    const x: number[] = [0, this.W / 2, this.W];
    const y: number[] = [0, this.H / 2, this.H];
    for (const el of this.els) {
      const b = elBounds(el);
      x.push(b.x, b.x + b.w / 2, b.x + b.w);
      y.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { x, y };
  }

  /** Alinha um ponto (usado ao desenhar) com bordas/centros de outros elementos. */
  private magnetPoint(p: Pt): Pt {
    if (!this.assist) return p;
    const t = this.targets();
    let bestX: number | null = null;
    let bestY: number | null = null;
    for (const c of t.x) {
      if (Math.abs(c - p.x) <= MAGNET && (bestX === null || Math.abs(c - p.x) < Math.abs(bestX - p.x))) bestX = c;
    }
    for (const c of t.y) {
      if (Math.abs(c - p.y) <= MAGNET && (bestY === null || Math.abs(c - p.y) < Math.abs(bestY - p.y))) bestY = c;
    }
    this.guidesX = bestX === null ? [] : [bestX];
    this.guidesY = bestY === null ? [] : [bestY];
    return { x: bestX ?? p.x, y: bestY ?? p.y };
  }

  /** Alinha o elemento em movimento com os demais (ímã) e devolve os guias. */
  private magnetDelta(sel: DrEl, dx: number, dy: number): { dx: number; dy: number } {
    if (!this.assist) return { dx, dy };
    const moved = cloneEl(sel);
    translateEl(moved, dx, dy);
    const mb = elBounds(moved);
    const mineX = [mb.x, mb.x + mb.w / 2, mb.x + mb.w];
    const mineY = [mb.y, mb.y + mb.h / 2, mb.y + mb.h];
    const t = this.targets();

    let bestX: { d: number; v: number } | null = null;
    let bestY: { d: number; v: number } | null = null;
    for (const c of t.x) {
      for (const m of mineX) {
        const d = c - m;
        if (Math.abs(d) <= MAGNET && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, v: c };
      }
    }
    for (const c of t.y) {
      for (const m of mineY) {
        const d = c - m;
        if (Math.abs(d) <= MAGNET && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, v: c };
      }
    }
    this.guidesX = bestX ? [bestX.v] : [];
    this.guidesY = bestY ? [bestY.v] : [];
    return { dx: dx + (bestX?.d ?? 0), dy: dy + (bestY?.d ?? 0) };
  }

  // ---------- ligações entre formas ----------

  /**
   * Forma perto o bastante para a ponta se ligar nela.
   * Só considera a FAIXA em volta da borda — desenhar dentro da forma
   * (longe da borda) não liga nada e não move nada.
   */
  private anchorAt(p: Pt, excludeIds: (string | undefined)[] = []): DrEl | null {
    if (!this.assist) return null;
    const snap = Math.max(16, this.width + 14);
    let best: { el: DrEl; d: number } | null = null;
    for (const el of this.els) {
      if (el.type === "pen") continue;
      if (excludeIds.includes(el.id)) continue;
      const d = Math.abs(distanceToShapeBorder(el, p));
      if (d <= snap && (!best || d < best.d)) best = { el, d };
    }
    return best?.el ?? null;
  }

  /** Mantém as pontas ligadas nas formas (acompanham quando a forma se move). */
  private syncAnchors(): void {
    for (const el of this.els) {
      if (el.type !== "line" && el.type !== "arrow") continue;
      const from = el.fromId ? this.els.find((e) => e.id === el.fromId) : undefined;
      const to = el.toId ? this.els.find((e) => e.id === el.toId) : undefined;
      if (from && el.fromAngle !== undefined) el.a = borderPointAt(from, el.fromAngle);
      if (to && el.toAngle !== undefined) el.b = borderPointAt(to, el.toAngle);
    }
  }

  /** Atualiza a ponta em construção de uma linha/seta, ligando nas formas próximas. */
  private updateLineDraft(d: LineEl, raw: Pt, shift: boolean): void {
    const p = this.magnetPoint(raw);
    let target = shift ? constrainLine(d.a, p) : this.assist ? snapAngle(d.a, p) : p;

    // ponta final: liga na forma mais próxima (guardando o ângulo de fixação)
    const endAnchor = this.anchorAt(target, [d.id, d.fromId]);
    if (endAnchor) {
      if (endAnchor.id !== d.toId || d.toAngle === undefined) {
        d.toId = endAnchor.id;
        d.toAngle = angleFrom(endAnchor, target);
      }
      target = borderPointAt(endAnchor, d.toAngle);
    } else {
      d.toId = undefined;
      d.toAngle = undefined;
    }

    // ponta inicial: mesma ideia (o ângulo é calculado na posição original do clique)
    const startAnchor = this.anchorAt(d.a, [d.id, d.toId]);
    if (startAnchor) {
      if (startAnchor.id !== d.fromId || d.fromAngle === undefined) {
        d.fromId = startAnchor.id;
        d.fromAngle = angleFrom(startAnchor, d.a);
      }
      d.a = borderPointAt(startAnchor, d.fromAngle);
      if (d.toId && d.toAngle !== undefined) {
        const toEl = this.els.find((e) => e.id === d.toId);
        if (toEl) target = borderPointAt(toEl, d.toAngle);
      }
    } else {
      d.fromId = undefined;
      d.fromAngle = undefined;
    }

    d.b = target;
    this.anchorHighlight = [d.fromId, d.toId].filter((id): id is string => !!id);
  }

  /** Liga as pontas de uma linha/seta nas formas próximas (usado ao terminar de desenhar). */
  private attachLineEnds(el: LineEl): void {
    if (!this.assist) return;
    const startPoint = { ...el.a };
    const endPoint = { ...el.b };

    const from = this.anchorAt(startPoint, [el.id]);
    if (from) {
      el.fromId = from.id;
      el.fromAngle = angleFrom(from, startPoint);
      el.a = borderPointAt(from, el.fromAngle);
    } else {
      el.fromId = undefined;
      el.fromAngle = undefined;
    }

    const to = this.anchorAt(endPoint, [el.id, el.fromId]);
    if (to) {
      el.toId = to.id;
      el.toAngle = angleFrom(to, endPoint);
      el.b = borderPointAt(to, el.toAngle);
    } else {
      el.toId = undefined;
      el.toAngle = undefined;
    }

    this.anchorHighlight = [el.fromId, el.toId].filter((id): id is string => !!id);
  }

  // ---------- ponteiro ----------

  private pt(e: PointerEvent): Pt {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * this.W) / Math.max(r.width, 1),
      y: ((e.clientY - r.top) * this.H) / Math.max(r.height, 1),
    };
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* alguns ambientes não suportam captura */
    }
    // foca sem rolar a tela (senão o navegador "puxa" a vista para o canvas a cada traço)
    this.canvas.focus({ preventScroll: true });
    const p = this.pt(e);

    if (this.tool === "select") {
      const hit = this.hitTest(p);
      this.selectedId = hit?.id ?? null;
      if (hit && e.altKey) {
        // Alt + arrastar = copia o objeto e move a cópia (mantém o padrão)
        this.pushUndo();
        const copy = cloneEl(hit);
        copy.id = uid();
        this.els.push(copy);
        this.selectedId = copy.id;
        this.dragFrom = p;
        this.dragOrig = cloneEl(copy);
        this.dragMoved = false;
        this.request();
        this.onChange?.();
        return;
      }
      if (hit) {
        this.dragFrom = p;
        this.dragOrig = structuredClone(hit);
        this.dragMoved = false;
      }
      this.request();
      this.onChange?.();
      return;
    }

    if (this.tool === "eraser") {
      this.eraserStarted = false;
      this.eraseAt(p);
      return;
    }

    if (this.tool === "text") {
      this.openTextInput(p.x, p.y, null);
      return;
    }

    this.pushUndo();
    const base = { id: uid(), color: this.color, width: this.width };
    if (this.tool === "pen") {
      this.draft = { ...base, type: "pen", points: [p, { x: p.x + 0.01, y: p.y + 0.01 }] };
    } else if (this.tool === "line" || this.tool === "arrow") {
      this.draft = { ...base, type: this.tool, a: p, b: p };
    } else {
      this.draft = { ...base, type: this.tool, a: p, b: p, fill: this.fillEnabled ? this.color : null };
    }
    this.els.push(this.draft);
    this.request();
  };

  private onMove = (e: PointerEvent): void => {
    const raw = this.pt(e);
    const shift = e.shiftKey;

    if (this.tool === "eraser" && e.buttons === 1) {
      this.eraseAt(raw);
      return;
    }

    if (this.draft) {
      const d = this.draft;
      if (d.type === "pen") {
        const last = d.points[d.points.length - 1];
        if (dist2(last, raw) > 2.5) d.points.push(raw);
      } else if (d.type === "line" || d.type === "arrow") {
        this.updateLineDraft(d, raw, shift);
      } else if (d.type === "rect" || d.type === "ellipse") {
        let p = this.magnetPoint(raw);
        if (shift) {
          const size = Math.max(Math.abs(p.x - d.a.x), Math.abs(p.y - d.a.y));
          p = { x: d.a.x + Math.sign(p.x - d.a.x) * size, y: d.a.y + Math.sign(p.y - d.a.y) * size };
        } else if (this.assist) {
          const dx = Math.abs(p.x - d.a.x);
          const dy = Math.abs(p.y - d.a.y);
          const bigger = Math.max(dx, dy);
          if (bigger > 24 && Math.abs(dx - dy) / bigger < 0.09) {
            p = { x: d.a.x + Math.sign(p.x - d.a.x) * bigger, y: d.a.y + Math.sign(p.y - d.a.y) * bigger };
          }
        }
        d.b = p;
      }
      this.request();
      return;
    }

    if (this.dragFrom && this.dragOrig && this.tool === "select") {
      const sel = this.selectedEl();
      if (!sel) return;
      const dx0 = raw.x - this.dragFrom.x;
      const dy0 = raw.y - this.dragFrom.y;
      if (dx0 !== 0 || dy0 !== 0) this.dragMoved = true;
      const { dx, dy } = this.magnetDelta(this.dragOrig, dx0, dy0);
      const moved = cloneEl(this.dragOrig);
      translateEl(moved, dx, dy);
      Object.assign(sel, moved);
      this.request();
    }
  };

  private onUp = (e: PointerEvent): void => {
    try {
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignora */
    }

    if (this.draft) {
      const d = this.draft;
      // usa a posição final do clique para não perder o encaixe
      if (d.type === "line" || d.type === "arrow") this.updateLineDraft(d, this.pt(e), e.shiftKey);
      if (d.type === "pen") {
        // ---- assistente: traço vira forma alinhada quando reconhecido ----
        const snapped = this.assist ? recognizeStroke(d.points, { id: d.id, color: d.color, width: d.width, fill: this.fillEnabled ? this.color : null }) : null;
        if (snapped) {
          const idx = this.els.indexOf(d);
          // linha/seta reconhecida também se liga às formas próximas
          if (snapped.type === "line" || snapped.type === "arrow") this.attachLineEnds(snapped);
          if (idx >= 0) this.els[idx] = snapped;
        } else if (d.points.length < 2) {
          const idx = this.els.indexOf(d);
          if (idx >= 0) this.els.splice(idx, 1);
        } else {
          // não virou forma: tenta regularizar a ondulação; senão, só suaviza
          const ideal = this.assist ? idealizeWave(d.points) : null;
          if (ideal) {
            d.points = ideal;
          } else {
            const simplified = simplify(d.points, 1.1);
            const smoothed = smoothStroke(simplified, simplified.length > 140 ? 1 : 2);
            d.points = simplify(smoothed, 0.7);
          }
        }
      } else if (d.type === "line" || d.type === "arrow") {
        if (dist2(d.a, d.b) < 4) d.b = { x: d.a.x + 1, y: d.a.y + 1 };
        this.attachLineEnds(d);
      }
      this.draft = null;
      this.clearGuides();
      this.anchorHighlight = [];
      this.request();
      this.onChange?.();
    }

    if (this.dragFrom && this.dragOrig) {
      const orig = this.dragOrig;
      if (this.dragMoved) {
        const cur = JSON.stringify(this.els);
        const sel = this.selectedEl();
        if (sel) {
          const restore = this.els.map((el) => (el.id === sel.id ? orig : el));
          this.els = restore;
          this.undoStack.push(JSON.stringify(this.els));
          this.redoStack.length = 0;
          this.els = JSON.parse(cur) as DrEl[];
        }
      }
      this.dragFrom = null;
      this.dragOrig = null;
      this.dragMoved = false;
      this.clearGuides();
      this.onChange?.();
    }
  };

  private onDblClick = (e: MouseEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) * this.W) / Math.max(r.width, 1), y: ((e.clientY - r.top) * this.H) / Math.max(r.height, 1) };
    const hit = this.hitTest(p);
    if (hit?.type === "text") this.openTextInput(hit.pos.x, hit.pos.y, hit);
  };

  private eraseAt(p: Pt): void {
    const hit = this.hitTest(p);
    if (!hit) return;
    if (!this.eraserStarted) {
      this.pushUndo();
      this.eraserStarted = true;
    }
    this.els = this.els.filter((el) => el.id !== hit.id);
    this.request();
    this.onChange?.();
  }

  // ---------- texto ----------

  private openTextInput(x: number, y: number, existing: TextEl | null): void {
    const input = document.createElement("textarea");
    input.className = "draw-text-input";
    input.rows = 1;
    input.spellcheck = false;
    input.value = existing?.text ?? "";
    input.title = "Enter quebra linha · Ctrl+Enter ou clicar fora conclui · Esc cancela";
    const fontSize = existing?.fontSize ?? Math.max(16, Math.round(this.width * 6));
    const scaleX = this.canvas.clientWidth / this.W;
    const scaleY = this.canvas.clientHeight / this.H;
    input.style.left = `${this.canvas.offsetLeft + x * scaleX}px`;
    input.style.top = `${this.canvas.offsetTop + y * scaleY}px`;
    input.style.fontSize = `${fontSize * scaleY}px`;
    input.style.color = existing?.color ?? this.color;

    const fit = () => {
      const lines = input.value.split("\n");
      const longest = Math.max(1, ...lines.map((l) => l.length));
      input.style.width = `${Math.max(150, longest * fontSize * scaleX * 0.62 + 26)}px`;
      input.style.height = "auto";
      input.style.height = `${Math.max(1, lines.length) * fontSize * scaleY * 1.3 + 8}px`;
    };
    input.addEventListener("input", fit);
    fit();

    let done = false;
    const commit = (keep: boolean) => {
      if (done) return;
      done = true;
      const value = keep ? input.value.trim() : existing?.text ?? "";
      input.remove();
      if (keep && value) {
        this.pushUndo();
        if (existing) {
          existing.text = value;
        } else {
          this.els.push({
            id: uid(),
            type: "text",
            pos: { x, y },
            text: value,
            color: this.color,
            width: this.width,
            fontSize,
          });
        }
        this.setTool("select");
      }
      this.request();
      this.onChange?.();
    };

    input.addEventListener("blur", () => commit(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commit(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        commit(existing !== null);
      }
    });

    this.host.append(input);
    input.focus();
    input.select();
  }

  // ---------- render ----------

  private request(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.paintScene();
    });
  }

  private paintScene(): void {
    const ctx = this.ctx;
    const sx = this.canvas.width / this.W;
    const sy = this.canvas.height / this.H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);

    if (this.whiteBg) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, this.W, this.H);
    } else {
      const s = 16;
      for (let y = 0; y < this.H; y += s) {
        for (let x = 0; x < this.W; x += s) {
          ctx.fillStyle = (x / s + y / s) % 2 === 0 ? "#f1f3f6" : "#e6e9ee";
          ctx.fillRect(x, y, s, s);
        }
      }
    }

    this.syncAnchors();
    this.paint(ctx, this.els);

    // guias de alinhamento
    if (this.guidesX.length || this.guidesY.length) {
      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      for (const x of this.guidesX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.H);
        ctx.stroke();
      }
      for (const y of this.guidesY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.W, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // formas ligadas pela ponta em construção
    if (this.anchorHighlight.length) {
      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      for (const id of this.anchorHighlight) {
        const target = this.els.find((e) => e.id === id);
        if (!target) continue;
        const ab = anchorBox(target) ?? elBounds(target);
        ctx.strokeRect(ab.x - 6, ab.y - 6, ab.w + 12, ab.h + 12);
      }
      ctx.restore();
    }

    const sel = this.selectedEl();
    if (sel) {
      const b = elBounds(sel);
      ctx.save();
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#4f46e5";
      for (const [cx, cy] of [
        [b.x - 6, b.y - 6],
        [b.x + b.w + 6, b.y - 6],
        [b.x - 6, b.y + b.h + 6],
        [b.x + b.w + 6, b.y + b.h + 6],
      ]) {
        ctx.beginPath();
        ctx.rect(cx - 4, cy - 4, 8, 8);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private paint(ctx: CanvasRenderingContext2D, els: DrEl[]): void {
    for (const el of els) {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (el.type) {
        case "pen": {
          const pts = el.points;
          if (pts.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length - 1; i++) {
            const m = mid(pts[i], pts[i + 1]);
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
          break;
        }
        case "line": {
          ctx.beginPath();
          ctx.moveTo(el.a.x, el.a.y);
          ctx.lineTo(el.b.x, el.b.y);
          ctx.stroke();
          break;
        }
        case "arrow": {
          ctx.beginPath();
          ctx.moveTo(el.a.x, el.a.y);
          ctx.lineTo(el.b.x, el.b.y);
          ctx.stroke();
          const [t1, t2, t3] = arrowHead(el.a, el.b, el.width);
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y);
          ctx.lineTo(t2.x, t2.y);
          ctx.lineTo(t3.x, t3.y);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "rect": {
          const x = Math.min(el.a.x, el.b.x);
          const y = Math.min(el.a.y, el.b.y);
          const w = Math.abs(el.b.x - el.a.x);
          const hgt = Math.abs(el.b.y - el.a.y);
          roundRect(ctx, x, y, w, hgt, 4);
          if (el.fill) {
            ctx.fillStyle = hexToRgba(el.fill, 0.16);
            ctx.fill();
          }
          ctx.stroke();
          break;
        }
        case "ellipse": {
          const cx = (el.a.x + el.b.x) / 2;
          const cy = (el.a.y + el.b.y) / 2;
          const rx = Math.abs(el.b.x - el.a.x) / 2;
          const ry = Math.abs(el.b.y - el.a.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
          if (el.fill) {
            ctx.fillStyle = hexToRgba(el.fill, 0.16);
            ctx.fill();
          }
          ctx.stroke();
          break;
        }
        case "poly": {
          if (el.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
          ctx.closePath();
          if (el.fill) {
            ctx.fillStyle = hexToRgba(el.fill, 0.16);
            ctx.fill();
          }
          ctx.stroke();
          break;
        }
        case "text": {
          ctx.font = `${el.fontSize}px ${FONT_STACK}`;
          ctx.textBaseline = "top";
          ctx.fillStyle = el.color;
          el.text.split("\n").forEach((line, i) => {
            ctx.fillText(line, el.pos.x, el.pos.y + i * el.fontSize * LINE_HEIGHT);
          });
          break;
        }
      }
      ctx.restore();
    }
  }

  // ---------- hit test ----------

  private hitTest(p: Pt): DrEl | null {
    for (let i = this.els.length - 1; i >= 0; i--) {
      if (hitEl(this.els[i], p)) return this.els[i];
    }
    return null;
  }

  // ---------- exportação ----------

  private contentBounds(): { x: number; y: number; w: number; h: number } | null {
    if (this.els.length === 0) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const el of this.els) {
      const b = elBounds(el);
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w);
      y1 = Math.max(y1, b.y + b.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  toPngDataUrl(scale = 2): string | null {
    this.syncAnchors();
    const b = this.contentBounds();
    if (!b) return null;
    const x0 = b.x - OUT_PAD;
    const y0 = b.y - OUT_PAD;
    const w = Math.ceil((b.w + OUT_PAD * 2) * scale);
    const hgt = Math.ceil((b.h + OUT_PAD * 2) * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = hgt;
    const cc = c.getContext("2d")!;
    cc.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    if (this.whiteBg) {
      cc.fillStyle = "#ffffff";
      cc.fillRect(x0, y0, b.w + OUT_PAD * 2, b.h + OUT_PAD * 2);
    }
    this.paint(cc, this.els);
    return c.toDataURL("image/png");
  }

  toSvg(): string | null {
    this.syncAnchors();
    const b = this.contentBounds();
    if (!b) return null;
    const x0 = b.x - OUT_PAD;
    const y0 = b.y - OUT_PAD;
    const w = b.w + OUT_PAD * 2;
    const hgt = b.h + OUT_PAD * 2;
    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(hgt)}" viewBox="${x0.toFixed(2)} ${y0.toFixed(2)} ${w.toFixed(2)} ${hgt.toFixed(2)}">`
    );
    if (this.whiteBg) {
      parts.push(`<rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${w.toFixed(2)}" height="${hgt.toFixed(2)}" fill="#ffffff"/>`);
    }
    for (const el of this.els) {
      const stroke = `stroke="${el.color}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round"`;
      switch (el.type) {
        case "pen": {
          const d = el.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
          parts.push(`<path d="${d}" fill="none" ${stroke}/>`);
          break;
        }
        case "line":
          parts.push(`<line x1="${el.a.x.toFixed(2)}" y1="${el.a.y.toFixed(2)}" x2="${el.b.x.toFixed(2)}" y2="${el.b.y.toFixed(2)}" ${stroke}/>`);
          break;
        case "arrow": {
          parts.push(`<line x1="${el.a.x.toFixed(2)}" y1="${el.a.y.toFixed(2)}" x2="${el.b.x.toFixed(2)}" y2="${el.b.y.toFixed(2)}" ${stroke}/>`);
          const [t1, t2, t3] = arrowHead(el.a, el.b, el.width);
          parts.push(
            `<polygon points="${t1.x.toFixed(2)},${t1.y.toFixed(2)} ${t2.x.toFixed(2)},${t2.y.toFixed(2)} ${t3.x.toFixed(2)},${t3.y.toFixed(2)}" fill="${el.color}"/>`
          );
          break;
        }
        case "rect": {
          const x = Math.min(el.a.x, el.b.x);
          const y = Math.min(el.a.y, el.b.y);
          const rw = Math.abs(el.b.x - el.a.x);
          const rh = Math.abs(el.b.y - el.a.y);
          const fill = el.fill ? `fill="${el.fill}" fill-opacity="0.16"` : `fill="none"`;
          parts.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" rx="4" ${fill} ${stroke}/>`);
          break;
        }
        case "ellipse": {
          const cx = (el.a.x + el.b.x) / 2;
          const cy = (el.a.y + el.b.y) / 2;
          const rx = Math.abs(el.b.x - el.a.x) / 2;
          const ry = Math.abs(el.b.y - el.a.y) / 2;
          const fill = el.fill ? `fill="${el.fill}" fill-opacity="0.16"` : `fill="none"`;
          parts.push(`<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${Math.max(rx, 0.5).toFixed(2)}" ry="${Math.max(ry, 0.5).toFixed(2)}" ${fill} ${stroke}/>`);
          break;
        }
        case "poly": {
          const pts = el.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
          const fill = el.fill ? `fill="${el.fill}" fill-opacity="0.16"` : `fill="none"`;
          parts.push(`<polygon points="${pts}" ${fill} ${stroke}/>`);
          break;
        }
        case "text": {
          parts.push(
            `<text x="${el.pos.x.toFixed(2)}" y="${el.pos.y.toFixed(2)}" font-family="${FONT_STACK}" font-size="${el.fontSize}" fill="${el.color}">`
          );
          el.text.split("\n").forEach((line, i) => {
            parts.push(`<tspan x="${el.pos.x.toFixed(2)}" dy="${i === 0 ? el.fontSize * 0.82 : el.fontSize * LINE_HEIGHT}">${escapeXml(line)}</tspan>`);
          });
          parts.push(`</text>`);
          break;
        }
      }
    }
    parts.push(`</svg>`);
    return parts.join("");
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function cloneEl(el: DrEl): DrEl {
  return structuredClone(el);
}

function translateEl(el: DrEl, dx: number, dy: number): void {
  switch (el.type) {
    case "pen":
    case "poly":
      el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      break;
    case "line":
    case "arrow":
      el.a = { x: el.a.x + dx, y: el.a.y + dy };
      el.b = { x: el.b.x + dx, y: el.b.y + dy };
      break;
    case "rect":
    case "ellipse":
      el.a = { x: el.a.x + dx, y: el.a.y + dy };
      el.b = { x: el.b.x + dx, y: el.b.y + dy };
      break;
    case "text":
      el.pos = { x: el.pos.x + dx, y: el.pos.y + dy };
      break;
  }
}

function elBounds(el: DrEl): { x: number; y: number; w: number; h: number } {
  const pad = Math.max(el.width / 2, 2);
  switch (el.type) {
    case "pen":
    case "poly": {
      const b = bboxOfPoints(el.points);
      if (!isFinite(b.x)) return { x: 0, y: 0, w: 0, h: 0 };
      return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    }
    case "line":
    case "arrow": {
      const headPad = el.type === "arrow" ? clamp(14 + el.width * 2.2, 14, 36) : 0;
      const p = pad + headPad;
      return {
        x: Math.min(el.a.x, el.b.x) - p,
        y: Math.min(el.a.y, el.b.y) - p,
        w: Math.abs(el.b.x - el.a.x) + p * 2,
        h: Math.abs(el.b.y - el.a.y) + p * 2,
      };
    }
    case "rect":
    case "ellipse":
      return {
        x: Math.min(el.a.x, el.b.x) - pad,
        y: Math.min(el.a.y, el.b.y) - pad,
        w: Math.abs(el.b.x - el.a.x) + pad * 2,
        h: Math.abs(el.b.y - el.a.y) + pad * 2,
      };
    case "text": {
      const m = measureText(el.text || " ", el.fontSize);
      return { x: el.pos.x - 2, y: el.pos.y - 2, w: m.w + 4, h: m.h + 4 };
    }
  }
}

/** Testa se um ponto está dentro de um polígono (ray casting). */
function pointInPolygon(p: Pt, points: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const intersect = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function hitEl(el: DrEl, p: Pt, inside = true): boolean {
  const tol = Math.max(7, el.width + 4);
  switch (el.type) {
    case "pen":
      return el.points.some((q) => dist2(q, p) <= tol * tol);
    case "line":
    case "arrow":
      return distToSeg(p, el.a, el.b) <= tol;
    case "rect": {
      const x0 = Math.min(el.a.x, el.b.x);
      const x1 = Math.max(el.a.x, el.b.x);
      const y0 = Math.min(el.a.y, el.b.y);
      const y1 = Math.max(el.a.y, el.b.y);
      if (inside && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return true;
      if (el.fill && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return true;
      if (p.x < x0 - tol || p.x > x1 + tol || p.y < y0 - tol || p.y > y1 + tol) return false;
      return (
        distToSeg(p, { x: x0, y: y0 }, { x: x1, y: y0 }) <= tol ||
        distToSeg(p, { x: x1, y: y0 }, { x: x1, y: y1 }) <= tol ||
        distToSeg(p, { x: x1, y: y1 }, { x: x0, y: y1 }) <= tol ||
        distToSeg(p, { x: x0, y: y1 }, { x: x0, y: y0 }) <= tol
      );
    }
    case "ellipse": {
      const cx = (el.a.x + el.b.x) / 2;
      const cy = (el.a.y + el.b.y) / 2;
      const rx = Math.max(Math.abs(el.b.x - el.a.x) / 2, 1);
      const ry = Math.max(Math.abs(el.b.y - el.a.y) / 2, 1);
      const v = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
      if (inside && v <= 1) return true;
      if (el.fill && v <= 1) return true;
      return Math.abs(v - 1) <= tol / Math.min(rx, ry);
    }
    case "poly": {
      if (inside && pointInPolygon(p, el.points)) return true;
      for (let i = 0; i < el.points.length; i++) {
        const a = el.points[i];
        const b = el.points[(i + 1) % el.points.length];
        if (distToSeg(p, a, b) <= tol) return true;
      }
      return false;
    }
    case "text": {
      const b = elBounds(el);
      return p.x >= b.x - 4 && p.x <= b.x + b.w + 4 && p.y >= b.y - 4 && p.y <= b.y + b.h + 4;
    }
  }
}

function constrainLine(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  const len = Math.hypot(dx, dy);
  return { x: a.x + Math.cos(snapped) * len, y: a.y + Math.sin(snapped) * len };
}

// ==========================================================================
// Editor de desenho EMBUTIDO (aparece no lugar da imagem, dentro do documento)
// ==========================================================================

export type DrawEditorResult =
  | { kind: "save"; pngBase64: string; json: string }
  | { kind: "cancel" }
  | { kind: "remove" };

export interface DrawEditorOptions {
  doc: DrawDoc;
  onDone: (result: DrawEditorResult) => void | Promise<void>;
}

export interface DrawEditorHandle {
  el: HTMLElement;
  focus(): void;
  dispose(): void;
}

const SWATCHES = ["#1f2937", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: "select", label: "⌖", title: "Selecionar / mover (V)" },
  { id: "pen", label: "✏", title: "Caneta — traços ficam retos, suaves ou em onda regular (P)" },
  { id: "line", label: "╱", title: "Linha reta (L)" },
  { id: "arrow", label: "↗", title: "Seta (A)" },
  { id: "rect", label: "▭", title: "Retângulo (R)" },
  { id: "ellipse", label: "◯", title: "Elipse (O)" },
  { id: "text", label: "T", title: "Caixa de texto (T) — Enter quebra linha, duplo clique edita" },
  { id: "eraser", label: "⌫", title: "Borracha (E)" },
];

function assistPref(): boolean {
  try {
    return localStorage.getItem("mdc.assist") !== "0";
  } catch {
    return true;
  }
}

export function createDrawEditor(opts: DrawEditorOptions): DrawEditorHandle {
  const panel = h("div", { class: "draw-inline", tabindex: "-1" });
  const assist = assistPref();

  panel.innerHTML = `
    <div class="dr-toolbar">
      <div class="dr-group">
        ${TOOLS.map((t) => `<button class="tbtn dr-tool" data-tool="${t.id}" title="${t.title}">${t.label}</button>`).join("")}
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        ${SWATCHES.map((c) => `<button class="swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}
        <input type="color" class="color-input" value="#1f2937" title="Cor personalizada" />
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <input type="range" class="dr-range" min="1" max="24" step="1" value="3" title="Espessura" />
        <span class="dr-w">3</span>
      </div>
      <div class="dr-group">
        <button class="tbtn dr-fill" title="Preencher formas">Preencher</button>
        <button class="tbtn dr-assist${assist ? " active" : ""}" title="Desenho assistido: alinha traços e formas automaticamente">✨ Assistido</button>
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <button class="btn icon" data-act="undo" title="Desfazer (Ctrl+Z)"><svg class="ic"><use href="#i-undo"/></svg></button>
        <button class="btn icon" data-act="redo" title="Refazer (Ctrl+Y)"><svg class="ic"><use href="#i-redo"/></svg></button>
        <button class="btn icon" data-act="dup" title="Duplicar objeto (Ctrl+D)"><svg class="ic"><use href="#i-dup"/></svg></button>
        <button class="btn icon" data-act="del" title="Apagar objeto selecionado (Del)"><svg class="ic"><use href="#i-trash"/></svg></button>
      </div>
      <span class="dr-spacer"></span>
      <div class="dr-group">
        <button class="btn icon" data-act="zoom-out" title="Diminuir zoom (Ctrl + roda do mouse)">−</button>
        <button class="tbtn wide dr-zoom" data-act="zoom-reset" title="Voltar ao tamanho que cabe na tela">100%</button>
        <button class="btn icon" data-act="zoom-in" title="Aumentar zoom (Ctrl + roda do mouse)">+</button>
      </div>
      <span class="dr-spacer"></span>
      <div class="dr-group">
        <label class="dr-check"><input type="checkbox" class="dr-bg" checked /> Fundo branco</label>
        <button class="tbtn wide" data-act="clear" title="Apagar tudo para começar de novo">Limpar</button>
      </div>
    </div>
    <div class="draw-canvas-wrap"><canvas class="dr-canvas" tabindex="0"></canvas></div>
    <div class="di-foot">
      <span class="muted">Assistido: endireita linhas, regulariza ondulações e liga as formas · Shift = exato</span>
      <span class="muted">Arraste para mover · <b>Alt+arrastar</b> copia · Ctrl+C/V copia e cola · setas ajustam</span>
      <span class="dr-spacer"></span>
      <button class="btn" data-act="remove" title="Remover este desenho do documento">Remover</button>
      <button class="btn" data-act="cancel">Cancelar</button>
      <button class="btn primary" data-act="done">Concluir</button>
    </div>`;

  const canvas = panel.querySelector<HTMLCanvasElement>(".dr-canvas")!;
  const wrap = panel.querySelector<HTMLElement>(".draw-canvas-wrap")!;
  const board = new Board(canvas, wrap, {
    w: opts.doc.w || 1600,
    h: opts.doc.h || 1000,
    fit: true,
    assist,
  });
  loadElements(board, opts.doc.elements ?? []);

  let busy = false;
  const finish = async (result: DrawEditorResult) => {
    if (busy) return;
    busy = true;
    panel.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = true));
    try {
      await opts.onDone(result);
      board.dispose();
    } catch (error) {
      toast("Não foi possível salvar o desenho: " + error, "err");
      panel.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = false));
    } finally {
      busy = false;
    }
  };

  // ---- ferramentas ----
  panel.querySelectorAll<HTMLElement>(".dr-tool").forEach((btn) => {
    btn.addEventListener("click", () => {
      board.setTool((btn.dataset.tool as Tool) ?? "pen");
      refresh();
    });
  });

  const colorInput = panel.querySelector<HTMLInputElement>(".color-input")!;
  const setColor = (c: string) => {
    board.setColor(c);
    colorInput.value = c;
    refresh();
  };
  panel.querySelectorAll<HTMLElement>(".swatch").forEach((sw) => sw.addEventListener("click", () => setColor(sw.dataset.color!)));
  colorInput.addEventListener("input", () => setColor(colorInput.value));

  const range = panel.querySelector<HTMLInputElement>(".dr-range")!;
  const wLabel = panel.querySelector<HTMLElement>(".dr-w")!;
  range.addEventListener("input", () => {
    board.setWidth(Number(range.value));
    wLabel.textContent = range.value;
  });

  let fillEnabled = false;
  const fillBtn = panel.querySelector<HTMLElement>(".dr-fill")!;
  fillBtn.addEventListener("click", () => {
    fillEnabled = !fillEnabled;
    board.setFillEnabled(fillEnabled);
    fillBtn.classList.toggle("active", fillEnabled);
  });

  const assistBtn = panel.querySelector<HTMLElement>(".dr-assist")!;
  assistBtn.addEventListener("click", () => {
    board.setAssist(!board.assist);
    assistBtn.classList.toggle("active", board.assist);
    try {
      localStorage.setItem("mdc.assist", board.assist ? "1" : "0");
    } catch {
      /* ignora */
    }
  });

  panel.querySelector<HTMLInputElement>(".dr-bg")!.addEventListener("change", (e) => {
    board.setWhiteBg((e.target as HTMLInputElement).checked);
  });

  const act = (name: string, fn: () => void) => {
    panel.querySelectorAll<HTMLElement>(`[data-act="${name}"]`).forEach((b) =>
      b.addEventListener("click", () => {
        fn();
        refresh();
      })
    );
  };
  act("undo", () => board.undo());
  act("redo", () => board.redo());
  act("dup", () => board.duplicateSelected());
  act("del", () => board.deleteSelected());
  act("clear", () => board.clearAll());

  // ---- zoom (ajuste fino) ----
  const zoomLabel = panel.querySelector<HTMLElement>('[data-act="zoom-reset"]')!;
  const updateZoom = () => {
    zoomLabel.textContent = `${Math.round(board.getZoom() * 100)}%`;
  };
  act("zoom-in", () => {
    board.setZoom(board.getZoom() + 0.25);
    updateZoom();
  });
  act("zoom-out", () => {
    board.setZoom(board.getZoom() - 0.25);
    updateZoom();
  });
  act("zoom-reset", () => {
    board.setZoom(1);
    updateZoom();
  });
  updateZoom();
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      board.setZoom(board.getZoom() + (e.deltaY < 0 ? 0.25 : -0.25));
      updateZoom();
    },
    { passive: false }
  );
  act("cancel", () => void finish({ kind: "cancel" }));
  act("remove", () => void finish({ kind: "remove" }));
  act("done", () => {
    if (board.isEmpty()) {
      toast("Faça um desenho antes de concluir.", "info");
      return;
    }
    const dataUrl = board.toPngDataUrl();
    const payload = dataUrl ? dataUrlPayload(dataUrl) : null;
    if (!payload) {
      toast("Não foi possível exportar o desenho.", "err");
      return;
    }
    void finish({ kind: "save", pngBase64: payload.b64, json: board.serialize() });
  });

  const refresh = () => {
    panel.querySelectorAll<HTMLElement>(".dr-tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === board.tool));
    panel.querySelectorAll<HTMLElement>(".swatch").forEach((b) => {
      b.classList.toggle("active", b.dataset.color?.toLowerCase() === board.color.toLowerCase());
    });
    const undoBtn = panel.querySelector<HTMLButtonElement>('[data-act="undo"]')!;
    const redoBtn = panel.querySelector<HTMLButtonElement>('[data-act="redo"]')!;
    undoBtn.disabled = !board.canUndo();
    redoBtn.disabled = !board.canRedo();
    const hasSel = board.hasSelection();
    panel.querySelector<HTMLButtonElement>('[data-act="del"]')!.disabled = !hasSel;
    panel.querySelector<HTMLButtonElement>('[data-act="dup"]')!.disabled = !hasSel;
  };
  board.onChange = refresh;

  // ---- teclado (só quando o foco está no quadro) ----
  panel.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".draw-text-input") || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) board.redo();
        else board.undo();
        refresh();
      } else if (k === "y") {
        e.preventDefault();
        board.redo();
        refresh();
      } else if (k === "d") {
        e.preventDefault();
        board.duplicateSelected();
        refresh();
      } else if (k === "c") {
        e.preventDefault();
        board.copySelected();
        refresh();
      } else if (k === "v") {
        e.preventDefault();
        board.pasteClipboard();
        refresh();
      }
      return;
    }
    if (e.key.startsWith("Arrow")) {
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      if (dx || dy) {
        e.preventDefault();
        board.nudgeSelected(dx, dy);
        refresh();
      }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      board.deleteSelected();
      refresh();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      void finish({ kind: "cancel" });
      return;
    }
    const map: Record<string, Tool> = { v: "select", p: "pen", l: "line", a: "arrow", r: "rect", o: "ellipse", t: "text", e: "eraser" };
    if (map[k]) {
      board.setTool(map[k]);
      refresh();
    }
  });

  refresh();
  return {
    el: panel,
    focus: () => canvas.focus({ preventScroll: true }),
    dispose: () => board.dispose(),
  };
}

/** Carrega os elementos salvos no quadro (usado ao reabrir um desenho). */
function loadElements(board: Board, elements: DrEl[]): void {
  for (const el of elements) {
    // valida minimamente para não quebrar com json antigo/estranho
    if (!el || typeof el !== "object" || typeof el.type !== "string") continue;
    board.addElement(structuredClone(el));
  }
}

/** Gera um PNG "vazio" (usado como placeholder ao criar um desenho novo). */
export function placeholderDataUrl(w: number, h: number): string {
  const dpr = 2;
  const c = document.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#c7ccd6";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.setLineDash([]);
  ctx.fillStyle = "#98a2b3";
  ctx.font = `600 46px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Desenhe aqui", w / 2, h / 2);
  return c.toDataURL("image/png");
}
