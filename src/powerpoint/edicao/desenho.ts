// Desenho à mão assistido (a opção "Draw" da galeria de Formas): reconhece um traço rabiscado
// e devolve a forma exata no lugar dele — retângulo, retângulo arredondado, elipse, triângulo,
// linha e seta. O que não for reconhecido vira um caminho livre (custGeom), que também vai
// para o .pptx. Adaptado do reconhecedor da prancheta (src/md/draw/recognize.ts), agora em pt
// e devolvendo formas do deck. Tudo puro (sem DOM), para dar para testar no Node.
import { clamp, uid } from "../../util";
import type { CustPath, Shape } from "../schema";
import type { EstiloDeck } from "./criar";
import { dePt, paraPt, type Dim, type Ret } from "./geometria";

export interface PontoTraco {
  x: number;
  y: number;
  reto?: boolean;
}

/** O pincel do modo Draw: cor, espessura e o assistente ligado/desligado. */
export interface Pincel {
  /** cor do traço (hex sem #) */
  cor: string;
  /** espessura em pt */
  w: number;
  /** true = reconhece o traço e ajusta a forma; false = mantém o rabisco */
  assistente: boolean;
  /**
   * `caneta` (padrão) = traço normal; `marca` = **marca-texto de tinta**: largo e translúcido,
   * sem reconhecimento de forma (é marcação, não desenho).
   */
  tipo?: "caneta" | "marca";
}

/** O marca-texto de tinta: quantas vezes a espessura escolhida e o quanto translúcido. */
export const MARCA_ESPESSURA = 3;
export const MARCA_ALFA = 0.4;

/** É um marca-texto de tinta? */
export const ehMarca = (p: Pincel): boolean => p.tipo === "marca";

export interface TracoReconhecido {
  geom: "rect" | "roundRect" | "ellipse" | "triangle" | "line" | "arc";
  /** caixa da forma em pt */
  box: Ret;
  /** ajustes da geometria (roundRect: raio do canto em 1/100000) */
  adj?: Record<string, number>;
  /** rotação da forma em graus (o traço desenhado torto vira forma torta de propósito) */
  rot?: number;
  /** pontas de seta (linha rabiscada com cabeça) */
  head?: boolean;
  tail?: boolean;
  flipH?: boolean;
  flipV?: boolean;
  /** rótulo do que foi reconhecido (para a dica na tela) */
  rotulo: string;
}

// ---------------------------------------------------------------------------
// primitivas (mesma família da prancheta, em pt)
// ---------------------------------------------------------------------------

export function bboxDe(pontos: PontoTraco[]): Ret {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pontos) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Simplificação Ramer–Douglas–Peucker. */
export function simplificar(pontos: PontoTraco[], eps: number): PontoTraco[] {
  if (pontos.length <= 2) return pontos.slice();
  const guardar = new Array<boolean>(pontos.length).fill(false);
  guardar[0] = true;
  guardar[pontos.length - 1] = true;
  const pilha: [number, number][] = [[0, pontos.length - 1]];
  while (pilha.length) {
    const [i0, i1] = pilha.pop()!;
    let maior = -1;
    let idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = distanciaAoSegmento(pontos[i], pontos[i0], pontos[i1]);
      if (d > maior) {
        maior = d;
        idx = i;
      }
    }
    if (maior > eps && idx > 0) {
      guardar[idx] = true;
      pilha.push([i0, idx], [idx, i1]);
    }
  }
  return pontos.filter((_, i) => guardar[i]);
}

function distanciaAoSegmento(p: PontoTraco, a: PontoTraco, b: PontoTraco): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanciaAoRetangulo(p: PontoTraco, b: Ret): number {
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const dx = Math.max(b.x - p.x, 0, p.x - x1);
  const dy = Math.max(b.y - p.y, 0, p.y - y1);
  const fora = Math.hypot(dx, dy);
  if (fora > 0) return fora;
  return Math.min(p.x - b.x, x1 - p.x, p.y - b.y, y1 - p.y);
}

function cobreQuatroLados(pontos: PontoTraco[], b: Ret, tol: number): number {
  const lados = { cima: false, baixo: false, esq: false, dir: false };
  for (const p of pontos) {
    if (Math.abs(p.y - b.y) <= tol) lados.cima = true;
    if (Math.abs(p.y - (b.y + b.h)) <= tol) lados.baixo = true;
    if (Math.abs(p.x - b.x) <= tol) lados.esq = true;
    if (Math.abs(p.x - (b.x + b.w)) <= tol) lados.dir = true;
  }
  return (lados.cima ? 1 : 0) + (lados.baixo ? 1 : 0) + (lados.esq ? 1 : 0) + (lados.dir ? 1 : 0);
}

