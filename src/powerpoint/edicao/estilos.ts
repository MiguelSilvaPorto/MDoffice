// Estilos de cor (PowerPoint): o motor puro do sistema. Gera a "rampa" de tons que preserva a
// saturação e desvia o matiz no tom escuro (verde → teal, como na referência do usuário), o
// brilho (o lustro dentro da própria rampa e a dobra como forma-capa) e o esquema casado
// (contorno, sombra e cor do texto por contraste). O estilo é VIVO: a forma guarda a receita e a
// cor-base, e `atualizarEstilos` redesenha tudo a cada mudança da lâmina — trocar a cor, a
// intensidade ou o tema refaz a rampa inteira.
import { uid } from "../../util";
import type { BrilhoEstilo, EstiloForma, FamiliaEstilo, Fill, GradStop, IntensidadeEstilo, Line, Shape, Shadow, Slide } from "../schema";
import { comLinha, comPreenchimento, comSombra } from "./formato";
import type { Dim } from "./geometria";

const r2 = (v: number) => Math.round(v * 100) / 100;
const hex6 = (c: string) => (c || "000000").replace(/^#/, "").toUpperCase().padEnd(6, "0").slice(0, 6);

// ---------------------------------------------------------------------------
// famílias (as receitas)
// ---------------------------------------------------------------------------

/** A receita de uma família: a cor própria e o desvio do matiz no tom escuro (em graus). */
export interface ReceitaEstilo {
  nome: string;
  /** cor própria da família (hex sem #); vazia na "Da sua cor" (usa a cor da forma ou o tema) */
  base: string;
  /** quantos graus o matiz do tom escuro desvia (o verde da Esmeralda vai para o teal com +20) */
  desvio: number;
}

export const FAMILIAS: Record<FamiliaEstilo, ReceitaEstilo> = {
  esmeralda: { nome: "Esmeralda", base: "1F9D55", desvio: 20 },
  oceano: { nome: "Oceano", base: "1D6FB8", desvio: -10 },
  ameixa: { nome: "Ameixa", base: "7A3E9D", desvio: 15 },
  ambar: { nome: "Âmbar", base: "E08A1E", desvio: -12 },
  rubi: { nome: "Rubi", base: "C6363C", desvio: 12 },
  grafite: { nome: "Grafite", base: "4A5568", desvio: -8 },
  propria: { nome: "Da sua cor", base: "", desvio: 12 },
};

/** A ordem das famílias na galeria. */
export const FAMILIAS_ORDEM: FamiliaEstilo[] = ["esmeralda", "oceano", "ameixa", "ambar", "rubi", "grafite", "propria"];

export const INTENSIDADES: { id: IntensidadeEstilo; nome: string }[] = [
  { id: "suave", nome: "Suave" },
  { id: "media", nome: "Média" },
  { id: "forte", nome: "Forte" },
];

// ---------------------------------------------------------------------------
// cor (HSL)
// ---------------------------------------------------------------------------

/** Converte uma cor (hex sem #) para matiz (0-360), saturação e luz (0-1). */
export function hexParaHsl(hex: string): { h: number; s: number; l: number } {
  const c = hex6(hex);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s, l };
}

/** O canal da conversão HSL → RGB (a função clássica, com o matiz em 0-1). */
const canal = (p: number, q: number, t: number): number => {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
};

