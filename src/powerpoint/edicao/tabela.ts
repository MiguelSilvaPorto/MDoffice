// Tabelas: criar, inserir e excluir linhas e colunas, mesclar e dividir células, estilos prontos, bordas e preenchimento.
// Funções puras sobre a `Tabela` do modelo (tamanhos em pt; as células cobertas por uma mesclagem ficam marcadas).
import type { CelulaTab, Fill, Line, Para, Tabela } from "../schema";
import { ajustarCor } from "./formato";
import { estiloNoIntervalo, paraVazio, type EstiloRun, type RunPatch } from "./texto";

/** Seleção retangular de células (inclusiva, normalizada). */
export interface SelCel {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export type ModoBorda = "todas" | "externas" | "internas" | "nenhuma" | "topo" | "base" | "esquerda" | "direita";
export type PresetTabela = "acento" | "claro" | "grade" | "escuro" | "semEstilo";

export const ROTULOS_PRESET: Record<PresetTabela, string> = {
  acento: "Cabeçalho colorido",
  claro: "Faixas claras",
  grade: "Grade simples",
  escuro: "Cabeçalho escuro",
  semEstilo: "Sem estilo",
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function normalizar(a: { r: number; c: number }, b: { r: number; c: number }): SelCel {
  return { r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) };
}

export function celulaVazia(estilo: EstiloRun, align: Para["align"] = "esquerda"): CelulaTab {
  const { text: _t, br: _b, ...e } = estilo as EstiloRun & { text?: string; br?: boolean };
  void _t;
  void _b;
  return { paras: [paraVazio({ size: estilo.size }, align)], estilo: e, anchor: "ctr", ins: [5.4, 3.6, 5.4, 3.6] };
}

/** Tabela nova com tamanho total (wPt × hPt) dividido em partes iguais. */
export function criarTabela(linhas: number, colunas: number, wPt: number, hPt: number, estilo: EstiloRun, acento: string): Tabela {
  const t: Tabela = {
    colunas: Array.from({ length: colunas }, () => wPt / colunas),
    linhas: Array.from({ length: linhas }, () => Math.max(18, hPt / linhas)),
    celulas: Array.from({ length: linhas }, () => Array.from({ length: colunas }, () => celulaVazia(estilo))),
    cabecalho: true,
    faixas: true,
  };
  return aplicarPreset(t, "acento", acento, estilo.color);
}

export function tamanhoTotal(t: Tabela): { w: number; h: number } {
  return { w: t.colunas.reduce((a, b) => a + b, 0), h: t.linhas.reduce((a, b) => a + b, 0) };
}

const dentro = (t: Tabela, r: number, c: number) => r >= 0 && r < t.linhas.length && c >= 0 && c < t.colunas.length;

/** Célula "dona" de uma posição (a que cobre a posição, se ela estiver numa mesclagem). */
export function donaDe(t: Tabela, r: number, c: number): { r: number; c: number } {
  if (!dentro(t, r, c)) return { r, c };
  if (!t.celulas[r][c].coberta) return { r, c };
  for (let rr = r; rr >= 0; rr--)
    for (let cc = c; cc >= 0; cc--) {
      const x = t.celulas[rr][cc];
      if (!x.coberta && rr + (x.rowspan ?? 1) > r && cc + (x.colspan ?? 1) > c) return { r: rr, c: cc };
    }
  return { r, c };
}

/** Aumenta a seleção até incluir inteiras as células mescladas que ela toca. */
export function expandirSelecao(t: Tabela, s: SelCel): SelCel {
  let { r0, c0, r1, c1 } = s;
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const d = donaDe(t, r, c);
        const x = t.celulas[d.r]?.[d.c];
        if (!x) continue;
        const fr = d.r + (x.rowspan ?? 1) - 1;
        const fc = d.c + (x.colspan ?? 1) - 1;
        if (d.r < r0) (r0 = d.r), (mudou = true);
        if (d.c < c0) (c0 = d.c), (mudou = true);
        if (fr > r1) (r1 = fr), (mudou = true);
        if (fc > c1) (c1 = fc), (mudou = true);
      }
  }
  return { r0, c0, r1, c1 };
}

