// Ligação do motor de apresentações com o app (o papel do src/word/host.ts).
import { deckFromMarkdown } from "./markdown";
import { DEFAULT_SETUP } from "./model";
import { openDeckView } from "./view";

/** Apresenta o documento atual (o app chama isto no F5 / menu). */
export function openPresentation(texto: string, titulo = "Apresentação"): void {
  const deck = deckFromMarkdown(texto, DEFAULT_SETUP);
  openDeckView(deck, DEFAULT_SETUP, titulo);
}

/** Resumo para o menu/botão: quantas lâminas o documento tem. */
export function deckSummary(texto: string): string {
  const deck = deckFromMarkdown(texto, DEFAULT_SETUP);
  return `${deck.slides.length} lâmina${deck.slides.length === 1 ? "" : "s"}`;
}
