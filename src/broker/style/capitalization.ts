// Maiúsculas no começo de frases e parágrafos.

import type { RuleCtx } from "./types";

/** Frase começando com minúscula. */
export function lowercaseAfterPeriod({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // frases começando com minúscula (depois de . ! ?)
  const lowerAfterRx = /([.!?])\s+([a-záàâãéêíóôõúç][\p{L}]*)/gu;
  while ((m = lowerAfterRx.exec(mask)) !== null) {
    const before = mask.slice(Math.max(0, m.index - 4), m.index + 1);
    if (/\b(etc|ex|pág|sr|sra|dr|dra|vs)\.$/i.test(before)) continue;
    const word = m[2];
    const start = m.index + m[1].length + m[0].slice(m[1].length).search(/\S/);
    push(start, start + word.length, "Comece a frase com maiúscula", word[0].toUpperCase() + word.slice(1), [], true);
  }
}

/**
 * Título começando com minúscula.
 *
 * No Markdown o título vem com `#` (1 a 6); no Word ele chega pela lista `titulos` da
 * projeção, sem marcador no texto. Os dois casos entram: o `# titulo` de ontem ficava
 * intacto porque a regra de parágrafo só olhava o começo do texto ou uma linha em branco.
 */
export function headingStartLowercase({ text, mask, push, titulos }: RuleCtx): void {
  const upper = (w: string): string => w[0].toUpperCase() + w.slice(1);
  let m: RegExpExecArray | null;
  // título Markdown: "# titulo", "## objetivo"…
  const md = /(^|\n)[ \t]*#{1,6}[ \t]+(["“'«(]?)([a-záàâãéêíóôõúç][\p{L}]*)/gu;
  while ((m = md.exec(mask)) !== null) {
    const word = m[3];
    const start = m.index + m[0].length - word.length;
    push(start, start + word.length, "Comece o título com maiúscula", upper(word), [], true);
  }
  // título do Word: a linha está na lista, mas o texto projetado não tem o "#"
  if (!titulos?.size) return;
  const linhas = text.split("\n");
  const mascaras = mask.split("\n");
  let offset = 0;
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (titulos.has(i) && !/^[ \t]*#{1,6}[ \t]/.test(linha)) {
      const mm = /^[^\S\n]*(["“'«(]?)([a-záàâãéêíóôõúç][\p{L}]*)/u.exec(mascaras[i] ?? linha);
      if (mm) {
        const word = mm[2];
        const start = offset + mm[0].length - word.length;
        push(start, start + word.length, "Comece o título com maiúscula", upper(word), [], true);
      }
    }
    offset += linha.length + 1;
  }
}

/** Início do texto ou de parágrafo com minúscula. */
export function paragraphStartLowercase({ text, mask, push, titulos }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // início do texto, de um parágrafo (linha em branco) ou da linha logo abaixo de um
  // título Markdown. Sem a terceira alternativa, "# titulo\nquero…" deixava "quero"
  // minúsculo: o título não é uma linha em branco, mas fecha o bloco anterior.
  const paraStartRx = /(^|\n[^\S\n]*\n|(?:^|\n)[ \t]*#{1,6}[^\n]*\n)[^\S\n]*(["“'«(]?)([a-záàâãéêíóôõúç][\p{L}]*)/gu;
  while ((m = paraStartRx.exec(mask)) !== null) {
    const word = m[3];
    const start = m.index + m[0].length - word.length;
    push(start, start + word.length, "Comece o parágrafo com maiúscula", word[0].toUpperCase() + word.slice(1), [], true);
  }
  // Word: o título chega pela lista `titulos`, sem `#`; a linha seguinte pode começar
  // em minúscula sem que exista uma linha em branco entre as duas.
  if (!titulos?.size) return;
  const linhas = text.split("\n");
  const mascaras = mask.split("\n");
  let offset = (linhas[0]?.length ?? 0) + 1; // a linha 0 é o título; o corpo começa depois dela
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (titulos.has(i - 1) && !/^[ \t]*#{1,6}[ \t]/.test(linha)) {
      const mm = /^[^\S\n]*(["“'«(]?)([a-záàâãéêíóôõúç][\p{L}]*)/u.exec(mascaras[i] ?? linha);
      if (mm) {
        const word = mm[2];
        const start = offset + mm[0].length - word.length;
        push(start, start + word.length, "Comece o parágrafo com maiúscula", word[0].toUpperCase() + word.slice(1), [], true);
      }
    }
    offset += linha.length + 1;
  }
}
