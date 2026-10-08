// Modelo de dados do motor de APRESENTAÇÕES (PowerPoint) do mdOffice.
// Espelha o motor do Word (src/word): schema → model → markdown → view → host.

/** Proporção da lâmina. */
export type DeckAspect = "16:9" | "4:3";

/** Papel da lâmina (muda o alinhamento/estilo base). */
export type SlideLayout = "titulo" | "secao" | "conteudo" | "vazio";

/**
 * Uma lâmina. O conteúdo fica em Markdown (`md`) — é o que o app já sabe editar,
 * corrigir, exportar e mandar para a IA — e as notas do apresentador ficam em `notes`.
 */
export interface Slide {
  md: string;
  layout: SlideLayout;
  /** anotações do apresentador (não aparecem na lâmina) */
  notes: string;
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
  theme: "escuro" | "claro";
  /** mostra o número da lâmina no canto */
  showNumber: boolean;
  /** rodapé fixo (ex.: nome da empresa) */
  footer: string;
}

export const ASPECTS: { id: DeckAspect; title: string; w: number; h: number }[] = [
  { id: "16:9", title: "16:9 (tela cheia)", w: 16, h: 9 },
  { id: "4:3", title: "4:3 (projetor antigo)", w: 4, h: 3 },
];

/** Exportado para o .pptx depois (largura/altura em polegadas). */
export function aspectSize(setup: DeckSetup): { w: number; h: number } {
  const a = ASPECTS.find((x) => x.id === setup.aspect) ?? ASPECTS[0];
  // 13,333 x 7,5 pol é o padrão do PowerPoint para 16:9
  return setup.aspect === "16:9" ? { w: 13.333, h: 7.5 } : { w: 10, h: 7.5 * (a.h / 4) };
}
