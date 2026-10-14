// Formato das formas: preenchimento (sólido, gradiente, imagem), contorno, sombra, cantos, transparência.
// Funções puras sobre uma Shape (devolvem outra).
import type { Fill, GradStop, Line, Shadow, Shape } from "../schema";

const hex6 = (c: string) => (c || "000000").replace(/^#/, "").toUpperCase().padEnd(6, "0").slice(0, 6);

export function solido(cor: string, alpha = 1): Fill {
  return { kind: "solid", color: hex6(cor), alpha };
}

/** Gradiente linear de duas cores (ângulo no padrão do PowerPoint: 0 = esquerda→direita, 90 = cima→baixo). */
export function gradiente(c1: string, c2: string, angulo = 90): Fill {
  const stops: GradStop[] = [
    { pos: 0, color: hex6(c1), alpha: 1 },
    { pos: 100, color: hex6(c2), alpha: 1 },
  ];
  return { kind: "gradient", stops, angle: angulo };
}

/** A cor "principal" do preenchimento (a do sólido, ou a primeira parada do gradiente). */
export function corPrincipal(f: Fill | undefined): string | null {
  if (!f || f.kind === "none") return null;
  if (f.kind === "solid") return f.color ?? "000000";
  if (f.kind === "gradient") return f.stops?.[0]?.color ?? null;
  return null;
}

/** Escurece (fator < 1) ou clareia (fator > 1) uma cor. */
export function ajustarCor(cor: string, fator: number): string {
  const c = hex6(cor);
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  const novo = ch.map((v) => (fator <= 1 ? v * fator : v + (255 - v) * (fator - 1)));
  return novo.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Troca o preenchimento da forma (e mantém o campo antigo `fill` em dia para as miniaturas simples).
 * Campo removido vira `undefined`, não `delete`: quem aplica estas funções é o `patchFormas`, que
 * espalha o resultado por cima da forma original (`{ ...s, ...patch(s) }`) — uma chave apagada
 * continuaria viva na original (era o "Sem sombra" que não tirava a sombra).
 */
export function comPreenchimento(s: Shape, f: Fill | undefined): Shape {
  const n: Shape = { ...s };
  if (!f || f.kind === "none") {
    n.fillX = undefined;
    n.fill = "";
    if (f?.kind === "none") n.fillX = { kind: "none" };
    return n;
  }
  n.fillX = f;
  n.fill = f.kind === "solid" ? (f.color ?? "") : (corPrincipal(f) ?? "");
  return n;
}

export const LINHA_PADRAO: Line = { color: "000000", alpha: 1, w: 1, dash: "solid" };

/** Atualiza o contorno (cria um contorno padrão se ainda não existe). `null` tira o contorno. */
export function comLinha(s: Shape, patch: Partial<Line> | null): Shape {
  const n: Shape = { ...s };
  if (patch === null) {
    n.ln = undefined;
    return n;
  }
  n.ln = { ...LINHA_PADRAO, ...(s.ln ?? {}), ...patch };
  for (const k of ["head", "tail"] as const) if (n.ln[k] === undefined) delete n.ln[k];
  return n;
}

export const SOMBRA_PADRAO: Shadow = { color: "000000", alpha: 0.3, blur: 8, dist: 4, dir: 90 };

/** Sombras prontas, como a galeria "Efeitos" do PowerPoint. */
export const SOMBRAS_PRONTAS: { nome: string; sombra: Shadow | null }[] = [
  { nome: "Sem sombra", sombra: null },
  { nome: "Suave embaixo", sombra: { color: "000000", alpha: 0.22, blur: 10, dist: 4, dir: 90 } },
  { nome: "Média embaixo", sombra: { color: "000000", alpha: 0.35, blur: 8, dist: 6, dir: 90 } },
  { nome: "Forte embaixo", sombra: { color: "000000", alpha: 0.5, blur: 6, dist: 8, dir: 90 } },
  { nome: "Diagonal", sombra: { color: "000000", alpha: 0.35, blur: 6, dist: 6, dir: 45 } },
  { nome: "Brilho suave", sombra: { color: "FFFFFF", alpha: 0.6, blur: 12, dist: 0, dir: 0 } },
];

export function comSombra(s: Shape, sombra: Partial<Shadow> | null): Shape {
  const n: Shape = { ...s };
  if (sombra === null) {
    n.shadow = undefined;
    return n;
  }
  n.shadow = { ...SOMBRA_PADRAO, ...(s.shadow ?? {}), ...sombra };
  return n;
}

export function comOpacidade(s: Shape, o: number): Shape {
  const n: Shape = { ...s };
  if (o >= 1) n.opacity = undefined;
  else n.opacity = Math.max(0, o);
  return n;
}

/** Qual ajuste da geometria é o "raio dos cantos" (e o máximo dele), quando a forma tem um. */
export function ajusteDeCanto(geom: string | undefined): { chave: string; max: number; padrao: number } | null {
  switch (geom) {
    case "roundRect":
      return { chave: "adj", max: 50000, padrao: 16667 };
    case "round1Rect":
    case "snip1Rect":
      return { chave: "adj", max: 50000, padrao: 16667 };
    case "round2SameRect":
    case "snip2SameRect":
      return { chave: "adj1", max: 50000, padrao: 16667 };
    default:
      return null;
  }
}

/** Raio dos cantos em % do menor lado (0-50). */
export function raioDeCanto(s: Shape): number | null {
  const a = ajusteDeCanto(s.geom);
  if (!a) return null;
  return ((s.adj?.[a.chave] ?? a.padrao) / a.max) * 50;
}

export function comRaioDeCanto(s: Shape, pct: number): Shape {
  const a = ajusteDeCanto(s.geom);
  if (!a) return s;
  const v = Math.round((Math.max(0, Math.min(50, pct)) / 50) * a.max);
  return { ...s, adj: { ...(s.adj ?? {}), [a.chave]: v } };
}

// ---------------------------------------------------------------------------
// cantos por canto (raio independente nos 4 cantos)
// ---------------------------------------------------------------------------

/** Os quatro cantos, na ordem do array `Shape.cantos`. */
export type Canto = "tl" | "tr" | "br" | "bl";

export const CANTOS: Canto[] = ["tl", "tr", "br", "bl"];

/** Nome de cada canto (painel, HUD e dicas). */
export const CANTO_ROTULO: Record<Canto, string> = {
  tl: "superior esquerdo",
  tr: "superior direito",
  br: "inferior direito",
  bl: "inferior esquerdo",
};

/** Geometrias em que o raio por canto vale (as retangulares com canto arredondado). */
export function cantosEditaveis(geom: string | null | undefined): boolean {
  const g = geom ?? "rect";
  return g === "rect" || g === "roundRect" || g === "round1Rect" || g === "round2SameRect" || g === "round2DiagRect";
}

/** Valor de `adj` (1/100000) para um raio em % do menor lado. */
export const adjDeCanto = (pct: number): number => Math.round((Math.max(0, Math.min(50, pct)) / 50) * 50000);

const pctDeAdj = (v: number | undefined, padrao = 0): number => ((v ?? padrao) / 50000) * 50;

/**
 * O raio dos 4 cantos em % do menor lado: o valor guardado (`cantos`) ou, quando a forma ainda
 * não passou pelo controle de cantos, o que a geometria atual representa (roundRect, 1 canto,
 * par de cantos). `null` = a geometria não tem cantos editáveis (elipse, setas, formas livres...).
 */
export function cantosDe(s: Shape): [number, number, number, number] | null {
  if (!cantosEditaveis(s.geom)) return null;
  if (s.cantos?.length === 4) {
    const c = s.cantos.map((v) => Math.max(0, Math.min(50, v)));
    return [c[0], c[1], c[2], c[3]];
  }
  const adj = s.adj ?? {};
  const g = s.geom ?? "rect";
  if (g === "round1Rect") return [0, pctDeAdj(adj.adj, 16667), 0, 0];
  if (g === "round2SameRect") {
    const cima = pctDeAdj(adj.adj1, 16667);
    const baixo = pctDeAdj(adj.adj2, 0);
    return [cima, cima, baixo, baixo];
  }
  if (g === "round2DiagRect") {
    const diag1 = pctDeAdj(adj.adj1, 16667);
    const diag2 = pctDeAdj(adj.adj2, 0);
    return [diag1, diag2, diag1, diag2];
  }
  if (g === "roundRect") {
    const v = pctDeAdj(adj.adj, 16667);
    return [v, v, v, v];
  }
  return [0, 0, 0, 0];
}

/** Novo conjunto de cantos: muda só os cantos escolhidos e preserva os demais. */
export function valoresComSelecao(base: [number, number, number, number], selecao: Canto[], pct: number): [number, number, number, number] {
  const out: [number, number, number, number] = [...base] as [number, number, number, number];
  const v = Math.round(Math.max(0, Math.min(50, pct)) * 100) / 100;
  CANTOS.forEach((c, i) => {
    if (selecao.includes(c)) out[i] = v;
  });
  return out;
}

/** Novo raio para a seleção de cantos, devolvendo a forma pronta (vira retângulo com cantos). */
export function comCantos(s: Shape, selecao: Canto[], pct: number): Shape {
  const atual = cantosDe(s);
  if (!atual) return s;
  const n: Shape = { ...s, cantos: valoresComSelecao(atual, selecao, pct), geom: "roundRect" };
  n.adj = undefined;
  return n;
}

/** Como o conjunto de 4 cantos cabe numa forma que o PowerPoint entende por si. */
export type RepresentacaoCantos = "rect" | "roundRect" | "round1Rect" | "round2SameRect" | "round2DiagRect" | "livre";

const mesmo = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;
const zerado = (v: number): boolean => Math.max(0, v) < 0.01;

/**
 * A forma nativa mais próxima — sem inventar: só vale quando os 4 raios batem EXATAMENTE com o
 * que aquele preset desenha (a semântica segue o presetShapeDefinitions do OOXML):
 *  - roundRect: os quatro iguais;
 *  - round1Rect: só o canto superior direito;
 *  - round2SameRect: par de cima e par de baixo (cada par igual);
 *  - round2DiagRect: diagonal sup. esq/inf. dir e diagonal sup. dir/inf. esq;
 *  - "livre": qualquer outro arranjo (vira geometria livre no arquivo, como o "Combinar formas").
 */
export function representacaoDeCantos(c: [number, number, number, number]): RepresentacaoCantos {
  const [tl, tr, br, bl] = c.map((v) => Math.max(0, v));
  if ([tl, tr, br, bl].every(zerado)) return "rect";
  if (mesmo(tl, tr) && mesmo(tl, br) && mesmo(tl, bl)) return "roundRect";
  if (!zerado(tr) && zerado(tl) && zerado(br) && zerado(bl)) return "round1Rect";
  if (mesmo(tl, tr) && mesmo(br, bl)) return "round2SameRect";
  if (mesmo(tl, br) && mesmo(tr, bl)) return "round2DiagRect";
  return "livre";
}

/** Um ajuste genérico da geometria (setas, triângulo, estrela...). */
export function comAjuste(s: Shape, chave: string, valor: number): Shape {
  return { ...s, adj: { ...(s.adj ?? {}), [chave]: Math.round(valor) } };
}

/** Os ajustes que a fita/painel oferece por tipo de forma (com intervalo e padrão). */
export const AJUSTES_POR_GEOM: Record<string, { chave: string; rotulo: string; min: number; max: number; padrao: number }[]> = {
  triangle: [{ chave: "adj", rotulo: "Posição da ponta", min: 0, max: 100000, padrao: 50000 }],
  parallelogram: [{ chave: "adj", rotulo: "Inclinação", min: 0, max: 100000, padrao: 25000 }],
  trapezoid: [{ chave: "adj", rotulo: "Inclinação", min: 0, max: 50000, padrao: 25000 }],
  hexagon: [{ chave: "adj", rotulo: "Pontas", min: 0, max: 50000, padrao: 25000 }],
  octagon: [{ chave: "adj", rotulo: "Cantos cortados", min: 0, max: 50000, padrao: 29289 }],
  chevron: [{ chave: "adj", rotulo: "Profundidade", min: 0, max: 100000, padrao: 50000 }],
  homePlate: [{ chave: "adj", rotulo: "Ponta", min: 0, max: 100000, padrao: 50000 }],
  rightArrow: [
    { chave: "adj1", rotulo: "Espessura da haste", min: 0, max: 100000, padrao: 50000 },
    { chave: "adj2", rotulo: "Comprimento da ponta", min: 0, max: 100000, padrao: 50000 },
  ],
  leftArrow: [
    { chave: "adj1", rotulo: "Espessura da haste", min: 0, max: 100000, padrao: 50000 },
    { chave: "adj2", rotulo: "Comprimento da ponta", min: 0, max: 100000, padrao: 50000 },
  ],
  upArrow: [
    { chave: "adj1", rotulo: "Espessura da haste", min: 0, max: 100000, padrao: 50000 },
    { chave: "adj2", rotulo: "Comprimento da ponta", min: 0, max: 100000, padrao: 50000 },
  ],
  downArrow: [
    { chave: "adj1", rotulo: "Espessura da haste", min: 0, max: 100000, padrao: 50000 },
    { chave: "adj2", rotulo: "Comprimento da ponta", min: 0, max: 100000, padrao: 50000 },
  ],
  star5: [{ chave: "adj", rotulo: "Profundidade", min: 0, max: 50000, padrao: 19098 }],
  plus: [{ chave: "adj", rotulo: "Espessura", min: 0, max: 50000, padrao: 25000 }],
  donut: [{ chave: "adj", rotulo: "Espessura do anel", min: 0, max: 50000, padrao: 25000 }],
  frame: [{ chave: "adj1", rotulo: "Espessura da moldura", min: 0, max: 50000, padrao: 12500 }],
  can: [{ chave: "adj", rotulo: "Altura da tampa", min: 0, max: 50000, padrao: 25000 }],
  wedgeRectCallout: [
    { chave: "adj1", rotulo: "Ponta (horizontal)", min: -100000, max: 100000, padrao: -20833 },
    { chave: "adj2", rotulo: "Ponta (vertical)", min: -100000, max: 100000, padrao: 62500 },
  ],
  wedgeRoundRectCallout: [
    { chave: "adj1", rotulo: "Ponta (horizontal)", min: -100000, max: 100000, padrao: -20833 },
    { chave: "adj2", rotulo: "Ponta (vertical)", min: -100000, max: 100000, padrao: 62500 },
    { chave: "adj3", rotulo: "Cantos", min: 0, max: 50000, padrao: 16667 },
  ],
};