/** Quantos lados têm um trecho RETO de verdade junto da borda (retângulo tem 4; elipse, quase nenhum). */
function ladosRetos(pontos: PontoTraco[], b: Ret, tol: number): number {
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const xsCima: number[] = [];
  const xsBaixo: number[] = [];
  const ysEsq: number[] = [];
  const ysDir: number[] = [];
  for (const p of pontos) {
    if (Math.abs(p.y - b.y) <= tol) xsCima.push(p.x);
    if (Math.abs(p.y - y1) <= tol) xsBaixo.push(p.x);
    if (Math.abs(p.x - b.x) <= tol) ysEsq.push(p.y);
    if (Math.abs(p.x - x1) <= tol) ysDir.push(p.y);
  }
  const cobre = (v: number[], de: number, ate: number) => (v.length < 2 || ate - de <= 0 ? 0 : (Math.max(...v) - Math.min(...v)) / (ate - de));
  let n = 0;
  if (cobre(xsCima, b.x, x1) >= 0.6) n++;
  if (cobre(xsBaixo, b.x, x1) >= 0.6) n++;
  if (cobre(ysEsq, b.y, y1) >= 0.6) n++;
  if (cobre(ysDir, b.y, y1) >= 0.6) n++;
  return n;
}

interface Reta {
  a: PontoTraco;
  b: PontoTraco;
  origin: PontoTraco;
  dir: PontoTraco;
  maxDev: number;
}

