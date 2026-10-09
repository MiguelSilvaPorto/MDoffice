// Modelo de dados do motor de APRESENTAÇÕES (PowerPoint) do mdCreator.
// Espelha o motor do Word (src/word): schema → model → markdown → view → host.
// Só tipos e constantes: nenhum DOM, nenhum I/O, nenhuma dependência externa.

/** Proporção da lâmina. */
export type DeckAspect = "16:9" | "4:3";

/** Papel da lâmina (muda o alinhamento/estilo base). */
export type SlideLayout = "titulo" | "secao" | "conteudo" | "vazio";

/** Tema visual aplicado ao deck (fundo, acento, fontes). */
export type ThemeId = "claro" | "escuro" | "contraste";

/**
 * Uma lâmina. O conteúdo fica em Markdown (`md`) — é o que o app já sabe editar,
 * corrigir, exportar e mandar para a IA — e as notas do apresentador ficam em `notes`.
 */
export interface Slide {
  md: string;
  layout: SlideLayout;
  /** anotações do apresentador (não aparecem na lâmina) */
  notes: string;
  /**
   * Formas posicionadas sobre a lâmina (caixas de texto, imagens, tabelas).
   * Quando `shapes` tem itens, o palco mostra as formas; o `md` é o texto-fonte
   * usado para o .pptx e para a IA. Vazio = lâmina só com `md` (modo simples).
   */
  shapes: Shape[];
}

/** O deck inteiro. */
export interface Deck {
  titulo: string;
  slides: Slide[];
}

/** Metadados que acompanham o deck (não são conteúdo). */
export interface DeckSetup {
  aspect: DeckAspect;
  /** tema embutido: fundo e cor do texto */
  theme: ThemeId;
  /** mostra o número da lâmina no canto */
  showNumber: boolean;
  /** rodapé fixo (ex.: nome da empresa) */
  footer: string;
  /** fonte padrão do texto da lâmina */
  fontFamily: string;
  /** tamanho base do texto (pt) */
  fontSize: number;
  /** cor de fundo da lâmina (hex, sem #). Vazio = usa o tema. */
  bg: string;
}

// ---------------------------------------------------------------------------
// Formas
// ---------------------------------------------------------------------------

/** O que uma forma pode ser. */
export type ShapeKind = "texto" | "imagem" | "forma";

/** Geometria de uma forma dentro da lâmina. Unidades em % da lâmina (0-100),
 *  para o mesmo objeto servir na tela e na exportação em polegadas. */
export interface ShapeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Alinhamento do parágrafo dentro da forma. */
export type TextAlign = "esquerda" | "centro" | "direita" | "justificado";

/** Uma forma posicionada na lâmina. */
export interface Shape {
  id: string;
  kind: ShapeKind;
  box: ShapeBox;
  /** texto interno (para kind "texto" e "forma") */
  text: string;
  /** fonte, tamanho e cor do texto (hex sem #) */
  fontFamily: string;
  fontSize: number;
  color: string;
  /** negrito / itálico do texto interno */
  bold: boolean;
  italic: boolean;
  align: TextAlign;
  /** cor de preenchimento da forma (kind "forma"); vazio = sem preenchimento */
  fill: string;
  /** para kind "imagem": data URL ou caminho em assets/ */
  src: string;
  /** rotação em graus. */
  rot: number;
}

// ---------------------------------------------------------------------------
// Temas e proporções
// ---------------------------------------------------------------------------

export const ASPECTS: { id: DeckAspect; title: string; w: number; h: number }[] = [
  { id: "16:9", title: "16:9 (tela cheia)", w: 16, h: 9 },
  { id: "4:3", title: "4:3 (projetor antigo)", w: 4, h: 3 },
];

/** Cores de cada tema (hex sem #, como o .pptx espera). */
export const THEME_COLORS: Record<ThemeId, { bg: string; fg: string; accent: string; muted: string }> = {
  claro: { bg: "FFFFFF", fg: "1C212B", accent: "4F46E5", muted: "6B7280" },
  escuro: { bg: "0E1014", fg: "F4F5F8", accent: "818CF8", muted: "9AA1AE" },
  contraste: { bg: "000000", fg: "FFFFFF", accent: "FFD400", muted: "E5E7EB" },
};

/** Exportado para o .pptx (largura/altura em polegadas). */
export function aspectSize(setup: DeckSetup): { w: number; h: number } {
  const a = ASPECTS.find((x) => x.id === setup.aspect) ?? ASPECTS[0];
  // 13,333 x 7,5 pol é o padrão do PowerPoint para 16:9
  return setup.aspect === "16:9" ? { w: 13.333, h: 7.5 } : { w: 10, h: 7.5 * (a.h / 4) };
}

/** Proporção largura/altura da lâmina (usada pelo palco). */
export function stageRatio(setup: DeckSetup): number {
  const a = ASPECTS.find((x) => x.id === setup.aspect) ?? ASPECTS[0];
  return a.w / a.h;
}

/** Lâmina vazia com o layout padrão. */
export function emptySlide(layout: SlideLayout = "conteudo"): Slide {
  return { md: "", layout, notes: "", shapes: [] };
}