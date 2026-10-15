// Dados do deck que não são conteúdo: proporção, tema, número, rodapé e fontes.
// (mesmo papel do src/word/model.ts: default + serialize/deserialize)
import { ASPECTS, aspectSize, stageRatio, type Deck, type DeckSetup, type Slide, type SlideLayout } from "./schema";

export const DEFAULT_SETUP: DeckSetup = {
  aspect: "16:9",
  // A apresentação nova nasce CLARA (papel branco). O tema do app (claro/escuro) é da
  // INTERFACE e não decide o papel da lâmina: quem quer lâmina escura escolhe o tema
  // "Escuro" na apresentação (aba Design ▸ Temas), de propósito.
  theme: "claro",
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
  // imagens e fontes embutidas são pesadas e nunca mudam na edição: ficam fora do histórico/log (que guarda uma cópia a cada mudança)
  const { media: _media, fonts: _fonts, fontsRaw: _raw, ...leve } = setup;
  void _media;
  void _fonts;
  void _raw;
  const snap: DeckSnapshot = { v: 1, setup: leve as DeckSetup, slides };
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