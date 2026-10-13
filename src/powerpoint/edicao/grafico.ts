// Gráficos do motor de apresentações: dados (categorias, séries, opções) e as contas puras
// (escala dos eixos, paleta, normalização). O desenho em si fica em render/grafico.ts.
// Sem DOM: dá para testar no Node.
import type { Grafico, GraficoTipo, GraficoSerie, ShapeBox } from "../schema";

/** Tipos oferecidos na fita, na ordem do menu. */
export const GRAFICO_TIPOS: { id: GraficoTipo; nome: string }[] = [
  { id: "colunas", nome: "Colunas" },
  { id: "barras", nome: "Barras" },
  { id: "linhas", nome: "Linhas" },
  { id: "area", nome: "Área" },
  { id: "pizza", nome: "Pizza" },
  { id: "rosca", nome: "Rosca" },
  { id: "dispersao", nome: "Dispersão" },
];

/** Cores padrão (a paleta do Office), usadas quando o deck não define as suas. */
export const GRAFICO_CORES = ["4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "264478", "9E480E", "636363", "997300"];

/** Limites defensivos: um gráfico legível e leve. */
export const MAX_CATEGORIAS = 24;
export const MAX_SERIES = 6;

/** Gráfico de exemplo com o formato de quem cria um novo (2 séries, 4 categorias). */
export function graficoPadrao(tipo: GraficoTipo = "colunas"): Grafico {
  return {
    tipo,
    categorias: ["Categoria 1", "Categoria 2", "Categoria 3", "Categoria 4"],
    series: [
      { nome: "Série 1", valores: [4, 6, 3, 7] },
      { nome: "Série 2", valores: [2, 5, 6, 4] },
    ],
    titulo: "Título do gráfico",
    legenda: true,
  };
}

/** Deixa o gráfico coerente: uma categoria por valor, limites de tamanho e valores finitos. */
export function normalizarGrafico(g: Grafico): Grafico {
  const categorias = (g.categorias.length ? g.categorias : ["Categoria 1"]).slice(0, MAX_CATEGORIAS).map((c) => String(c ?? ""));
  const series = (g.series.length ? g.series : [{ nome: "Série 1", valores: [] }]).slice(0, MAX_SERIES).map((s, i) => ({
    nome: String(s.nome || `Série ${i + 1}`),
    valores: categorias.map((_, j) => {
      const v = Number(s.valores?.[j]);
      return Number.isFinite(v) ? v : 0;
    }),
  }));
  return { ...g, categorias, series };
}

/** Paleta das séries: a do deck, a do gráfico ou a padrão (o acento do deck entra na frente). */
export function paletaDeSeries(n: number, acento?: string, cores?: string[]): string[] {
  const base = (cores?.length ? cores : acento ? [acento, ...GRAFICO_CORES] : GRAFICO_CORES).map((c) => c.replace(/^#/, "").toUpperCase());
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length] ?? GRAFICO_CORES[i % GRAFICO_CORES.length]);
  return out;
}

export interface Escala {
  min: number;
  max: number;
  /** distância entre as linhas da grade */
  passo: number;
  ticks: number[];
}

/** "Arredonda para bonito": 1, 2, 5, 10, 20, 50… conforme a ordem de grandeza. */
function passoBonito(bruto: number): number {
  if (!Number.isFinite(bruto) || bruto <= 0) return 1;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / pot;
  const fator = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return fator * pot;
}

/**
 * Escala dos eixos de valor. Barras, colunas e área começam em 0 (como no PowerPoint);
 * linhas e dispersão podem começar abaixo de zero. Empilhado soma as séries por categoria.
 */
export function escalaDeValores(g: Grafico): Escala {
  const valores: number[] = [];
  if (g.empilhado && (g.tipo === "colunas" || g.tipo === "barras" || g.tipo === "area")) {
    for (let j = 0; j < g.categorias.length; j++) {
      valores.push(g.series.reduce((a, s) => a + (Number(s.valores[j]) || 0), 0));
    }
  } else {
    for (const s of g.series) for (const v of s.valores) valores.push(Number(v) || 0);
  }
  const baseZero = g.tipo === "colunas" || g.tipo === "barras" || g.tipo === "area" || g.tipo === "pizza" || g.tipo === "rosca";
  let min = valores.length ? Math.min(...valores) : 0;
  let max = valores.length ? Math.max(...valores) : 1;
  if (baseZero && min > 0) min = 0;
  if (max === min) max = min + 1;
  // uma folga de 5% no topo (e embaixo, quando o eixo não começa em zero)
  const folga = (max - min) * 0.05;
  const alvo = max + folga;
  const passo = passoBonito((alvo - Math.min(min, 0)) / 5);
  const topo = Math.ceil(alvo / passo) * passo;
  const fundo = baseZero && min >= 0 ? 0 : Math.floor(min / passo) * passo;
  const ticks: number[] = [];
  for (let v = fundo; v <= topo + passo / 2; v += passo) ticks.push(Math.round(v * 1000) / 1000);
  return { min: fundo, max: topo, passo, ticks };
}

// ---------------------------------------------------------------------------
// edições (devolvem um gráfico novo)
// ---------------------------------------------------------------------------

export function comTipo(g: Grafico, tipo: GraficoTipo): Grafico {
  return { ...g, tipo };
}

export function comTitulo(g: Grafico, titulo: string): Grafico {
  return { ...g, titulo };
}

export function comOpcao(g: Grafico, chave: "legenda" | "rotulos" | "empilhado", ligado: boolean): Grafico {
  return { ...g, [chave]: ligado };
}

export function comCores(g: Grafico, cores: string[]): Grafico {
  return { ...g, cores: cores.map((c) => c.replace(/^#/, "").toUpperCase()) };
}

export function setCategoria(g: Grafico, i: number, texto: string): Grafico {
  if (i < 0 || i >= g.categorias.length) return g;
  const categorias = g.categorias.map((c, k) => (k === i ? texto : c));
  return { ...g, categorias };
}

export function setValor(g: Grafico, i: number, j: number, valor: number): Grafico {
  const serie = g.series[j];
  if (!serie || i < 0 || i >= g.categorias.length) return g;
  const valores = serie.valores.map((v, k) => (k === i ? (Number.isFinite(valor) ? valor : 0) : v));
  const series = g.series.map((s, k) => (k === j ? { ...s, valores } : s));
  return { ...g, series };
}

export function setSerieNome(g: Grafico, j: number, nome: string): Grafico {
  if (!g.series[j]) return g;
  return { ...g, series: g.series.map((s, k) => (k === j ? { ...s, nome } : s)) };
}

export function addCategoria(g: Grafico): Grafico {
  if (g.categorias.length >= MAX_CATEGORIAS) return g;
  const categorias = [...g.categorias, `Categoria ${g.categorias.length + 1}`];
  return { ...g, categorias, series: g.series.map((s) => ({ ...s, valores: [...s.valores, 0] })) };
}

export function delCategoria(g: Grafico, i: number): Grafico {
  if (g.categorias.length <= 1 || i < 0 || i >= g.categorias.length) return g;
  return {
    ...g,
    categorias: g.categorias.filter((_, k) => k !== i),
    series: g.series.map((s) => ({ ...s, valores: s.valores.filter((_, k) => k !== i) })),
  };
}

export function addSerie(g: Grafico): Grafico {
  if (g.series.length >= MAX_SERIES) return g;
  const serie: GraficoSerie = { nome: `Série ${g.series.length + 1}`, valores: g.categorias.map(() => 0) };
  return { ...g, series: [...g.series, serie] };
}

export function delSerie(g: Grafico, j: number): Grafico {
  if (g.series.length <= 1 || j < 0 || j >= g.series.length) return g;
  return { ...g, series: g.series.filter((_, k) => k !== j) };
}

/** Total de um conjunto de valores (usado no resumo/editor e nos testes). */
export function totalDaSerie(s: GraficoSerie): number {
  return s.valores.reduce((a, v) => a + (Number(v) || 0), 0);
}

/** A caixa do gráfico novo, centrada na lâmina (em %). */
export function caixaDoGrafico(larguraPt: number, alturaPt: number): ShapeBox {
  const w = Math.min(62, Math.max(40, (480 / larguraPt) * 100));
  const h = Math.min(58, Math.max(34, (300 / alturaPt) * 100));
  return { x: (100 - w) / 2, y: (100 - h) / 2, w, h };
}