/** Insere uma linha na posição `idx` (0 = no topo). A nova linha copia o formato da vizinha. */
export function inserirLinha(t: Tabela, idx: number, modelo?: number): Tabela {
  const n = clone(t);
  const m = Math.min(Math.max(0, modelo ?? (idx > 0 ? idx - 1 : 0)), n.linhas.length - 1);
  const nova: CelulaTab[] = n.celulas[m].map((c) => {
    const x: CelulaTab = { ...clone(c), paras: [paraVazio({ size: c.estilo?.size ?? c.paras[0]?.endSize ?? 18 }, c.paras[0]?.align ?? "esquerda")] };
    delete x.colspan;
    delete x.rowspan;
    delete x.coberta;
    return x;
  });
  n.celulas.splice(idx, 0, nova);
  n.linhas.splice(idx, 0, n.linhas[m]);
  // mesclagens verticais que atravessam a linha nova crescem
  for (let r = 0; r < idx; r++)
    for (let c = 0; c < n.colunas.length; c++) {
      const x = n.celulas[r][c];
      if (!x.coberta && (x.rowspan ?? 1) > 1 && r + (x.rowspan ?? 1) > idx) {
        x.rowspan = (x.rowspan ?? 1) + 1;
        for (let cc = c; cc < c + (x.colspan ?? 1); cc++) n.celulas[idx][cc].coberta = true;
      }
    }
  return n;
}

export function inserirColuna(t: Tabela, idx: number, modelo?: number): Tabela {
  const n = clone(t);
  const m = Math.min(Math.max(0, modelo ?? (idx > 0 ? idx - 1 : 0)), n.colunas.length - 1);
  n.colunas.splice(idx, 0, n.colunas[m]);
  n.celulas.forEach((linha, r) => {
    const c = linha[m];
    const nova: CelulaTab = { ...clone(c), paras: [paraVazio({ size: c.estilo?.size ?? c.paras[0]?.endSize ?? 18 }, c.paras[0]?.align ?? "esquerda")] };
    delete nova.colspan;
    delete nova.rowspan;
    delete nova.coberta;
    linha.splice(idx, 0, nova);
    void r;
  });
  for (let r = 0; r < n.linhas.length; r++)
    for (let c = 0; c < idx; c++) {
      const x = n.celulas[r][c];
      if (!x.coberta && (x.colspan ?? 1) > 1 && c + (x.colspan ?? 1) > idx) {
        x.colspan = (x.colspan ?? 1) + 1;
        for (let rr = r; rr < r + (x.rowspan ?? 1); rr++) n.celulas[rr][idx].coberta = true;
      }
    }
  return n;
}

export function excluirLinha(t: Tabela, r: number): Tabela {
  if (t.linhas.length <= 1) return t;
  const n = clone(t);
  // mesclagens que começam nesta linha passam para a seguinte; as que a atravessam encolhem
  for (let c = 0; c < n.colunas.length; c++) {
    const x = n.celulas[r][c];
    if (!x.coberta && (x.rowspan ?? 1) > 1) {
      const abaixo = n.celulas[r + 1][c];
      abaixo.coberta = false;
      abaixo.paras = x.paras;
      abaixo.fill = x.fill;
      abaixo.rowspan = (x.rowspan ?? 1) - 1;
      abaixo.colspan = x.colspan;
      for (let cc = c + 1; cc < c + (x.colspan ?? 1); cc++) n.celulas[r + 1][cc].coberta = true;
    } else if (x.coberta) {
      const d = donaDe(t, r, c);
      if (d.r < r) {
        const dono = n.celulas[d.r][d.c];
        if ((dono.rowspan ?? 1) > 1) dono.rowspan = (dono.rowspan ?? 1) - 1;
      }
    }
  }
  n.celulas.splice(r, 1);
  n.linhas.splice(r, 1);
  for (const linha of n.celulas) for (const c of linha) if ((c.rowspan ?? 1) <= 1) delete c.rowspan;
  return n;
}