/** Ajusta a reta ideal (mínimos quadrados) ao conjunto de pontos. */
export function ajustarReta(pontos: PontoTraco[]): Reta | null {
  const n = pontos.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (const p of pontos) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pontos) {
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
  for (const p of pontos) {
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

/** Para um canto arredondado de raio r, o ponto do traço mais próximo do canto fica a ~0,41r dele. */
function raioDosCantos(pontos: PontoTraco[], bb: Ret): number {
  const cantos: PontoTraco[] = [
    { x: bb.x, y: bb.y },
    { x: bb.x + bb.w, y: bb.y },
    { x: bb.x, y: bb.y + bb.h },
    { x: bb.x + bb.w, y: bb.y + bb.h },
  ];
  const ds: number[] = [];
  for (const c of cantos) {
    let d = Infinity;
    for (const p of pontos) d = Math.min(d, Math.hypot(p.x - c.x, p.y - c.y));
    ds.push(d);
  }
  ds.sort((a, b) => a - b);
  const mediana = (ds[1] + ds[2]) / 2;
  // 2,5 pt de folga: ninguém acerta o canto exato com a mão
  return Math.max(0, (mediana - 2.5) / 0.414);
}

/** A ponta (início/fim) tem uma seta? As "asas" aparecem nos dois lados da reta ajustada. */
function temSeta(pontos: PontoTraco[], reta: Reta, lado: "inicio" | "fim"): boolean {
  const tDe = (p: PontoTraco) => (p.x - reta.origin.x) * reta.dir.x + (p.y - reta.origin.y) * reta.dir.y;
  const sDe = (p: PontoTraco) => (p.x - reta.origin.x) * reta.dir.y - (p.y - reta.origin.y) * reta.dir.x;
  const ts = pontos.map(tDe);
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const janela = Math.max(14, (tMax - tMin) * 0.2);
  const tol = Math.max(6, (tMax - tMin) * 0.06);
  let acima = false;
  let abaixo = false;
  for (const p of pontos) {
    const t = tDe(p);
    if (lado === "inicio" ? t > tMin + janela : t < tMax - janela) continue;
    const s = sDe(p);
    if (s > tol) acima = true;
    if (s < -tol) abaixo = true;
  }
  return acima && abaixo;
}

/** Junta cantos muito próximos (traço tremido gera "quinas" repetidas). */
function cantosLimpos(cantos: PontoTraco[], diag: number): PontoTraco[] {
  const out: PontoTraco[] = [];
  for (const p of cantos) {
    const ult = out[out.length - 1];
    if (ult && Math.hypot(p.x - ult.x, p.y - ult.y) < diag * 0.08) continue;
    out.push(p);
  }
  return out;
}

/** Direção da aresta mais longa de um polígono — a inclinação com que o desenho saiu. */
function anguloDaArestaMaisLonga(pts: PontoTraco[]): number {
  let melhor = -1;
  let ang = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > melhor) {
      melhor = d;
      ang = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  return ang;
}

/** Gira os pontos em volta de um centro (mesmo sentido do `rotate` do CSS: y para baixo). */
function girarPontos(pontos: PontoTraco[], cx: number, cy: number, graus: number): PontoTraco[] {
  const g = (graus * Math.PI) / 180;
  const cos = Math.cos(g);
  const sin = Math.sin(g);
  return pontos.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

/** Resolve um sistema linear (Gauss–Jordan com pivô parcial); `null` se for degenerado. */
function resolverSistema(M: number[][], b: number[]): number[] | null {
  const n = b.length;
  const a = M.map((linha, i) => [...linha, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-9) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = a[r][col] / a[col][col];
      for (let c = col; c <= n; c++) a[r][c] -= k * a[col][c];
    }
  }
  return a.map((linha, i) => linha[n] / linha[i]);
}

/**
 * Ajuste de elipse alinhada aos eixos (uma passada linear sobre a cônica
 * A·x² + C·y² + D·x + E·y + F = 0, com A + C = 1): é o que faz o arco seguir uma curva
 * LARGA de verdade — com o círculo, o topo de uma caixa virava "meio círculo".
 */
export function ajustarElipse(pontos: PontoTraco[]): { cx: number; cy: number; rx: number; ry: number; desvio: number; desvioMax: number } | null {
  const n = pontos.length;
  if (n < 8) return null;
  // A·(x² - y²) + D·x + E·y + F = -y²  (mínimos quadrados, 4 incógnitas)
  let s11 = 0;
  let s12 = 0;
  let s13 = 0;
  let s14 = 0;
  let s22 = 0;
  let s23 = 0;
  let s24 = 0;
  let s33 = 0;
  let s34 = 0;
  let s44 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  for (const p of pontos) {
    const u = p.x * p.x - p.y * p.y;
    const v = p.x;
    const w = p.y;
    const z = -p.y * p.y;
    s11 += u * u;
    s12 += u * v;
    s13 += u * w;
    s14 += u;
    s22 += v * v;
    s23 += v * w;
    s24 += v;
    s33 += w * w;
    s34 += w;
    s44 += 1;
    b1 += u * z;
    b2 += v * z;
    b3 += w * z;
    b4 += z;
  }
  const sol = resolverSistema(
    [
      [s11, s12, s13, s14],
      [s12, s22, s23, s24],
      [s13, s23, s33, s34],
      [s14, s24, s34, s44],
    ],
    [b1, b2, b3, b4]
  );
  if (!sol) return null;
  const [A, D, E, F] = sol;
  const C = 1 - A;
  if (!(A > 1e-6) || !(C > 1e-6)) return null;
  const cx = -D / (2 * A);
  const cy = -E / (2 * C);
  const rx2 = cx * cx + (C / A) * cy * cy - F / A;
  const ry2 = rx2 * (A / C);
  if (!(rx2 > 0) || !(ry2 > 0) || !isFinite(rx2) || !isFinite(ry2)) return null;
  const rx = Math.sqrt(rx2);
  const ry = Math.sqrt(ry2);
  let dev = 0;
  let devMax = 0;
  for (const p of pontos) {
    const d = Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
    dev += d;
    devMax = Math.max(devMax, d);
  }
  return { cx, cy, rx, ry, desvio: dev / n, desvioMax: devMax };
}

/**
 * Ajuste de elipse com ORIENTAÇÃO: uma "quarta de círculo" desenhada torta não cabe numa
 * elipse alinhada aos eixos — o ajuste sai grande e a curva não passa pelo traço (o quadro
 * fica sobrando). A varredura endireita os pontos, ajusta a elipse alinhada e mede o desvio
 * ABSOLUTO (em pt); o melhor ângulo vira a rotação da forma — o preset desenha os ângulos no
 * quadro dele, que depois o CSS gira de volta.
 */
export function ajustarElipseOrientada(
  pontos: PontoTraco[]
): { cx: number; cy: number; rx: number; ry: number; rot: number; absoluto: number; absolutoMax: number } | null {
  if (pontos.length < 8) return null;
  let cx = 0;
  let cy = 0;
  for (const p of pontos) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pontos.length;
  cy /= pontos.length;
  const candidato = (rot: number) => {
    // endireita com −rot: a forma precisa girar de +rot para voltar ao lugar
    const girados = girarPontos(pontos, cx, cy, -rot);
    const e = ajustarElipse(girados);
    if (!e) return null;
    // o centro volta para o lugar ABSOLUTO: o quadro da forma gira em volta do próprio centro,
    // então ele tem que ficar onde a elipse está de verdade (sem isso, a forma saía deslocada
    // da rotação em diante — a curva não passava pelo traço)
    const g2 = (rot * Math.PI) / 180;
    const cos2 = Math.cos(g2);
    const sin2 = Math.sin(g2);
    const dx = e.cx - cx;
    const dy = e.cy - cy;
    return {
      cx: cx + dx * cos2 - dy * sin2,
      cy: cy + dx * sin2 + dy * cos2,
      rx: e.rx,
      ry: e.ry,
      rot,
      absoluto: e.desvio * Math.min(e.rx, e.ry),
      absolutoMax: e.desvioMax * Math.min(e.rx, e.ry),
    };
  };
  // o ajuste alinhado aos eixos é o "de sempre": só troca por um girado quando ele é
  // CLARAMENTE melhor (um arco pequeno cabe em muitas elipses — sem essa preferência, um
  // arco quase circular ganhava uma elipse girada com desvio só um pouco menor)
  const base = candidato(0);
  let melhor: ReturnType<typeof candidato> = base;
  for (let rot = -45; rot <= 45.001; rot += 3) {
    const c = candidato(rot);
    if (c && melhor !== null && c.absoluto < melhor.absoluto) melhor = c;
  }
  if (melhor === null) return null;
  const centro = melhor.rot;
  for (let rot = centro - 2.5; rot <= centro + 2.501; rot += 0.5) {
    const c = candidato(rot);
    if (c && c.absoluto < melhor.absoluto) melhor = c;
  }
  if (base && melhor.rot !== 0 && melhor.absoluto > base.absoluto * 0.75) melhor = base;
  return melhor;
}

/** Triângulo com o ápice para baixo (o preset padrão aponta para cima → precisa de flipV). */
function apexEmBaixo(tres: PontoTraco[]): boolean {
  let iA = 0;
  let maior = -1;
  for (let i = 0; i < 3; i++) {
    const outros = tres.filter((_, k) => k !== i);
    const d = Math.abs(tres[i].y - (outros[0].y + outros[1].y) / 2);
    if (d > maior) {
      maior = d;
      iA = i;
    }
  }
  const outros = tres.filter((_, k) => k !== iA);
  return tres[iA].y > (outros[0].y + outros[1].y) / 2;
}

// ---------------------------------------------------------------------------
// o reconhecimento
// ---------------------------------------------------------------------------

/**
 * Assistente do Draw: tenta transformar um traço à mão livre numa forma limpa.
 * Devolve `null` quando é melhor manter o traço como está (desenho livre).
 */
export function reconhecerTraco(pontos: PontoTraco[]): TracoReconhecido | null {
  if (pontos.length < 8) return null;
  const bb = bboxDe(pontos);
  const diag = Math.hypot(bb.w, bb.h);
  if (diag < 30) return null;

  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const gap = Math.hypot(primeiro.x - ultimo.x, primeiro.y - ultimo.y);
  const fechado = gap <= Math.max(22, diag * 0.22);
  const eps = Math.max(3, diag * 0.045);
  const simplificado = simplificar(pontos, eps);
  const cantos = fechado && simplificado.length > 2 ? simplificado.slice(0, -1) : simplificado;

  if (fechado) {
    // --- retângulo (ou arredondado)? (4–8 cantos, lados retos e tudo junto da borda) ---
    const limpos = cantosLimpos(cantos, diag);
    if (limpos.length >= 4 && limpos.length <= 8) {
      // a mão nunca acerta o ângulo: a inclinação sai da aresta mais longa e o traço é
      // ENDIREITADO antes de medir — sem isso, um retângulo alguns graus torto vira
      // "arredondado" (os cantos da caixa alinhada ficam longe do traço)
      const ang = anguloDaArestaMaisLonga(limpos);
      const quarto = Math.PI / 2;
      const off = Math.abs(((ang % quarto) + quarto) % quarto);
      const inclinacao = Math.min(off, quarto - off);
      if (inclinacao < (24 * Math.PI) / 180) {
        const torto = inclinacao >= (2 * Math.PI) / 180;
        const cxb = bb.x + bb.w / 2;
        const cyb = bb.y + bb.h / 2;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const retos = torto
          ? pontos.map((p) => {
              const dx = p.x - cxb;
              const dy = p.y - cyb;
              return { x: cxb + dx * cos + dy * sin, y: cyb - dx * sin + dy * cos };
            })
          : pontos;
        const bbReto = torto ? bboxDe(retos) : bb;
        const diagReto = Math.hypot(bbReto.w, bbReto.h);
        const tolJunto = Math.max(5, diagReto * 0.09);
        let junto = true;
        for (const p of retos) {
          if (distanciaAoRetangulo(p, bbReto) > tolJunto) {
            junto = false;
            break;
          }
        }
        // o desenho tem que ter LADOS RETOS (uma elipse não tem): é o que separa
        // "retângulo arredondado" de "elipse" com o mesmo desvio no canto
        if (junto && ladosRetos(retos, bbReto, Math.max(4, diagReto * 0.04)) >= 3) {
          const raio = raioDosCantos(retos, bbReto);
          if (raio >= Math.max(6, Math.min(bbReto.w, bbReto.h) * 0.08)) {
            const adj = Math.round(clamp((100000 * raio) / Math.min(bbReto.w, bbReto.h), 4000, 50000));
            return { geom: "roundRect", box: bbReto, adj: { adj }, rotulo: "Retângulo arredondado" };
          }
          return { geom: "rect", box: bbReto, rotulo: "Retângulo" };
        }
      }
    }

    // --- elipse / círculo? (desvio médio em relação à elipse da caixa) ---
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;
    const rx = Math.max(bb.w / 2, 1);
    const ry = Math.max(bb.h / 2, 1);
    let desvio = 0;
    for (const p of pontos) desvio += Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
    if (desvio / pontos.length < 0.12) return { geom: "ellipse", box: bb, rotulo: "Elipse" };

    // --- triângulo? ---
    const tres = cantosLimpos(cantos, diag);
    if (tres.length === 3) {
      return { geom: "triangle", box: bb, flipV: apexEmBaixo(tres) || undefined, rotulo: "Triângulo" };
    }
    return null;
  }

  const n = pontos.length;

  // --- arco? (um traço curvo que segue uma elipse — o "canto arredondado" ou uma curva larga) ---
  // A elipse é procurada COM orientação: o traço desenhado torto (a mão nunca sai reta) não
  // cabe numa elipse alinhada aos eixos — o ajuste saía grande e a curva não passava pelo
  // traço. O ajuste roda no traço CRU (suavizar antes "achata" arcos pequenos e uma elipse
  // girada passaria por cima) e só vale quando: a elipse não é uma "faca" (uma linha reta
  // vira elipse esticada e passaria), o desvio absoluto é pequeno e a elipse não é
  // absurdamente maior que o desenho.
  const ajuste = ajustarElipseOrientada(pontos);
  if (
    ajuste &&
    Math.min(ajuste.rx, ajuste.ry) > 14 &&
    Math.min(ajuste.rx, ajuste.ry) >= 0.22 * Math.max(ajuste.rx, ajuste.ry) &&
    ajuste.absoluto <= Math.max(2.5, diag * 0.018) &&
    // a curva tem que PASSAR pelo traço: a média sozinha aceitava o topo de um cartão (retas com
    // cantos) como arco largo, e o arco saía bojando por baixo do desenho — o desvio MÁXIMO pega
    ajuste.absolutoMax <= Math.max(3.5, diag * 0.006) &&
    Math.max(ajuste.rx, ajuste.ry) <= diag * 4
  ) {
    const { cx, cy, rx, ry, rot } = ajuste;
    // os ângulos são medidos no QUADRO da forma (elipse alinhada aos eixos): desfaz a rotação
    const noQuadro = girarPontos(pontos, cx, cy, -rot);
    const nq = noQuadro.length;
    // ângulo PARAMÉTRICO da elipse (é o que o preset `arc` do OOXML usa)
    const ang = (p: PontoTraco) => Math.atan2((p.y - cy) / ry, (p.x - cx) / rx);
    const quadro0 = noQuadro[0];
    const quadroN = noQuadro[nq - 1];
    const ang0 = ang(quadro0);
    const angN = ang(quadroN);
    // sentido em que o traço foi desenhado (a soma das viradas de ângulo)
    let volta = 0;
    for (let i = 1; i < nq; i++) {
      let d = ang(noQuadro[i]) - ang(noQuadro[i - 1]);
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      volta += d;
    }
    const a1 = volta < 0 ? angN : ang0;
    const a2 = volta < 0 ? ang0 : angN;
    let varredura = ((a2 - a1) * 180) / Math.PI;
    while (varredura <= 0) varredura += 360;
    if (varredura >= 35 && varredura <= 330) {
      const emAdj = (a: number) => {
        let g = (a * 180) / Math.PI;
        while (g < 0) g += 360;
        while (g >= 360) g -= 360;
        return Math.round(g * 60000);
      };
      return {
        geom: "arc",
        box: { x: cx - rx, y: cy - ry, w: 2 * rx, h: 2 * ry },
        adj: { adj1: emAdj(a1), adj2: emAdj(a2) },
        rot: Math.abs(rot) >= 1 ? Math.round(rot * 10) / 10 : undefined,
        rotulo: "Arco",
      };
    }
  }

  // --- linha reta? (corta os "ganchos" que a mão faz nas pontas) ---
  const trim = Math.max(3, Math.floor(n * 0.18));
  const interno = n > trim * 2 + 4 ? pontos.slice(trim, n - trim) : pontos;
  const reta = ajustarReta(interno);
  if (reta) {
    const len = Math.hypot(reta.b.x - reta.a.x, reta.b.y - reta.a.y);
    // 2,5% do comprimento (era 5%): com a tolerância larga, o TOPO DE UM CARTÃO (retas com
    // cantos) passava por "linha" e o desenho perdia os cantos
    const tol = Math.max(5, len * 0.025);
    if (len > 36 && reta.maxDev <= tol) {
      // miolo reto: projeta as pontas na reta ideal e limita a extensão
      const tDe = (p: PontoTraco) => (p.x - reta.origin.x) * reta.dir.x + (p.y - reta.origin.y) * reta.dir.y;
      const t0 = tDe(reta.a);
      const t1 = tDe(reta.b);
      const pad = Math.max(30, len * 0.25);
      // as pontas são os extremos do traço (numa seta as "asas" vêm antes da ponta);
      // o sentido do desenho decide qual extremo é o início (o marcador segue o traço)
      const ts = pontos.map(tDe);
      const vai = tDe(pontos[0]) <= tDe(pontos[n - 1]);
      const tA = clamp(vai ? Math.min(...ts) : Math.max(...ts), t0 - pad, t1 + pad);
      const tB = clamp(vai ? Math.max(...ts) : Math.min(...ts), t0 - pad, t1 + pad);
      if (Math.abs(tB - tA) > 36) {
        const a = { x: reta.origin.x + reta.dir.x * tA, y: reta.origin.y + reta.dir.y * tA };
        const b = { x: reta.origin.x + reta.dir.x * tB, y: reta.origin.y + reta.dir.y * tB };
        // o marcador segue o SENTIDO do desenho: "head" na ponta inicial, "tail" na final
        const setaBaixa = temSeta(pontos, reta, "inicio");
        const setaAlta = temSeta(pontos, reta, "fim");
        const head = vai ? setaBaixa : setaAlta;
        const tail = vai ? setaAlta : setaBaixa;
        return {
          geom: "line",
          box: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) },
          head: head || undefined,
          tail: tail || undefined,
          flipH: a.x > b.x || undefined,
          flipV: a.y > b.y || undefined,
          rotulo: head || tail ? "Seta" : "Linha",
        };
      }
    }
  }
  return null;
}

