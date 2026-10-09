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

/** Troca o preenchimento da forma (e mantém o campo antigo `fill` em dia para as miniaturas simples). */
export function comPreenchimento(s: Shape, f: Fill | undefined): Shape {
  const n: Shape = { ...s };
  if (!f || f.kind === "none") {
    delete n.fillX;
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
    delete n.ln;
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
    delete n.shadow;
    return n;
  }
  n.shadow = { ...SOMBRA_PADRAO, ...(s.shadow ?? {}), ...sombra };
  return n;
}

export function comOpacidade(s: Shape, o: number): Shape {
  const n: Shape = { ...s };
  if (o >= 1) delete n.opacity;
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
