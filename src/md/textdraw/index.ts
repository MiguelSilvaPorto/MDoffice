// Desenho com LETRAS e SÍMBOLOS (grade de caracteres).
// Gera texto puro (┌─┐ │ └┘ ├ ┼ ou ╔═╗ ou +-| ) que entra direto no Markdown,
// ideal para IA: legível, editável e sem arquivos de imagem.
// Peças: model · glyphs · metrics · board · editor
export type { TraceStyle, TextDrawDoc } from "./model";
export { TEXT_DRAW_PLACEHOLDER } from "./model";
export { detectTraceStyle } from "./glyphs";
export { TextBoard } from "./board";
export * from "./editor";