/** Dica para mostrar na tela enquanto o traço está sendo desenhado. */
export function dicaDoTraco(pontos: PontoTraco[], assistente: boolean): string {
  if (!assistente) return "Desenho livre";
  return reconhecerTraco(pontos)?.rotulo ?? "Desenho livre";
}

// ---------------------------------------------------------------------------
// a forma
// ---------------------------------------------------------------------------

/** Média móvel leve: tira o tremor da mão sem perder as pontas do traço. */
function suavizarPontos(pontos: PontoTraco[]): PontoTraco[] {
  const n = pontos.length;
  if (n < 5) return pontos.slice();
  const out: PontoTraco[] = [];
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) {
      sx += pontos[k].x;
      sy += pontos[k].y;
      c++;
    }
    out.push({ x: sx / c, y: sy / c });
  }
  out[0] = { ...pontos[0] };
  out[n - 1] = { ...pontos[n - 1] };
  return out;
}

/** Pontos do desenho livre já suavizados e simplificados (é o que o caminho usa). */
function pontosDoLivre(pontos: PontoTraco[], bb: Ret): PontoTraco[] {
  // duas passadas: o tremor da mão sai de verdade (uma passada deixava o "serrilhado")
  const suave = suavizarPontos(suavizarPontos(pontos));
  // passo de simplificação mais fino: a curva acompanha o traço em vez de cortar os cantos
  let eps = Math.max(0.8, Math.hypot(bb.w, bb.h) * 0.005);
  let pts = simplificar(suave, eps);
  while (pts.length > 120 && eps < 40) {
    eps *= 1.6;
    pts = simplificar(suave, eps);
  }
  return pts;
}

