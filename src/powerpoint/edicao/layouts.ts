// Layouts de lâmina nova: Capa, Seção, Título e conteúdo, Duas colunas, Somente título e Em branco. Cada um cria as
// caixas de texto prontas (com a dica "Clique para adicionar...") já com a fonte e as cores do deck.
import { uid } from "../../util";
import type { Para, Shape, ShapeBox, Slide, SlideLayout } from "../schema";
import { novaCaixaDeTexto, type EstiloDeck } from "./criar";
import { paraVazio } from "./texto";

export const ROTULOS_LAYOUT: Record<SlideLayout, string> = {
  titulo: "Capa",
  secao: "Cabeçalho da seção",
  conteudo: "Título e conteúdo",
  duas: "Duas colunas",
  soTitulo: "Somente o título",
  vazio: "Em branco",
};

export const ORDEM_LAYOUTS: SlideLayout[] = ["titulo", "conteudo", "duas", "secao", "soTitulo", "vazio"];

export interface Caixa {
  box: ShapeBox;
  dica: string;
  tamanho: number;
  negrito?: boolean;
  align?: "esquerda" | "centro";
  /** usa a cor mais apagada do deck */
  suave?: boolean;
  marcadores?: boolean;
  anchor?: "t" | "ctr" | "b";
}

function caixas(layout: SlideLayout): Caixa[] {
  switch (layout) {
    case "titulo":
      return [
        { box: { x: 8, y: 28, w: 84, h: 24 }, dica: "Clique para adicionar o título", tamanho: 48, negrito: true, align: "centro", anchor: "b" },
        { box: { x: 8, y: 55, w: 84, h: 14 }, dica: "Clique para adicionar o subtítulo", tamanho: 24, align: "centro", suave: true, anchor: "t" },
      ];
    case "secao":
      return [
        { box: { x: 8, y: 34, w: 84, h: 18 }, dica: "Clique para adicionar o título da seção", tamanho: 40, negrito: true, anchor: "b" },
        { box: { x: 8, y: 54, w: 84, h: 12 }, dica: "Clique para adicionar o texto", tamanho: 20, suave: true, anchor: "t" },
      ];
    case "conteudo":
      return [
        { box: { x: 6, y: 6, w: 88, h: 14 }, dica: "Clique para adicionar o título", tamanho: 34, negrito: true, anchor: "ctr" },
        { box: { x: 6, y: 24, w: 88, h: 66 }, dica: "Clique para adicionar o texto", tamanho: 22, marcadores: true, anchor: "t" },
      ];
    case "duas":
      return [
        { box: { x: 6, y: 6, w: 88, h: 14 }, dica: "Clique para adicionar o título", tamanho: 34, negrito: true, anchor: "ctr" },
        { box: { x: 6, y: 24, w: 43, h: 66 }, dica: "Clique para adicionar o texto", tamanho: 20, marcadores: true, anchor: "t" },
        { box: { x: 51, y: 24, w: 43, h: 66 }, dica: "Clique para adicionar o texto", tamanho: 20, marcadores: true, anchor: "t" },
      ];
    case "soTitulo":
      return [{ box: { x: 6, y: 6, w: 88, h: 14 }, dica: "Clique para adicionar o título", tamanho: 34, negrito: true, anchor: "ctr" }];
    default:
      return [];
  }
}

/** Os espaços de um layout (posição, tamanho e estilo). É o MESMO dado da lâmina nova — a
 *  miniatura da galeria sai daqui, então mudou um layout a miniatura acompanha. */
export function caixasDoLayout(layout: SlideLayout): Caixa[] {
  return caixas(layout);
}

function paraDoLayout(c: Caixa, est: EstiloDeck): Para {
  const p = paraVazio({ size: c.tamanho }, c.align ?? "esquerda");
  if (c.marcadores) {
    p.bullet = { char: "•" };
    p.marL = Math.round(c.tamanho * 1.1);
    p.indent = -Math.round(c.tamanho * 1.1);
  }
  void est;
  return p;
}

/** Caixas de texto de um layout, prontas para entrar numa lâmina. */
export function formasDoLayout(layout: SlideLayout, est: EstiloDeck): Shape[] {
  return caixas(layout).map((c) => {
    const s = novaCaixaDeTexto(c.box, est);
    s.name = c.dica.replace("Clique para adicionar ", "").replace(/^o |^a /, "");
    s.fontSize = c.tamanho;
    s.bold = !!c.negrito;
    s.color = c.suave ? "6B7280" : est.corTexto;
    s.paras = [paraDoLayout(c, est)];
    s.anchor = c.anchor ?? "t";
    s.align = c.align ?? "esquerda";
    s.dica = c.dica;
    return s;
  });
}

/**
 * Lâmina nova com o layout pedido. `modelo` é a lâmina de onde se herda o fundo e as decorações fixas (as que vieram do
 * layout/mestre de um .pptx): assim a lâmina nova combina com as outras do deck.
 */
export function novaLamina(layout: SlideLayout, est: EstiloDeck, modelo?: Slide): Slide {
  const fixas = (modelo?.shapes ?? []).filter((f) => f.fixa).map((f) => ({ ...JSON.parse(JSON.stringify(f)), id: uid() }) as Shape);
  const s: Slide = { md: "", layout, notes: "", shapes: [...fixas, ...formasDoLayout(layout, est)] };
  if (modelo?.bg) s.bg = modelo.bg;
  return s;
}
