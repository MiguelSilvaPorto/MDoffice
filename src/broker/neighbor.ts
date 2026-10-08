// "Você quis dizer…?": palavra que existe mas está a uma letra de uma palavra muito comum.

import { COMMON_WORDS } from "./data/commonWords";
import { FREQUENTES, FREQUENTES_EXATAS } from "./palavras";

/** Procura uma palavra muito comum a uma letra de distância (ex.: maneria → maneira). */
export function commonNeighbor(word: string): string | null {
  const lower = word.toLowerCase();
  const normWord = lower.normalize("NFD").replace(/\p{M}/gu, "");
  // Se a palavra já é comum (com ou sem acento), não tem nada de errado: não sugere troca!
  if (
    lower.length < 5 ||
    FREQUENTES_EXATAS.has(lower) ||
    FREQUENTES.has(normWord) ||
    COMMON_WORDS.has(lower)
  ) {
    return null;
  }
  const letters = "abcdefghijklmnopqrstuvwxyzáâãàéêíóôõúüç";
  const variants = new Set<string>();
  // troca de duas letras de lugar (o caso "maneria" → "maneira")
  for (let i = 0; i < lower.length - 1; i++) {
    variants.add(lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2));
  }
  // trocas de uma letra (ignorando o final: é onde as conjugações diferem)
  for (let i = 0; i < lower.length - 1; i++) {
    for (const c of letters) {
      const replaced = lower.slice(0, i) + c + lower.slice(i + 1);
      if (replaced !== lower) variants.add(replaced);
    }
  }
  for (const candidate of variants) {
    // A sugestão precisa ser uma palavra real e comum com sua grafia correta
    if (FREQUENTES_EXATAS.has(candidate) || COMMON_WORDS.has(candidate)) {
      // Nunca sugerir trocar apenas por versão sem acento de uma palavra já existente
      if (candidate.normalize("NFD").replace(/\p{M}/gu, "") === normWord) continue;
      return candidate;
    }
  }
  return null;
}