export function excluirColuna(t: Tabela, c: number): Tabela {
  if (t.colunas.length <= 1) return t;
  const n = clone(t);
  for (let r = 0; r < n.linhas.length; r++) {
    const x = n.celulas[r][c];
    if (!x.coberta && (x.colspan ?? 1) > 1) {
      const lado = n.celulas[r][c + 1];
      lado.coberta = false;
      lado.paras = x.paras;
      lado.fill = x.fill;
      lado.colspan = (x.colspan ?? 1) - 1;
      lado.rowspan = x.rowspan;
      for (let rr = r + 1; rr < r + (x.rowspan ?? 1); rr++) n.celulas[rr][c + 1].coberta = true;
    } else if (x.coberta) {
      const d = donaDe(t, r, c);
      if (d.c < c) {
        const dono = n.celulas[d.r][d.c];
        if ((dono.colspan ?? 1) > 1) dono.colspan = (dono.colspan ?? 1) - 1;
      }
    }
  }
  n.colunas.splice(c, 1);
  for (const linha of n.celulas) {
    linha.splice(c, 1);
    for (const x of linha) if ((x.colspan ?? 1) <= 1) delete x.colspan;
  }
  return n;
}

/** Mescla as células da seleção na primeira (o texto das outras é juntado no fim). */
export function mesclar(t: Tabela, sel: SelCel): Tabela {
  const s = expandirSelecao(t, sel);
  if (s.r0 === s.r1 && s.c0 === s.c1) return t;
  const n = clone(t);
  const dono = n.celulas[s.r0][s.c0];
  const extras: Para[] = [];
  for (let r = s.r0; r <= s.r1; r++)
    for (let c = s.c0; c <= s.c1; c++) {
      if (r === s.r0 && c === s.c0) continue;
      const x = n.celulas[r][c];
      if (!x.coberta) for (const p of x.paras) if (p.runs.some((u) => u.text.trim())) extras.push(p);
      n.celulas[r][c] = { ...clone(x), coberta: true, paras: [paraVazio({ size: 18 })] };
      delete n.celulas[r][c].colspan;
      delete n.celulas[r][c].rowspan;
    }
  if (extras.length) {
    const vazio = dono.paras.length === 1 && dono.paras[0].runs.length === 0;
    dono.paras = vazio ? extras : [...dono.paras, ...extras];
  }
  dono.colspan = s.c1 - s.c0 + 1;
  dono.rowspan = s.r1 - s.r0 + 1;
  if (dono.colspan === 1) delete dono.colspan;
  if (dono.rowspan === 1) delete dono.rowspan;
  return n;
}

/** Desfaz a mesclagem da célula. */
export function dividir(t: Tabela, r: number, c: number): Tabela {
  const d = donaDe(t, r, c);
  const x = t.celulas[d.r][d.c];
  if ((x.colspan ?? 1) <= 1 && (x.rowspan ?? 1) <= 1) return t;
  const n = clone(t);
  const dono = n.celulas[d.r][d.c];
  for (let rr = d.r; rr < d.r + (x.rowspan ?? 1); rr++)
    for (let cc = d.c; cc < d.c + (x.colspan ?? 1); cc++) {
      if (rr === d.r && cc === d.c) continue;
      const y = n.celulas[rr][cc];
      delete y.coberta;
      y.fill = dono.fill ? clone(dono.fill) : undefined;
      if (!y.fill) delete y.fill;
    }
  delete dono.colspan;
  delete dono.rowspan;
  return n;
}

function cada(t: Tabela, s: SelCel, f: (c: CelulaTab, r: number, col: number) => void): Tabela {
  const n = clone(t);
  const e = expandirSelecao(t, s);
  for (let r = e.r0; r <= e.r1; r++) for (let c = e.c0; c <= e.c1; c++) f(n.celulas[r][c], r, c);
  return n;
}

