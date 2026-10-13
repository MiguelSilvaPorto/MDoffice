// "Você quis dizer…?": palavra que existe mas está a uma letra de uma palavra muito comum.
//
// A troca só vale quando a palavra escrita é RARA e a candidata é COMUM. Sem essa
// medida, o aviso dispara para palavra perfeitamente normal: "lento" (129
// ocorrências em texto real) era "corrigido" para "tento" (79) só porque "tento"
// estava numa lista de palavras frequentes e "lento" não.

import { COMMON_WORDS } from "./data/commonWords";
import { FREQUENTES, FREQUENTES_EXATAS } from "./palavras";

/** A partir de quantas ocorrências a palavra é considerada de uso real. */
const USO_REAL = 20;

/** Quantas vezes a candidata precisa ser mais frequente que a original. */
const VANTAGEM = 20;

/** Piso de frequência da candidata, para não trocar raridade por raridade. */
const PISO_CANDIDATA = 50;

/**
 * Procura uma palavra muito comum a uma edição de distância (ex.: maneria → maneira).
 * `contagem` diz quantas vezes uma palavra aparece em texto real; sem essa medida
 * (contagem sempre 0) a função prefere não opinar.
 */
export function commonNeighbor(word: string, contagem: (w: string) => number): string | null {
  const lower = word.toLowerCase();
  const normWord = lower.normalize("NFD").replace(/\p{M}/gu, "");
  if (lower.length < 5) return null;

  // A palavra escrita tem uso real? Então não é erro de digitação de outra.
  const frequenciaOriginal = contagem(lower);
  if (frequenciaOriginal >= USO_REAL) return null;
  // Já é palavra comum nas listas: mesma conclusão, por outro caminho.
  if (FREQUENTES_EXATAS.has(lower) || FREQUENTES.has(normWord) || COMMON_WORDS.has(lower)) return null;

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
    if (!FREQUENTES_EXATAS.has(candidate) && !COMMON_WORDS.has(candidate)) continue;
    // Nunca sugerir trocar apenas por versão sem acento de uma palavra já existente
    if (candidate.normalize("NFD").replace(/\p{M}/gu, "") === normWord) continue;
    // E precisa ser de fato muito mais usada que a original
    const frequenciaCandidata = contagem(candidate);
    if (frequenciaCandidata < PISO_CANDIDATA) continue;
    if (frequenciaCandidata < VANTAGEM * Math.max(frequenciaOriginal, 1)) continue;
    return candidate;
  }
  return null;
}
