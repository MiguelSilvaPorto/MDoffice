// Desenhos dos modelos (botão Template): cada modelo, além de cores e fonte, traz um DESENHO — as
// decorações da lâmina (barra lateral, faixas, triângulos, círculos, moldura, blocos), diferentes na
// capa/seção e no miolo. São formas FIXAS (atrás do texto, sem seleção) marcadas no `name` com
// "tpl:", então trocar de modelo as troca, e uma lâmina nova herda as do modelo da anterior.
//
// As decorações ficam nas bordas e nos cantos: as caixas de texto dos layouts (título, subtítulo,
// corpo) ocupam o miolo e não são tocadas. Funções puras.
import { uid } from "../../util";
import type { Fill, Shape, ShapeBox, Slide, SlideLayout } from "../schema";

export type DesenhoId = "barra" | "faixa" | "cantos" | "circulos" | "moldura" | "blocos";

export const DESENHOS: { id: DesenhoId; nome: string }[] = [
  { id: "barra", nome: "Barra lateral" },
  { id: "faixa", nome: "Faixas" },
  { id: "cantos", nome: "Cantos" },
  { id: "circulos", nome: "Círculos" },
  { id: "moldura", nome: "Moldura" },
  { id: "blocos", nome: "Blocos" },
];

/** As cores com que o desenho é pintado (hex sem #). */
export interface CoresDesenho {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
}

/** O prefixo do `name` das decorações: é por ele que elas são reconhecidas e trocadas. */
const MARCA = "tpl:";

const solido = (color: string, alpha = 1): Fill => ({ kind: "solid", color, alpha });

/** Uma decoração: forma fixa, sem texto, pintada (ou só com contorno). */
function deco(desenho: DesenhoId, cores: CoresDesenho, geom: string, box: ShapeBox, pintura: { cor?: string; alpha?: number; ln?: { cor: string; w: number; alpha?: number }; flipH?: boolean; flipV?: boolean }): Shape {
  const s: Shape = {
    id: uid(),
    kind: "forma",
    box,
    text: "",
    fontFamily: "",
    fontSize: 12,
    color: cores.fg,
    bold: false,
    italic: false,
    align: "esquerda",
    fill: pintura.cor ?? "",
    src: "",
    rot: 0,
    geom,
    // o nome carrega o desenho e as cores: é o que permite refazê-lo quando o layout da lâmina muda
    name: `${MARCA}${desenho}:${cores.bg}:${cores.fg}:${cores.accent}:${cores.muted}`,
    fixa: true,
  };
  if (pintura.cor) s.fillX = solido(pintura.cor, pintura.alpha ?? 1);
  if (pintura.ln) s.ln = { color: pintura.ln.cor, alpha: pintura.ln.alpha ?? 1, w: pintura.ln.w, dash: "solid", cap: "flat", join: "miter" };
  if (pintura.flipH) s.flipH = true;
  if (pintura.flipV) s.flipV = true;
  return s;
}

/** A capa e a seção têm o texto no miolo; o resto das lâminas, o título em cima e o corpo embaixo. */
const ehCapa = (layout: SlideLayout): boolean => layout === "titulo" || layout === "secao";

/**
 * As decorações de um desenho para um layout. `ratio` é a proporção da lâmina (largura ÷ altura):
 * as caixas são em % de cada eixo, então um quadrado/círculo precisa de `h = w × ratio`.
 */
