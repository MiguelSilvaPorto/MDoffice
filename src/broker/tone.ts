// Tom do texto (formal, neutro, informal): decide quais avisos de registro aparecem.

/**
 * Tom do texto: "formal" aponta toda linguagem informal; "neutro" só os casos claros (sem “a gente”
 * e sem sugestões de estilo); "informal" não mexe no registro (só ortografia e pontuação).
 */
export type Tone = "formal" | "neutro" | "informal";
let tone: Tone = "formal";
export function setTone(t: Tone): void {
  tone = t;
}
export function getTone(): Tone {
  return tone;
}