/**
 * Núcleo do encaixe: os pontos JÁ suavizados/simplificados. A direção de cada trecho sai de uma
 * JANELA de pontos (±2): no passo fino do caminho o tremor que sobra faria um segmento curto
 * parecer diagonal e o encaixe não pegaria nada.
 */
function alinharPontos(pontos: PontoTraco[], tolGraus = 9): PontoTraco[] {
  const pts = pontos.map((p) => ({ ...p }));
  const n = pts.length;
  if (n < 4) return pts;
  const tol = Math.sin((tolGraus * Math.PI) / 180);
  const tipo: ("h" | "v" | null)[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[Math.max(0, i - 2)];
    const b = pts[Math.min(n - 1, i + 2)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) tipo.push(null);
    else tipo.push(Math.abs(dy) / len <= tol ? "h" : Math.abs(dx) / len <= tol ? "v" : null);
  }
  // corridas de trechos no mesmo eixo (com um mínimo de 3 trechos: reta de verdade, não um
  // trecho curto que o tremor disfarçou): todos os pontos da corrida ganham a mesma coordenada
  // (a média — o traço fica no lugar onde a mão passou, sem "puxar" para um lado)
  let i = 0;
  while (i < tipo.length) {
    const t = tipo[i];
    if (!t) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < tipo.length && tipo[j + 1] === t) j++;
    if (j - i + 1 >= 3) {
      let soma = 0;
      for (let k = i; k <= j + 1; k++) soma += t === "h" ? pts[k].y : pts[k].x;
      const media = soma / (j - i + 2);
      for (let k = i; k <= j + 1; k++) {
        if (t === "h") pts[k].y = media;
        else pts[k].x = media;
      }
    }
    i = j + 1;
  }
  return pts;
}

