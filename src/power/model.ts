// Dados do deck que não são conteúdo: proporção, tema, número e rodapé.
// (mesmo papel do src/word/model.ts: default + serialize/deserialize)
import { ASPECTS, aspectSize, type Deck, type DeckSetup, type Slide, type SlideLayout } from "./schema";

export const DEFAULT_SETUP: DeckSetup = {
  aspect: "16:9",
  theme: "escuro",
  showNumber: true,
  footer: "",
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
    return { v: 1, setup: { ...DEFAULT_SETUP, ...snap.setup }, slides: snap.slides };
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

/** Posição de leitura da lâmina no palco (16:9 etc.), em % — usada pela view. */
export function stageRatio(setup: DeckSetup): number {
  const a = ASPECTS.find((x) => x.id === setup.aspect) ?? ASPECTS[0];
  return a.w / a.h;
}

export const SETUP_PADRAO = DEFAULT_SETUP;
export { aspectSize };
export type { Deck, DeckSetup, Slide, SlideLayout };
