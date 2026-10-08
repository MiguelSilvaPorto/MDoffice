// Reconhecimento de traços à mão livre: linhas, formas, ondas e ângulos (funções puras, fáceis de testar).

import { h, clamp } from "../../util";
import { type Pt, type DrEl } from "./model";
import { distToSeg } from "./geometry";

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

export function distToRectEdge(p: Pt, b: { x: number; y: number; w: number; h: number }): number {
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const dx = Math.max(b.x - p.x, 0, p.x - x1);
  const dy = Math.max(b.y - p.y, 0, p.y - y1);
  const distOutside = Math.hypot(dx, dy);
  if (distOutside > 0) return distOutside;
  // dentro: distância até a borda mais próxima
  return Math.min(p.x - b.x, x1 - p.x, p.y - b.y, y1 - p.y);
}

export function coversFourSides(points: Pt[], b: { x: number; y: number; w: number; h: number }, tol: number): number {
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

export function movingAverage(values: number[], window: number): number[] {
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