/**
 * Encaixe nos eixos do desenho livre (modo assistente): os trechos quase horizontais/verticais
 * viram retas de verdade — o "L" desenhado alguns graus torto sai reto, com o canto em 90°.
 * O que é diagonal de propósito (fora da tolerância) fica como o traço desenhou.
 */
export function alinharNosEixos(pontos: PontoTraco[], tolGraus = 9): PontoTraco[] {
  return alinharPontos(pontosDoLivre(pontos, bboxDe(pontos)), tolGraus);
}

/** Pontos finais do desenho livre: suavizados, simplificados e — no assistente — encaixados nos eixos. */
export function pontosDoDesenhoLivre(pontos: PontoTraco[], encaixar: boolean): PontoTraco[] {
  const pts = pontosDoLivre(pontos, bboxDe(pontos));
  return encaixar ? alinharPontos(pts) : pts;
}

/**
 * Caminho do custGeom (M + retas + cúbicas + Z, em pt, relativos à caixa).
 * Os trechos EXATAMENTE no eixo (os que o encaixe do assistente alinhou) saem como RETA: a
 * cúbica do Catmull-Rom boja entre os pontos quando os vizinhos são os cantos — era a "barriga"
 * que ficava no topo do cartão mesmo com os pontos já alinhados.
 */
