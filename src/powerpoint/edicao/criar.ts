// Criação de formas novas: a galeria de formas (como a do PowerPoint), caixas de texto, linhas e imagens, já com
// uma aparência que combina com o resto do deck (fonte, cor de destaque e cor do texto mais usadas nele).
import { uid } from "../../util";
import type { DeckSetup, Line, Para, Shape, ShapeBox, Slide } from "../schema";
import { themeOf } from "../themes";
import { ajustarCor, solido } from "./formato";
import type { Dim } from "./geometria";
import { paraVazio } from "./texto";

export interface ItemGaleria {
  geom: string;
  rotulo: string;
  grupo: "Linhas" | "Retângulos" | "Formas básicas" | "Setas de bloco" | "Estrelas e símbolos" | "Balões";
  /** contorno próprio (para as linhas com seta) */
  linha?: Partial<Line>;
  /** ajustes iniciais da geometria */
  adj?: Record<string, number>;
  /** é uma linha/conector (sem preenchimento nem texto) */
  ehLinha?: boolean;
}

export const GALERIA: ItemGaleria[] = [
  { geom: "line", rotulo: "Linha", grupo: "Linhas", ehLinha: true },
  { geom: "line", rotulo: "Seta", grupo: "Linhas", ehLinha: true, linha: { tail: "triangle" } },
  { geom: "line", rotulo: "Seta dupla", grupo: "Linhas", ehLinha: true, linha: { head: "triangle", tail: "triangle" } },
  { geom: "bentConnector3", rotulo: "Conector angular", grupo: "Linhas", ehLinha: true },
  { geom: "curvedConnector3", rotulo: "Conector curvo", grupo: "Linhas", ehLinha: true },
  { geom: "rect", rotulo: "Retângulo", grupo: "Retângulos" },
  { geom: "roundRect", rotulo: "Retângulo arredondado", grupo: "Retângulos" },
  { geom: "snip1Rect", rotulo: "Retângulo com um canto cortado", grupo: "Retângulos" },
  { geom: "snip2SameRect", rotulo: "Retângulo com cantos cortados", grupo: "Retângulos", adj: { adj1: 16667, adj2: 0 } },
  { geom: "round1Rect", rotulo: "Retângulo com um canto arredondado", grupo: "Retângulos" },
  { geom: "round2SameRect", rotulo: "Retângulo com cantos arredondados no topo", grupo: "Retângulos", adj: { adj1: 16667, adj2: 0 } },
  { geom: "round2DiagRect", rotulo: "Retângulo com cantos arredondados em diagonal", grupo: "Retângulos", adj: { adj1: 16667, adj2: 0 } },
  { geom: "ellipse", rotulo: "Elipse", grupo: "Formas básicas" },
  { geom: "triangle", rotulo: "Triângulo", grupo: "Formas básicas" },
  { geom: "rtTriangle", rotulo: "Triângulo retângulo", grupo: "Formas básicas" },
  { geom: "diamond", rotulo: "Losango", grupo: "Formas básicas" },
  { geom: "parallelogram", rotulo: "Paralelogramo", grupo: "Formas básicas" },
  { geom: "trapezoid", rotulo: "Trapézio", grupo: "Formas básicas" },
  { geom: "pentagon", rotulo: "Pentágono", grupo: "Formas básicas" },
  { geom: "hexagon", rotulo: "Hexágono", grupo: "Formas básicas" },
  { geom: "octagon", rotulo: "Octógono", grupo: "Formas básicas" },
  { geom: "donut", rotulo: "Anel", grupo: "Formas básicas" },
  { geom: "frame", rotulo: "Moldura", grupo: "Formas básicas" },
  { geom: "teardrop", rotulo: "Gota", grupo: "Formas básicas" },
  { geom: "can", rotulo: "Cilindro", grupo: "Formas básicas" },
  { geom: "rightArrow", rotulo: "Seta para a direita", grupo: "Setas de bloco" },
  { geom: "leftArrow", rotulo: "Seta para a esquerda", grupo: "Setas de bloco" },
  { geom: "upArrow", rotulo: "Seta para cima", grupo: "Setas de bloco" },
  { geom: "downArrow", rotulo: "Seta para baixo", grupo: "Setas de bloco" },
  { geom: "leftRightArrow", rotulo: "Seta dupla horizontal", grupo: "Setas de bloco" },
  { geom: "upDownArrow", rotulo: "Seta dupla vertical", grupo: "Setas de bloco" },
  { geom: "chevron", rotulo: "Divisa", grupo: "Setas de bloco" },
  { geom: "homePlate", rotulo: "Pentágono (seta)", grupo: "Setas de bloco" },
  { geom: "star5", rotulo: "Estrela de 5 pontas", grupo: "Estrelas e símbolos" },
  { geom: "plus", rotulo: "Cruz", grupo: "Estrelas e símbolos" },
  { geom: "heart", rotulo: "Coração", grupo: "Estrelas e símbolos" },
  { geom: "mathPlus", rotulo: "Mais", grupo: "Estrelas e símbolos" },
  { geom: "mathMinus", rotulo: "Menos", grupo: "Estrelas e símbolos" },
  { geom: "mathMultiply", rotulo: "Multiplicação", grupo: "Estrelas e símbolos" },
  { geom: "noSmoking", rotulo: "Proibido", grupo: "Estrelas e símbolos" },
  { geom: "wedgeRectCallout", rotulo: "Balão retangular", grupo: "Balões" },
  { geom: "wedgeRoundRectCallout", rotulo: "Balão arredondado", grupo: "Balões" },
];

export interface EstiloDeck {
  fonte: string;
  tamanho: number;
  corTexto: string;
  acento: string;
  /** cores mais usadas no deck (preenchimentos, contornos e textos), da mais para a menos usada */
  paleta: string[];
}

