// Concordância de número entre artigo e substantivo.
//
// Responsabilidade: encontrar artigo no plural seguido de palavra no singular
// ("Os documento", "As reunião") e propor a forma no plural.
//
// Por que precisa do dicionário: só ele sabe se a forma proposta é palavra real.
// É o que separa "documentos" (existe → sugere) de "ques" (não existe → silencia),
// e evita transformar pronome ou conjunção em substantivo inventado.
//
// Só entram as terminações em que o plural é INEQUÍVOCO. Ficam de fora, de
// propósito, as que admitem mais de uma forma (terminadas em -s, -l, -ão, -ãe):
// nelas a proposta seria um palpite, e um palpite errado é pior que nenhum.

import type { WritingIssue } from "./types";

/** Artigo no plural → o substantivo que vem depois também vai para o plural. */
const ARTIGO_PLURAL = /(?<![\p{L}])(os|as|uns|umas)(\s+)([\p{L}][\p{L}'-]*)/giu;

/**
 * Plural regular de uma palavra, ou null quando a terminação não é inequívoca.
 * Cobre os três casos em que a língua não dá margem: vogal (+s), r/z (+es) e m (→ns).
 */
export function pluralRegular(palavra: string): string | null {
  const p = palavra;
  if (p.length < 3) return null;
  const ultima = p[p.length - 1].toLowerCase();
  const semAcento = ultima.normalize("NFD").replace(/\p{M}/gu, "");
  if ("aeiou".includes(semAcento)) return `${p}s`;
  if (ultima === "r" || ultima === "z") return `${p}es`;
  if (ultima === "m") return `${p.slice(0, -1)}ns`;
  return null;
}

/** Mantém a caixa da palavra original na forma proposta. */
function manterCaixa(original: string, proposta: string): string {
  const maiuscula = original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase();
  return maiuscula ? proposta[0].toUpperCase() + proposta.slice(1) : proposta;
}

/**
 * Avisos de concordância de número.
 *
 * `validar` recebe as formas propostas e devolve as que NÃO são palavras do
 * idioma — assim a regra nunca inventa palavra.
 */
export async function concordanciaDeNumero(
  texto: string,
  validar: (palavras: string[]) => Promise<Set<string>>
): Promise<WritingIssue[]> {
  const candidatos: { from: number; to: number; palavra: string; proposta: string }[] = [];
  let m: RegExpExecArray | null;
  ARTIGO_PLURAL.lastIndex = 0;
  while ((m = ARTIGO_PLURAL.exec(texto)) !== null) {
    const palavra = m[3];
    const proposta = pluralRegular(palavra);
    if (!proposta) continue;
    // o artigo já está no plural; a palavra é que precisa acompanhar
    const from = m.index + m[1].length + m[2].length;
    candidatos.push({ from, to: from + palavra.length, palavra, proposta: manterCaixa(palavra, proposta) });
  }
  if (!candidatos.length) return [];

  const invalidas = await validar(candidatos.map((c) => c.proposta));
  const issues: WritingIssue[] = [];
  for (const c of candidatos) {
    if (invalidas.has(c.proposta)) continue; // a forma proposta não existe: melhor calar
    issues.push({
      from: c.from,
      to: c.to,
      word: c.palavra,
      kind: "style",
      message: `O artigo está no plural, então “${c.palavra}” fica “${c.proposta}”`,
      suggestions: [c.proposta],
      fix: c.proposta,
    });
  }
  return issues;
}