export function preencherCelulas(t: Tabela, s: SelCel, fill: Fill | null): Tabela {
  return cada(t, s, (c) => {
    if (fill === null) delete c.fill;
    else c.fill = clone(fill);
  });
}

export function alinharVerticalmente(t: Tabela, s: SelCel, anchor: "t" | "ctr" | "b"): Tabela {
  return cada(t, s, (c) => {
    c.anchor = anchor;
  });
}

/** Estilo de texto (negrito, cor...) em todo o texto das células da seleção. */
export function estiloTextoCelulas(t: Tabela, s: SelCel, patch: RunPatch): Tabela {
  return cada(t, s, (c) => {
    c.paras = estiloNoIntervalo(c.paras, -1, -1, patch);
    if (c.estilo) c.estilo = { ...c.estilo, ...(patch as object) } as CelulaTab["estilo"];
  });
}

/** Define um lado de uma célula e o lado vizinho da célula ao lado (para a borda ficar igual dos dois lados). */
function setLado(t: Tabela, r: number, c: number, lado: "l" | "t" | "r" | "b", linha: Line | null): void {
  const x = t.celulas[r]?.[c];
  if (!x) return;
  x.bordas = { ...(x.bordas ?? {}), [lado]: linha ? { ...linha } : null };
  const viz = lado === "l" ? [r, c - 1, "r"] : lado === "r" ? [r, c + 1, "l"] : lado === "t" ? [r - 1, c, "b"] : [r + 1, c, "t"];
  const y = t.celulas[viz[0] as number]?.[viz[1] as number];
  if (y) y.bordas = { ...(y.bordas ?? {}), [viz[2] as "l" | "t" | "r" | "b"]: linha ? { ...linha } : null };
}

export function bordasCelulas(t: Tabela, s: SelCel, modo: ModoBorda, linha: Line): Tabela {
  const n = clone(t);
  const e = expandirSelecao(t, s);
  const L = modo === "nenhuma" ? null : linha;
  for (let r = e.r0; r <= e.r1; r++)
    for (let c = e.c0; c <= e.c1; c++) {
      const esq = c === e.c0;
      const dir = c === e.c1;
      const topo = r === e.r0;
      const base = r === e.r1;
      const lados: ("l" | "t" | "r" | "b")[] = [];
      if (modo === "todas" || modo === "nenhuma") lados.push("l", "t", "r", "b");
      if (modo === "externas") {
        if (esq) lados.push("l");
        if (dir) lados.push("r");
        if (topo) lados.push("t");
        if (base) lados.push("b");
      }
      if (modo === "internas") {
        if (!esq) lados.push("l");
        if (!dir) lados.push("r");
        if (!topo) lados.push("t");
        if (!base) lados.push("b");
      }
      if (modo === "topo" && topo) lados.push("t");
      if (modo === "base" && base) lados.push("b");
      if (modo === "esquerda" && esq) lados.push("l");
      if (modo === "direita" && dir) lados.push("r");
      for (const l of lados) setLado(n, r, c, l, L);
    }
  return n;
}

export function larguraDaColuna(t: Tabela, c: number, wPt: number): Tabela {
  const n = clone(t);
  n.colunas[c] = Math.max(8, wPt);
  return n;
}

export function alturaDaLinha(t: Tabela, r: number, hPt: number): Tabela {
  const n = clone(t);
  n.linhas[r] = Math.max(8, hPt);
  return n;
}

/** Escala as larguras e alturas para a tabela ocupar exatamente (wPt × hPt) — quando a forma é redimensionada. */
export function ajustarAoTamanho(t: Tabela, wPt: number, hPt: number): Tabela {
  const tot = tamanhoTotal(t);
  if (!tot.w || !tot.h) return t;
  const n = clone(t);
  n.colunas = n.colunas.map((c) => (c / tot.w) * wPt);
  n.linhas = n.linhas.map((l) => (l / tot.h) * hPt);
  return n;
}

