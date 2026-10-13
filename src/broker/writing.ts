// Assistente de escrita em português (100% offline). Este arquivo só reúne as peças:
//   types · tone · mask · spell (dicionário) · neighbor ("você quis dizer…")
//   style/ (regras de estilo) · data/ (listas) · stats · check
export type { WritingIssue, WritingStats } from "./types";
export { setTone, getTone, type Tone } from "./tone";
export { SYNONYMS, synonymsFor } from "./data/synonyms";
export { warmUpSpell, spellIsReady, spellHasFailed, onSpellReady } from "./spell";
export { checkStyle } from "./style";
export { planejarVarredura, type CorrecaoAuto, type CtxVarredura } from "./autofix";
export { ritmoDePausa, marcarAplicacao, observarEdicao, temPendenteRitmo, limparRitmo, resumoRitmo } from "./personal/autofmt";
export { stats } from "./stats";
export { checkText } from "./check";