/** Monta uma cor (hex sem #) de matiz (0-360), saturação e luz (0-1). */
export function hslParaHex(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  let r: number;
  let g: number;
  let b: number;
  if (ss === 0) {
    r = g = b = ll;
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = canal(p, q, hh + 1 / 3);
    g = canal(p, q, hh);
    b = canal(p, q, hh - 1 / 3);
  }
  return [r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Luminância percebida de uma cor (0-255). */
export const luminancia = (hex: string): number => {
  const c = hex6(hex);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** A cor do texto que contrasta com o fundo: branco nos tons escuros, grafite nos claros. */
export function contrastePara(cor: string): string {
  return luminancia(cor) < 150 ? "FFFFFF" : "1F2A37";
}

// ---------------------------------------------------------------------------
// a rampa e o esquema
// ---------------------------------------------------------------------------

/** O quanto a rampa abre por intensidade: o tom claro sobe e o escuro desce (em luz, 0-1). */
const ABERTURA: Record<IntensidadeEstilo, { claro: number; escuro: number }> = {
  suave: { claro: 0.08, escuro: 0.1 },
  media: { claro: 0.13, escuro: 0.17 },
  forte: { claro: 0.18, escuro: 0.24 },
};

/** Os três tons da rampa: o claro, a cor e o tom profundo desviado para o frio. */
export function rampaDeTons(base: string, intensidade: IntensidadeEstilo, desvio: number): { claro: string; cor: string; escuro: string } {
  const { h, s, l } = hexParaHsl(base);
  const ab = ABERTURA[intensidade] ?? ABERTURA.media;
  const claro = hslParaHex(h - desvio * 0.25, Math.max(0.12, s * 0.9), Math.min(0.94, l + ab.claro));
  const escuro = hslParaHex(h + desvio, Math.min(1, s * 1.08), Math.max(0.1, l - ab.escuro));
  return { claro, cor: hex6(base), escuro };
}

/** As paradas de branco translúcido do lustro (a faixa clara dentro da própria rampa). */
export const LUSTRO: GradStop[] = [
  { pos: 50, color: "FFFFFF", alpha: 0 },
  { pos: 58, color: "FFFFFF", alpha: 0.24 },
  { pos: 72, color: "FFFFFF", alpha: 0.1 },
  { pos: 80, color: "FFFFFF", alpha: 0 },
];

/** Tudo que um estilo gera: o gradiente, o contorno, a sombra e a cor do texto. */
export interface EsquemaEstilo {
  /** a cor-base resolvida (estilo, família ou tema) */
  cor: string;
  claro: string;
  escuro: string;
  fill: Fill;
  ln: Partial<Line>;
  shadow: Shadow;
  corTexto: string;
}

/** Resolve a cor-base: a do estilo; vazia = a cor própria da família; vazia = o acento do tema. */
export function corDoEstilo(e: EstiloForma, tema: { acento: string }): string {
  return hex6((e.base ?? "").trim() || FAMILIAS[e.familia]?.base || tema.acento || "1F9D55");
}

/**
 * Deriva o esquema de um estilo: a rampa (com o lustro, quando é o acabamento) em diagonal, o
 * contorno no tom profundo, a sombra leve e a cor do texto por contraste com a cor-base.
 */
export function esquemaDoEstilo(e: EstiloForma, tema: { acento: string }): EsquemaEstilo {
  const receita = FAMILIAS[e.familia] ?? FAMILIAS.propria;
  const cor = corDoEstilo(e, tema);
  const { claro, escuro } = rampaDeTons(cor, e.intensidade, receita.desvio);
  const stops: GradStop[] = [
    { pos: 0, color: claro, alpha: 1 },
    { pos: 45, color: cor, alpha: 1 },
    { pos: 100, color: escuro, alpha: 1 },
  ];
  if (e.brilho === "lustro") stops.push(...LUSTRO.map((t) => ({ ...t })));
  return {
    cor,
    claro,
    escuro,
    fill: { kind: "gradient", stops: stops.sort((a, b) => a.pos - b.pos), angle: e.angulo ?? 45 },
    ln: { color: escuro, alpha: 0.55, w: 0.75, dash: "solid" },
    shadow: { color: "000000", alpha: 0.18, blur: 12, dist: 4, dir: 90 },
    corTexto: contrastePara(cor),
  };
}

/**
 * Aplica o esquema na forma: preenchimento, contorno, sombra e a cor-base do texto. Os trechos
 * que usavam a cor anterior da forma acompanham (o texto "casa" com o fundo); os trechos com cor
 * própria ficam como estão. Não mexe em caixa, texto, giro nem cantos.
 */
export function aplicarEsquemaNaForma(s: Shape, esq: EsquemaEstilo): Shape {
  const anterior = hex6(s.color);
  let n = comPreenchimento(s, esq.fill);
  n = comLinha(n, esq.ln);
  n = comSombra(n, esq.shadow);
  n = { ...n, color: esq.corTexto };
  if (n.paras?.length) {
    n.paras = n.paras.map((p) => ({
      ...p,
      runs: p.runs.map((r) => (hex6(r.color) === anterior ? { ...r, color: esq.corTexto } : r)),
    }));
  }
  return n;
}

/**
 * A forma do brilho-dobra: um paralelogramo translúcido no lado direito, com a caixa e o giro da
 * forma-base (o recálculo mantém as duas juntas; a identidade é preservada quando já existe).
 */
export function capaDaDobra(base: Shape, d: Dim, id?: string): Shape {
  const w = Math.max((base.box.w / 100) * d.w, 1);
  const h = Math.max((base.box.h / 100) * d.h, 1);
  const cmds: (string | number)[] = ["M", r2(w * 0.6), 0, "L", r2(w * 0.74), 0, "L", r2(w * 0.52), r2(h), "L", r2(w * 0.38), r2(h), "Z"];
  return {
    id: id ?? uid(),
    kind: "forma",
    box: { ...base.box },
    rot: base.rot,
    text: "",
    fontFamily: base.fontFamily,
    fontSize: base.fontSize,
    color: base.color,
    bold: false,
    italic: false,
    align: "centro",
    fill: "",
    src: "",
    name: "Brilho",
    geom: "custom",
    paths: [{ w: r2(w), h: r2(h), cmds }],
    fillX: {
      kind: "gradient",
      angle: 0,
      stops: [
        { pos: 0, color: "FFFFFF", alpha: 0.02 },
        { pos: 42, color: "FFFFFF", alpha: 0.04 },
        { pos: 58, color: "FFFFFF", alpha: 0.16 },
        { pos: 84, color: "FFFFFF", alpha: 0.03 },
        { pos: 100, color: "FFFFFF", alpha: 0 },
      ],
    },
    capa: { de: base.id },
    grupo: base.grupo,
  };
}

/** O fundo da lâmina com estilo: a mesma rampa (a dobra, no fundo, vira lustro — sem forma-capa). */
export function fillDoFundo(e: EstiloForma, tema: { acento: string }): Fill {
  const receita: EstiloForma = e.brilho === "dobra" ? { ...e, brilho: "lustro" } : e;
  return esquemaDoEstilo(receita, tema).fill;
}

// ---------------------------------------------------------------------------
// ligar e soltar (o que a galeria, o painel e o preenchimento usam)
// ---------------------------------------------------------------------------

/** Os ângulos oferecidos na galeria (o padrão é 45 — a diagonal do app). */
export const ANGULOS_ESTILO = [0, 45, 90, 135];

export const ehFamilia = (v: string): v is FamiliaEstilo => Object.prototype.hasOwnProperty.call(FAMILIAS, v);
export const ehIntensidade = (v: string): v is IntensidadeEstilo => INTENSIDADES.some((i) => i.id === v);
export const ehBrilho = (v: string): v is BrilhoEstilo => v === "nada" || v === "lustro" || v === "dobra";

/** O estilo padrão da galeria: média, com lustro, na diagonal — a cara da referência em dois cliques. */
export function estiloDaFamilia(familia: FamiliaEstilo, base?: string): EstiloForma {
  const e: EstiloForma = { familia, intensidade: "media", brilho: "lustro", angulo: 45 };
  if (base) e.base = base;
  return e;
}

/** Liga ou atualiza o estilo nas formas escolhidas: as que ainda não têm nascem com o padrão. */
export function ligarEstilo(slide: Slide, ids: string[], patch: Partial<EstiloForma>, padrao: EstiloForma): Slide {
  const alvo = new Set(ids);
  let mudou = false;
  const shapes = slide.shapes.map((s) => {
    if (!alvo.has(s.id)) return s;
    mudou = true;
    return { ...s, estilo: { ...(s.estilo ?? padrao), ...patch } };
  });
  return mudou ? { ...slide, shapes } : slide;
}

/**
 * Solta o estilo (o "Desligar estilo"): a pintura derivada fica como está, editável à mão, e a
 * capa da dobra vira forma comum (mantém o desenho). Nada acontece com quem não tem estilo.
 */
export function soltarEstilo(slide: Slide, ids: string[]): Slide {
  const alvo = new Set(ids);
  let mudou = false;
  const shapes = slide.shapes.map((s) => {
    let n: Shape | null = null;
    if (s.estilo && alvo.has(s.id)) {
      n = { ...s };
      delete n.estilo;
    }
    if (s.capa && (alvo.has(s.id) || alvo.has(s.capa.de))) {
      n = n ?? { ...s };
      delete n.capa;
    }
    if (!n) return s;
    mudou = true;
    return n;
  });
  return mudou ? { ...slide, shapes } : slide;
}

/**
 * Recalcula tudo que é derivado do estilo na lâmina: as formas com estilo (preenchimento,
 * contorno, sombra, cor do texto e a capa da dobra) e o fundo com estilo. Apagar a forma-base
 * leva a capa junto; a lâmina sem estilos volta a MESMA referência (custo zero).
 */
export function atualizarEstilos(slide: Slide, d: Dim, tema: { acento: string }): Slide {
  const temEstilo = slide.shapes.some((s) => s.estilo || s.capa) || !!slide.bgEstilo;
  if (!temEstilo) return slide;

  const porId = new Map(slide.shapes.map((s) => [s.id, s]));
  const capaDe = new Map<string, Shape>(); // base -> capa atual (para preservar o id)
  for (const s of slide.shapes) if (s.capa && porId.has(s.capa.de)) capaDe.set(s.capa.de, s);

  const saida: Shape[] = [];
  for (const s of slide.shapes) {
    if (s.capa) continue; // resolvida junto da forma-base (ou cai fora, se ficou órfã)
    if (!s.estilo) {
      saida.push(s);
      continue;
    }
    const esq = esquemaDoEstilo(s.estilo, tema);
    let nova = aplicarEsquemaNaForma(s, esq);
    if (s.estilo.brilho === "dobra") {
      // a capa nasce AGRUPADA com a base (mesmo `grupo` e vizinhas na ordem das formas — é assim
      // que o .pptx as leva como um grupo). O grupo só nasce junto da capa: se o usuário
      // desagrupar depois, o recálculo respeita (não volta a agrupar).
      const capaAtual = capaDe.get(s.id);
      if (!nova.grupo) {
        const g = capaAtual ? capaAtual.grupo : uid();
        if (g) nova = { ...nova, grupo: g };
      }
      saida.push(nova);
      saida.push(capaDaDobra(nova, d, capaAtual?.id));
    } else {
      saida.push(nova);
    }
  }

  const comFundo = slide.bgEstilo ? { ...slide, bg: fillDoFundo(slide.bgEstilo, tema) } : slide;
  return { ...comFundo, shapes: saida };
}
