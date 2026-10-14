// Limpeza: pontuação duplicada e frases coladas sem o separador.
// São correções "de varredura": não entram enquanto se digita (safe=false), mas entram na pausa,
// ao terminar o parágrafo e ao salvar.

import type { RuleCtx } from "./types";

/**
 * Pontos e vírgulas duplicados: “..”, “. .”, “,,”, “, ,”. Reticências são “...” (três pontos) —
 * o quarto ponto é excesso.
 */
export function duplicatedPunct({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // “....” (exatamente quatro pontos): reticências são TRÊS pontos — o quarto é excesso.
  // Fica de fora o que é separador/linha pontilhada (“.....”, “..........”), que é longo
  // de propósito. As guardas de dígito são as mesmas do “..”: não encostam em número (“3.14”).
  const quatroPontos = /(?<![\d.])\.{4}(?![\d.])/gu;
  while ((m = quatroPontos.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, "Reticências são três pontos — fica só “...”", "...", [], false);
  }
  // “..” (dois pontos seguidos; “...” fica: é reticência de verdade)
  const doisPontos = /(?<![\d.])\.\.(?![\d.])/gu;
  while ((m = doisPontos.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, "Dois pontos seguidos — fica um só", ".", [], false);
  }
  // “. .” (pontos separados por espaço)
  const pontosSeparados = /(?<![\d.])\.(?:[^\S\n]+)\.(?![\d.])/gu;
  while ((m = pontosSeparados.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, "Pontos separados por espaço — fica um só", ".", [], false);
  }
  // “,,”
  const duasVirgulas = /,{2,}/g;
  while ((m = duasVirgulas.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, "Vírgulas repetidas — fica uma só", ",", [], false);
  }
  // “, ,”
  const virgulasSeparadas = /,(?:[^\S\n]+),(?!,)/gu;
  while ((m = virgulasSeparadas.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, "Vírgulas repetidas — fica uma só", ",", [], false);
  }
}

/**
 * Palavras que, em maiúscula depois de uma minúscula, quase sempre abrem frase nova
 * (artigos, pronomes, demonstrativos e conectivos comuns) — nomes próprios não entram.
 */
const INICIOS_DE_FRASE = [
  "O", "A", "Os", "As", "Um", "Uma", "Uns", "Umas",
  "Isso", "Isto", "Aquilo", "Este", "Esta", "Estes", "Estas", "Esse", "Essa", "Esses", "Essas", "Aquele", "Aquela", "Aqueles", "Aquelas",
  "Ele", "Ela", "Eles", "Elas", "Nós", "Você", "Vocês",
  "Então", "Depois", "Agora", "Também", "Porém", "Entretanto", "Contudo", "Todavia", "Portanto", "Assim", "Além", "Enquanto", "Quando", "Porque", "Mas",
];

/**
 * Frase nova começando sem o ponto: “terminou O prazo…” → “terminou. O prazo…”.
 * Só entra quando a palavra seguinte é minúscula (se for maiúscula, pode ser nome próprio — não arrisca).
 */
export function frasesColadas({ text, mask, push }: RuleCtx): void {
  const rx = new RegExp(`(?<=[\\p{Ll}\\d])([^\\S\\n]+)(${INICIOS_DE_FRASE.join("|")})(?=[^\\S\\n]+[\\p{Ll}\\d])`, "gu");
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    const wsStart = m.index; // o lookbehind não entra no match: aqui começa o espaço
    const wsEnd = wsStart + m[1].length;
    const letra = text.slice(wsStart - 1, wsStart); // última letra da palavra anterior
    push(wsStart - 1, wsEnd, `Parece que começa uma frase nova: falta o ponto antes de “${m[2]}”`, `${letra}. `, [], false);
  }
}
