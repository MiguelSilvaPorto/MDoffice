// Assistência de escrita e previsão de palavras inline (estilo Copilot / Ghost Text).
// 100% offline e local. As peças ficam em ghost/: types · ngrams · documentIndex · predict · field · extension.
export type { GhostSuggestion } from "./ghost/types";
export { DocumentIndex } from "./ghost/documentIndex";
export { predictCompletion } from "./ghost/predict";
export { setGhostEffect, ghostTextField, acceptGhostText, acceptGhostWord, clearGhostText, ghostTextKeymap } from "./ghost/field";
export { createGhostTextExtension, type GhostOptions } from "./ghost/extension";
