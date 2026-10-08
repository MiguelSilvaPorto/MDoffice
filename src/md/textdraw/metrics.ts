// Medidas da célula da grade (largura/altura de um caractere monoespaçado).

import { MONO, CELL_FONT } from "./model";

export interface Metrics {
  cellW: number;
  cellH: number;
  fontSize: number;
  logicalW: number;
  logicalH: number;
}

export let metricsCache: Metrics | null = null;

export function metrics(cols: number, rows: number): Metrics {
  if (!metricsCache) {
    const probe = 100;
    const tmp = document.createElement("canvas").getContext("2d")!;
    tmp.font = `${probe}px ${MONO}`;
    const advance = tmp.measureText("MMMMMMMMMM").width / 10;
    const fontSize = CELL_FONT;
    const cellW = (advance * fontSize) / probe;
    const cellH = Math.round(fontSize * 1.18);
    // QUADRADINHOS: o lado vem da altura da letra (a letra fica centralizada na célula)
    const lado = Math.max(Math.round(cellW), cellH);
    metricsCache = { cellW: lado, cellH: lado, fontSize, logicalW: 0, logicalH: 0 };
  }
  const base = metricsCache!;
  return { ...base, logicalW: base.cellW * cols, logicalH: base.cellH * rows };
}