const claro = (hex: string) => {
  const c = hex.padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
};
const saturacao = (hex: string) => {
  const c = hex.padEnd(6, "0");
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return Math.max(...ch) - Math.min(...ch);
};

/** Cor do texto que fica legível sobre um preenchimento de acento (acento escuro → branco, claro → escuro). */
export function corDeContraste(acento: string): string {
  return claro(acento) < 150 ? "FFFFFF" : "1C212B";
}

/** Olha o deck e descobre a fonte, a cor de texto e a cor de destaque que mais aparecem. */
export function estiloDoDeck(slides: Slide[], setup: DeckSetup): EstiloDeck {
  const t = themeOf(setup.theme);
  const fontes = new Map<string, number>();
  const textos = new Map<string, number>();
  const destaques = new Map<string, number>();
  const todas = new Map<string, number>();
  const soma = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const sl of slides) {
    for (const s of sl.shapes) {
      if (s.fixa) continue;
      for (const p of s.paras ?? []) {
        for (const r of p.runs) {
          const n = r.text.length;
          soma(fontes, r.font, n);
          soma(textos, r.color, n);
          soma(todas, r.color, n * 0.5);
        }
      }
      const f = s.fillX;
      const area = s.box.w * s.box.h;
      if (f?.kind === "solid" && f.color) {
        soma(todas, f.color, area);
        if (saturacao(f.color) > 60 && claro(f.color) > 25 && claro(f.color) < 235) soma(destaques, f.color, area);
      }
      if (f?.kind === "gradient" && f.stops?.[0]) soma(todas, f.stops[0].color, area);
      if (s.ln) soma(todas, s.ln.color, 2);
    }
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const paleta = top(todas).slice(0, 10);
  return {
    fonte: top(fontes)[0] ?? setup.fontFamily ?? "Segoe UI",
    tamanho: 18,
    corTexto: top(textos).find((c) => claro(c) < 160) ?? t.fg,
    acento: top(destaques)[0] ?? t.accent,
    paleta,
  };
}

const INS_PADRAO: [number, number, number, number] = [7.2, 3.6, 7.2, 3.6];

function paraInicial(estilo: EstiloDeck, align: Para["align"]): Para[] {
  return [paraVazio({ size: estilo.tamanho }, align)];
}

/** Caixa com o centro em (cx, cy) %, do tamanho dado em pt. */
export function caixaCentrada(cx: number, cy: number, wPt: number, hPt: number, d: Dim): ShapeBox {
  const w = (wPt / d.w) * 100;
  const h = (hPt / d.h) * 100;
  return { x: Math.max(0, Math.min(100 - w, cx - w / 2)), y: Math.max(0, Math.min(100 - h, cy - h / 2)), w, h };
}

function baseDeForma(box: ShapeBox, estilo: EstiloDeck): Shape {
  return {
    id: uid(),
    kind: "forma",
    box,
    text: "",
    fontFamily: estilo.fonte,
    fontSize: estilo.tamanho,
    color: estilo.corTexto,
    bold: false,
    italic: false,
    align: "esquerda",
    fill: "",
    src: "",
    rot: 0,
  };
}

/** Forma da galeria, já com a cara do deck. */
export function novaForma(item: ItemGaleria, box: ShapeBox, estilo: EstiloDeck): Shape {
  const s = baseDeForma(box, estilo);
  s.geom = item.geom;
  s.name = item.rotulo;
  if (item.adj) s.adj = { ...item.adj };
  if (item.ehLinha) {
    s.kind = "forma";
    s.ln = { color: ajustarCor(estilo.corTexto, 1), alpha: 1, w: 2, dash: "solid", ...(item.linha ?? {}) };
    return s;
  }
  s.fillX = solido(estilo.acento);
  s.fill = estilo.acento;
  s.ln = { color: ajustarCor(estilo.acento, 0.7), alpha: 1, w: 1, dash: "solid" };
  // texto dentro da forma: branco em fundo escuro e escuro em fundo claro
  const corNoTexto = corDeContraste(estilo.acento);
  s.color = corNoTexto;
  s.align = "centro";
  s.paras = [paraVazio({ size: estilo.tamanho }, "centro")];
  s.anchor = "ctr";
  s.ins = [...INS_PADRAO];
  return s;
}

/** Caixa de texto: sem preenchimento nem contorno, texto começando no alto e à esquerda. */
export function novaCaixaDeTexto(box: ShapeBox, estilo: EstiloDeck): Shape {
  const s = baseDeForma(box, estilo);
  s.kind = "texto";
  s.geom = "rect";
  s.name = "Caixa de texto";
  s.paras = paraInicial(estilo, "esquerda");
  s.anchor = "t";
  s.ins = [...INS_PADRAO];
  return s;
}

/** Imagem já registrada na mídia do deck (`media:ID`), ajustada para caber na lâmina. */
export function novaImagem(src: string, larguraPx: number, alturaPx: number, d: Dim, estilo: EstiloDeck): Shape {
  const s = baseDeForma({ x: 10, y: 10, w: 40, h: 40 }, estilo);
  s.kind = "imagem";
  s.geom = "rect";
  s.name = "Imagem";
  s.src = src;
  // cabe em 60% da lâmina mantendo a proporção da imagem, centralizada
  const prop = larguraPx > 0 && alturaPx > 0 ? larguraPx / alturaPx : 4 / 3;
  let wPt = d.w * 0.6;
  let hPt = wPt / prop;
  if (hPt > d.h * 0.7) {
    hPt = d.h * 0.7;
    wPt = hPt * prop;
  }
  s.box = caixaCentrada(50, 50, wPt, hPt, d);
  return s;
}
