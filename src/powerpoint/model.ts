// Dados do deck que não são conteúdo: proporção, tema, número, rodapé e fontes.
// (mesmo papel do src/word/model.ts: default + serialize/deserialize)
import { ASPECTS, aspectSize, stageRatio, type Deck, type DeckSetup, type Slide, type SlideLayout } from "./schema";

export const DEFAULT_SETUP: DeckSetup = {
  aspect: "16:9",
  theme: "escuro",
  showNumber: true,
  footer: "",
  fontFamily: "Segoe UI",
  fontSize: 18,
  bg: "",
};

export interface DeckSnapshot {
  v: 1;
  setup: DeckSetup;
  slides: Slide[];
}

/** Texto (JSON) guardado no rascunho/histórico — mesma ideia do WordSnapshot. */
export function serialize(setup: DeckSetup, slides: Slide[]): string {
  const snap: DeckSnapshot = { v: 1, setup, slides };
  return JSON.stringify(snap);
}

/** Lê o snapshot; devolve null quando não é um deck válido. */
export function deserialize(texto: string): DeckSnapshot | null {
  try {
    const snap = JSON.parse(texto) as DeckSnapshot;
    if (!snap || !Array.isArray(snap.slides)) return null;
    return {
      v: 1,
      setup: { ...DEFAULT_SETUP, ...snap.setup },
      slides: snap.slides.map((s) => ({ ...s, notes: s.notes ?? "", shapes: s.shapes ?? [] })),
    };
  } catch {
    return null;
  }
}

export function slideCount(deck: Deck): number {
  return deck.slides.length;
}

/** Resumo curto para o menu/botão (ex.: "12 lâminas · 16:9"). */
export function resumo(deck: Deck, setup: DeckSetup): string {
  const n = deck.slides.length;
  return `${n} lâmina${n === 1 ? "" : "s"} · ${setup.aspect}`;
}

/** Cria uma lâmina nova com o layout pedido. */
export function newSlide(layout: SlideLayout = "conteudo"): Slide {
  return { md: "", layout, notes: "", shapes: [] };
}

export const SETUP_PADRAO = DEFAULT_SETUP;
export { aspectSize, stageRatio, ASPECTS };
export type { Deck, DeckSetup, Slide, SlideLayout };