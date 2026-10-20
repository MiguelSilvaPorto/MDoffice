// Contorno parcial das formas: quanto de cada lado (0–100%) é desenhado e de que canto
// o trecho começa. É a matemática compartilhada entre a tela (SVG) e a exportação (.pptx,
// onde cada trecho vira uma forma de linha).
//
// O contorno inteiro (100% nos quatro lados, sem inversão) continua sendo o caminho normal
// da forma — com os arcos dos cantos arredondados. Só quando algum lado é parcial é que os
// trechos retos são desenhados separadamente (os arcos dos cantos não entram nesse caso).

import type { LnLados, Shape } from "../schema";

export type LadoContorno = "t" | "r" | "b" | "l";

export interface SegmentoContorno {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const LADOS: LadoContorno[] = ["t", "r", "b", "l"];

/** O contorno é parcial? (todos os lados em 100% = contorno inteiro, mesmo com inversão) */
export function contornoParcial(s: Shape): boolean {
  const l = s.lnLados;
  if (!l) return false;
  return LADOS.some((k) => Math.max(0, Math.min(100, l[k] ?? 100)) < 100);
}

/**
 * Os trechos retos do contorno, nas MESMAS unidades de `w`/`h` (pt na tela, polegadas no
 * .pptx). Devolve `null` quando o contorno é inteiro ou a geometria não é retangular —
 * aí quem desenha é o caminho normal da forma.
 *
 * Sentido horário, começando pelo canto de cima/baixo de cada lado:
 *  - topo: esquerda → direita;
 *  - direita: cima → baixo;
 *  - baixo: direita → esquerda;
 *  - esquerda: baixo → cima.
 * `inv` de um lado desenha a mesma fração a partir do outro canto.
 */
export function segmentosDoContorno(s: Shape, w: number, h: number): SegmentoContorno[] | null {
  if (!contornoParcial(s)) return null;
  if (s.paths?.length) return null; // geometria livre: fica o contorno inteiro
  const retangular = s.kind === "imagem" || !s.geom || s.geom === "rect" || s.geom === "roundRect";
  if (!retangular || w <= 0 || h <= 0) return null;

  const ss = Math.min(w, h);
  const r = (s.cantos?.length === 4 ? s.cantos : [0, 0, 0, 0]).map(
    (v) => (Math.max(0, Math.min(50, v)) / 100) * ss
  ) as [number, number, number, number];
  const pct = (k: LadoContorno) => Math.max(0, Math.min(100, s.lnLados?.[k] ?? 100)) / 100;
  const invertido = (k: LadoContorno) => !!s.lnLados?.inv?.[k];

  const trecho = (x1: number, y1: number, x2: number, y2: number, k: LadoContorno): SegmentoContorno | null => {
    const p = pct(k);
    if (p <= 0) return null;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const comprimento = Math.hypot(dx, dy);
    if (comprimento < 0.01) return null;
    const len = comprimento * p;
    const ux = dx / comprimento;
    const uy = dy / comprimento;
    if (invertido(k)) return { x1: x2, y1: y2, x2: x2 - ux * len, y2: y2 - uy * len };
    return { x1, y1, x2: x1 + ux * len, y2: y1 + uy * len };
  };

  const lista = [
    trecho(r[0], 0, w - r[1], 0, "t"),
    trecho(w, r[1], w, h - r[2], "r"),
    trecho(w - r[2], h, r[3], h, "b"),
    trecho(0, h - r[3], 0, r[0], "l"),
  ];
  return lista.filter((x): x is SegmentoContorno => !!x);
}