const BRANCO = "FFFFFF";
const claro = (h: string) => {
  const c = h.padEnd(6, "0");
  return 0.299 * parseInt(c.slice(0, 2), 16) + 0.587 * parseInt(c.slice(2, 4), 16) + 0.114 * parseInt(c.slice(4, 6), 16) > 150;
};

/** Aplica um estilo pronto: preenchimento, bordas e negrito do cabeçalho em todas as células. */
export function aplicarPreset(t: Tabela, preset: PresetTabela, acento: string, corTexto = "1C212B"): Tabela {
  const n = clone(t);
  n.preset = preset;
  const R = n.linhas.length;
  const C = n.colunas.length;
  const fina = (cor: string, w = 0.75): Line => ({ color: cor, alpha: 1, w, dash: "solid" });
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      const x = n.celulas[r][c];
      const cab = !!n.cabecalho && r === 0;
      const faixa = !!n.faixas && !cab && (r - (n.cabecalho ? 1 : 0)) % 2 === 0;
      const col1 = !!n.primeiraColuna && c === 0 && !cab;
      delete x.fill;
      x.bordas = {};
      let textoCor = corTexto;
      let negrito = cab || col1;
      if (preset === "acento") {
        if (cab) {
          x.fill = { kind: "solid", color: acento, alpha: 1 };
          textoCor = claro(acento) ? "1C212B" : BRANCO;
        } else if (faixa) x.fill = { kind: "solid", color: ajustarCor(acento, 1.88), alpha: 1 };
        else x.fill = { kind: "solid", color: ajustarCor(acento, 1.95), alpha: 1 };
        x.bordas = { l: fina(BRANCO, 1), t: fina(BRANCO, 1), r: fina(BRANCO, 1), b: fina(BRANCO, 1) };
      } else if (preset === "claro") {
        if (cab) x.bordas = { b: fina(acento, 2) };
        if (faixa) x.fill = { kind: "solid", color: "F3F4F6", alpha: 1 };
        x.bordas = { ...x.bordas, b: x.bordas.b ?? fina("E5E7EB", 0.75) };
      } else if (preset === "grade") {
        x.bordas = { l: fina("BFBFBF"), t: fina("BFBFBF"), r: fina("BFBFBF"), b: fina("BFBFBF") };
      } else if (preset === "escuro") {
        if (cab) {
          x.fill = { kind: "solid", color: "0F2738", alpha: 1 };
          textoCor = BRANCO;
        } else if (faixa) x.fill = { kind: "solid", color: "EEF1F5", alpha: 1 };
        x.bordas = { b: fina("D1D5DB") };
      } else {
        negrito = false;
        x.bordas = {};
      }
      x.paras = estiloNoIntervalo(x.paras, -1, -1, { bold: negrito, color: textoCor });
      x.estilo = { ...(x.estilo ?? { size: 18, bold: false, italic: false, underline: false, strike: false, color: textoCor, font: "Arial" }), color: textoCor, bold: negrito };
    }
  // bordas coerentes dos dois lados de cada divisa
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      const b = n.celulas[r][c].bordas ?? {};
      if (b.r && c + 1 < C) n.celulas[r][c + 1].bordas = { ...(n.celulas[r][c + 1].bordas ?? {}), l: b.r };
      if (b.b && r + 1 < R) n.celulas[r + 1][c].bordas = { ...(n.celulas[r + 1][c].bordas ?? {}), t: b.b };
    }
  return n;
}

/** Troca os parágrafos de uma célula. */
export function comParasNaCelula(t: Tabela, r: number, c: number, paras: Para[]): Tabela {
  const n = { ...t, celulas: t.celulas.map((l, i) => (i === r ? l.map((x, j) => (j === c ? { ...x, paras } : x)) : l)) };
  return n;
}

/** Texto puro da tabela (para a IA, a busca e o resumo): uma linha por linha da tabela, células separadas por tabulação. */
export function textoDaTabela(t: Tabela): string {
  return t.celulas
    .map((linha) => linha.filter((c) => !c.coberta).map((c) => c.paras.map((p) => p.runs.map((r) => r.text).join("")).join(" ")).join("\t"))
    .join("\n");
}