export function decoracoesDe(desenho: DesenhoId, layout: SlideLayout, c: CoresDesenho, ratio = 16 / 9): Shape[] {
  if (layout === "vazio") return [];
  const capa = ehCapa(layout);
  const d = (geom: string, box: ShapeBox, p: Parameters<typeof deco>[4]) => deco(desenho, c, geom, box, p);
  /** altura (em %) de uma forma que precisa ser quadrada com `w` (em %) de largura */
  const q = (w: number): number => Math.round(w * ratio * 100) / 100;
  switch (desenho) {
    case "barra":
      return capa
        ? [d("rect", { x: 0, y: 0, w: 4, h: 100 }, { cor: c.accent }), d("rect", { x: 4, y: 0, w: 0.9, h: 100 }, { cor: c.muted, alpha: 0.55 })]
        : [d("rect", { x: 0, y: 0, w: 1.6, h: 100 }, { cor: c.accent }), d("rect", { x: 6, y: 21.2, w: 9, h: 0.9 }, { cor: c.accent })];
    case "faixa":
      return capa
        ? [d("rect", { x: 0, y: 0, w: 100, h: 4 }, { cor: c.accent }), d("rect", { x: 0, y: 96.5, w: 100, h: 3.5 }, { cor: c.muted, alpha: 0.6 })]
        : [d("rect", { x: 0, y: 0, w: 100, h: 2 }, { cor: c.accent }), d("rect", { x: 6, y: 95, w: 88, h: 0.35 }, { cor: c.muted, alpha: 0.6 })];
    case "cantos":
      return capa
        ? [
            d("rtTriangle", { x: 83, y: 100 - q(17), w: 17, h: q(17) }, { cor: c.accent, flipH: true }),
            d("rtTriangle", { x: 90, y: 100 - q(10), w: 10, h: q(10) }, { cor: c.muted, alpha: 0.75, flipH: true }),
            d("rtTriangle", { x: 0, y: 0, w: 12, h: q(12) }, { cor: c.muted, alpha: 0.5, flipV: true }),
          ]
        : [d("rtTriangle", { x: 94.5, y: 0, w: 5.5, h: q(5.5) }, { cor: c.accent, flipH: true, flipV: true }), d("rtTriangle", { x: 0, y: 100 - q(5), w: 5, h: q(5) }, { cor: c.muted, alpha: 0.6 })];
    case "circulos":
      return capa
        ? [
            d("ellipse", { x: 80, y: 100 - q(24) + q(7), w: 24, h: q(24) }, { cor: c.accent, alpha: 0.9 }),
            d("ellipse", { x: 74, y: 100 - q(8), w: 8, h: q(8) }, { cor: c.muted, alpha: 0.7 }),
            d("ellipse", { x: -6, y: -q(6), w: 18, h: q(18) }, { cor: c.muted, alpha: 0.4 }),
          ]
        : [d("ellipse", { x: 94.5, y: 2, w: 4, h: q(4) }, { cor: c.accent }), d("ellipse", { x: 95.5, y: 10, w: 2, h: q(2) }, { cor: c.muted, alpha: 0.8 })];
    case "moldura":
      return capa
        ? [d("rect", { x: 3, y: 5, w: 94, h: 90 }, { ln: { cor: c.accent, w: 2 } }), d("rect", { x: 4.4, y: 8.5, w: 91.2, h: 83 }, { ln: { cor: c.muted, w: 0.75, alpha: 0.7 } })]
        : [d("rect", { x: 2.5, y: 3.5, w: 95, h: 93 }, { ln: { cor: c.accent, w: 1.5, alpha: 0.7 } })];
    case "blocos":
      return capa
        ? [d("rect", { x: 0, y: 88, w: 100, h: 12 }, { cor: c.accent }), d("rect", { x: 8, y: 84.5, w: 7, h: q(1) }, { cor: c.muted })]
        : [d("rect", { x: 0, y: 94, w: 100, h: 6 }, { cor: c.accent }), d("rect", { x: 0, y: 6, w: 1.2, h: 14 }, { cor: c.accent })];
  }
}

/** A forma é uma decoração de modelo? */
export const ehDecoracaoDeModelo = (s: Shape): boolean => !!s.name?.startsWith(MARCA);

/** O desenho e as cores guardados numa decoração (ou nada, se a lâmina não tem). */
function lerDecoracao(slide: Slide): { desenho: DesenhoId; cores: CoresDesenho } | null {
  const marca = slide.shapes.find(ehDecoracaoDeModelo)?.name;
  if (!marca) return null;
  const [desenho, bg, fg, accent, muted] = marca.slice(MARCA.length).split(":");
  if (!DESENHOS.some((x) => x.id === desenho) || !muted) return null;
  return { desenho: desenho as DesenhoId, cores: { bg, fg, accent, muted } };
}

/** O desenho que a lâmina usa agora (é o que um modelo guardado pelo usuário leva consigo). */
export function desenhoDaLamina(slide: Slide): DesenhoId | undefined {
  return lerDecoracao(slide)?.desenho;
}

/** A lâmina com as decorações trocadas pelas do desenho (as de antes saem; as caixas ficam). */
export function comDesenho(slide: Slide, desenho: DesenhoId, cores: CoresDesenho, ratio = 16 / 9): Slide {
  const resto = slide.shapes.filter((s) => !ehDecoracaoDeModelo(s));
  return { ...slide, shapes: [...decoracoesDe(desenho, slide.layout, cores, ratio), ...resto] };
}

/** A lâmina sem nenhuma decoração de modelo. */
export function semDesenho(slide: Slide): Slide {
  return slide.shapes.some(ehDecoracaoDeModelo) ? { ...slide, shapes: slide.shapes.filter((s) => !ehDecoracaoDeModelo(s)) } : slide;
}

/**
 * Refaz as decorações para o layout atual da lâmina (o desenho e as cores vêm das que já estão
 * nela). Chamado quando o layout muda: a capa e o miolo têm decorações diferentes.
 */
export function refazerDesenho(slide: Slide, ratio = 16 / 9): Slide {
  const atual = lerDecoracao(slide);
  return atual ? comDesenho(slide, atual.desenho, atual.cores, ratio) : slide;
}