export function caminhoDePontos(pts: PontoTraco[], bb: Ret = bboxDe(pts), fechado = false): CustPath {
  const n10 = (v: number) => Math.round(v * 10) / 10;
  const n = pts.length;
  if (n < 2) return { w: Math.max(1, n10(bb.w)), h: Math.max(1, n10(bb.h)), cmds: [], fill: "none", stroke: true };

  const get = (i: number) => {
    if (fechado) return pts[((i % n) + n) % n];
    return pts[Math.min(n - 1, Math.max(0, i))];
  };

  const cmds: (string | number)[] = ["M", n10(pts[0].x - bb.x), n10(pts[0].y - bb.y)];

  const count = fechado ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p1 = get(i);
    const p2 = get(i + 1);
    if (p1.reto || p2.reto || Math.abs(p2.y - p1.y) < 0.05 || Math.abs(p2.x - p1.x) < 0.05) {
      cmds.push("L", n10(p2.x - bb.x), n10(p2.y - bb.y));
      continue;
    }
    const p0 = get(i - 1);
    const p3 = get(i + 2);
    cmds.push(
      "C",
      n10(p1.x + (p2.x - p0.x) / 6 - bb.x),
      n10(p1.y + (p2.y - p0.y) / 6 - bb.y),
      n10(p2.x - (p3.x - p1.x) / 6 - bb.x),
      n10(p2.y - (p3.y - p1.y) / 6 - bb.y),
      n10(p2.x - bb.x),
      n10(p2.y - bb.y)
    );
  }
  const primeiro = pts[0];
  const ultimo = pts[pts.length - 1];
  const gap = Math.hypot(primeiro.x - ultimo.x, primeiro.y - ultimo.y);
  if (fechado || gap <= Math.max(10, Math.hypot(bb.w, bb.h) * 0.1)) cmds.push("Z");
  return { w: Math.max(1, n10(bb.w)), h: Math.max(1, n10(bb.h)), cmds, fill: fechado ? "norm" : "none", stroke: true };
}

/** Traço livre -> caminho do custGeom, já suave. */
export function caminhoLivre(pontos: PontoTraco[], bb: Ret = bboxDe(pontos)): CustPath {
  return caminhoDePontos(pontosDoLivre(pontos, bb), bb);
}

/**
 * Encaixa a caixa nas bordas e nos centros das formas de baixo quando está perto — é o
 * "enxergar a imagem de fundo": desenhar por cima de uma forma (mesmo apagada) sai alinhado a ela.
 */
export function encaixarNoPalco(box: Ret, formas: Shape[], d: Dim, limiar: number): Ret {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const f of formas) {
    if (f.rot && Math.abs(f.rot % 360) > 0.5) continue;
    const b = paraPt(f.box, d);
    xs.push(b.x, b.x + b.w, b.x + b.w / 2);
    ys.push(b.y, b.y + b.h, b.y + b.h / 2);
  }
  if (!xs.length) return box;
  const perto = (v: number, alvos: number[]) => {
    let melhor = v;
    let dist = limiar;
    for (const t of alvos) {
      const dd = Math.abs(t - v);
      if (dd < dist) {
        dist = dd;
        melhor = t;
      }
    }
    return melhor;
  };
  let x = perto(box.x, xs);
  let x2 = perto(box.x + box.w, xs);
  let y = perto(box.y, ys);
  let y2 = perto(box.y + box.h, ys);
  // nenhuma borda encostou? tenta o centro (desloca a caixa inteira)
  if (x === box.x && x2 === box.x + box.w) {
    const dx = perto(box.x + box.w / 2, xs) - (box.x + box.w / 2);
    x += dx;
    x2 += dx;
  }
  if (y === box.y && y2 === box.y + box.h) {
    const dy = perto(box.y + box.h / 2, ys) - (box.y + box.h / 2);
    y += dy;
    y2 += dy;
  }
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) };
}

function baseDaForma(est: EstiloDeck, d: Dim, boxPt: Ret): Shape {
  const b = dePt(boxPt, d);
  return {
    id: uid(),
    kind: "forma",
    box: { x: clamp(b.x, 0, 100), y: clamp(b.y, 0, 100), w: clamp(b.w, 0, 100), h: clamp(b.h, 0, 100) },
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
  };
}

function comPincel(s: Shape, pincel: Pincel, setas?: { head?: boolean; tail?: boolean }): Shape {
  s.fillX = { kind: "none" };
  if (ehMarca(pincel)) {
    // marca-texto: largo, translúcido e sem ponta de seta — é marcação, não desenho
    s.ln = { color: pincel.cor, alpha: MARCA_ALFA, w: Math.max(6, pincel.w * MARCA_ESPESSURA), dash: "solid", cap: "flat", join: "round" };
    s.name = "Marca-texto";
    return s;
  }
  s.ln = { color: pincel.cor, alpha: 1, w: pincel.w, dash: "solid", cap: "round", join: "round" };
  if (setas?.head) s.ln.head = "triangle";
  if (setas?.tail) s.ln.tail = "triangle";
  return s;
}

/**
 * O traço vira forma: reconhecido pelo assistente (ou desenho livre quando o assistente
 * está desligado ou quando o traço não bate com nenhuma forma). O marca-texto nunca é
 * reconhecido nem encaixado: sai como desenho livre, fiel à mão.
 */
export function formaDoTraco(pontos: PontoTraco[], pincel: Pincel, est: EstiloDeck, d: Dim, formas: Shape[] = []): Shape | null {
  if (pontos.length < 2) return null;
  const marca = ehMarca(pincel);
  const rec = pincel.assistente && !marca ? reconhecerTraco(pontos) : null;
  if (rec) {
    // encaixa nas formas de baixo (bordas e centros) antes de montar: desenhar por cima de uma
    // forma existente sai alinhado a ela
    const box = encaixarNoPalco(rec.box, formas, d, Math.max(6, d.w * 0.01));
    const s = baseDaForma(est, d, box);
    s.geom = rec.geom;
    s.name = rec.rotulo;
    if (rec.adj) s.adj = { ...rec.adj };
    if (rec.rot) s.rot = rec.rot;
    if (rec.flipH) s.flipH = true;
    if (rec.flipV) s.flipV = true;
    return comPincel(s, pincel, { head: rec.head, tail: rec.tail });
  }
  // modo assistente: o desenho livre encaixa nos eixos (as retas quase retas ficam retas e o
  // canto em 90°) — e os trechos encaixados saem como RETA no caminho (a cúbica fazia barriga)
  const pontosLivre = pontosDoDesenhoLivre(pontos, pincel.assistente && !marca);
  const s = baseDaForma(est, d, encaixarNoPalco(bboxDe(pontosLivre), formas, d, Math.max(6, d.w * 0.01)));
  s.geom = "custom";
  s.name = marca ? "Marca-texto" : "Desenho livre";
  s.paths = [caminhoDePontos(pontosLivre)];
  // guarda o traço: é o que permite apagar e converter depois (só do app)
  s.tinta = pontos.map((p) => ({ x: p.x, y: p.y, ...(p.reto ? { reto: true } : {}) }));
  return comPincel(s, pincel);
}

/** Gera a string SVG path d em % (para pré-visualização ao vivo da curva). */
export function svgPathDePontosPct(pts: PontoTraco[], fechado = false): string {
  if (pts.length < 2) return "";
  const n = pts.length;
  const f = (v: number) => v.toFixed(2);
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  if (n === 2 && !fechado) {
    return `${d}L${f(pts[1].x)} ${f(pts[1].y)}`;
  }
  const get = (i: number) => {
    if (fechado) return pts[((i % n) + n) % n];
    return pts[Math.min(n - 1, Math.max(0, i))];
  };
  const count = fechado ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p1 = get(i);
    const p2 = get(i + 1);
    if (p1.reto || p2.reto || Math.abs(p2.y - p1.y) < 0.05 || Math.abs(p2.x - p1.x) < 0.05) {
      d += `L${f(p2.x)} ${f(p2.y)}`;
      continue;
    }
    const p0 = get(i - 1);
    const p3 = get(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  if (fechado) d += "Z";
  return d;
}

/**
 * Cria uma forma vetorial (custom) a partir dos pontos fixos de parada definidos pelo usuário.
 * Pode ser uma curva aberta ou uma forma fechada (fechado = true).
 */
export function formaDeCurva(
  pontos: PontoTraco[],
  fechado: boolean,
  pincel: Pincel,
  est: EstiloDeck,
  d: Dim,
  formas: Shape[] = []
): Shape | null {
  if (pontos.length < 2) return null;
  const bb = bboxDe(pontos);
  if (bb.w < 2 && bb.h < 2) return null;
  const box = encaixarNoPalco(bb, formas, d, Math.max(6, d.w * 0.01));
  const s = baseDaForma(est, d, box);
  s.geom = "custom";
  s.name = fechado ? "Forma livre" : "Curva";
  s.paths = [caminhoDePontos(pontos, bb, fechado)];
  // guarda os pontos: a curva também pode ser apagada e convertida depois (só do app)
  s.tinta = pontos.map((p) => ({ x: p.x, y: p.y, ...(p.reto ? { reto: true } : {}) }));
  return comPincel(s, pincel);
}

/**
 * "Converter em forma": pega um traço de tinta já desenhado (a forma guarda os pontos em
 * `tinta`) e devolve a forma reconhecida pelo assistente — mantendo **onde e do tamanho que
 * o traço está agora** (os pontos são da criação; a forma pode ter sido movida/redimensionada).
 * Devolve `null` quando não há pontos ou quando o traço não bate com nenhuma forma.
 */
export function formaDaTinta(s: Shape, d: Dim): Partial<Shape> | null {
  const pontos = s.tinta;
  if (!pontos || pontos.length < 2) return null;
  const rec = reconhecerTraco(pontos);
  if (!rec) return null;
  // mapeia a caixa reconhecida (pt) para a caixa ATUAL da forma (%), esticando o que a pessoa esticou
  const origem = dePt(bboxDe(pontos), d);
  const alvo = dePt(rec.box, d);
  const sx = origem.w > 0.01 ? s.box.w / origem.w : 1;
  const sy = origem.h > 0.01 ? s.box.h / origem.h : 1;
  const box = { x: s.box.x + (alvo.x - origem.x) * sx, y: s.box.y + (alvo.y - origem.y) * sy, w: alvo.w * sx, h: alvo.h * sy };
  // a linha continua a do traço (cor, espessura, transparência); só ganha as pontas que o
  // reconhecedor viu no desenho
  const ln = s.ln ? { ...s.ln } : undefined;
  if (ln) {
    if (rec.head) ln.head = "triangle";
    if (rec.tail) ln.tail = "triangle";
  }
  return {
    box,
    geom: rec.geom,
    name: rec.rotulo,
    adj: rec.adj ? { ...rec.adj } : undefined,
    rot: rec.rot ?? s.rot,
    flipH: rec.flipH ? true : undefined,
    flipV: rec.flipV ? true : undefined,
    paths: undefined,
    tinta: undefined,
    ...(ln ? { ln } : {}),
  };
}
