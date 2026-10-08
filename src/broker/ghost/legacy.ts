// Previsão simples, só com as listas curtas embutidas (ngrams.ts) e as palavras do documento.
// É o plano B: usado quando o modelo de idioma (model.ts) ainda não carregou ou não existe.

import { PALAVRAS_LISTA } from "../palavras";
import { type GhostSuggestion } from "./types";
import { CURATED_TRIGRAMS, CURATED_BIGRAMS } from "./ngrams";
import { DocumentIndex } from "./documentIndex";

/** Previsão com a base pequena embutida (usada enquanto o modelo de idioma não carrega). */
export function predictLegacy(
  before: string,
  after: string,
  pos: number,
  index: DocumentIndex
): GhostSuggestion | null {

  // Se o cursor estiver no meio de caracteres alfanuméricos (ex: pa|lavra), não atrapalha
  if (/^[a-zA-ZÀ-ÿ0-9_-]/u.test(after)) {
    return null;
  }

  // Linha em branco ou apenas espaços: nada para prever
  if (before.trim() === "") {
    return null;
  }

  // Não sugerir em linhas de cerca de código markdown (```)
  if (before.trim().startsWith("```")) {
    return null;
  }

  // --- Caso 1: Usuário está digitando letras no final (prefixo de palavra) ---
  const prefixMatch = /([a-zA-ZÀ-ÿ0-9_-]+)$/.exec(before);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    if (prefix.length < 2) return null;

    const textBeforePrefix = before.slice(0, -prefix.length);
    const wordsBefore = textBeforePrefix.trim().split(/\s+/);
    const prevWord = wordsBefore.length > 0 ? wordsBefore[wordsBefore.length - 1] : "";

    let candidate: string | null = null;

    // 1. Tenta achar bigrama no documento onde a palavra anterior se conecta com este prefixo
    if (prevWord) {
      candidate = index.getBestBigram(prevWord, prefix);
    }

    // 2. Tenta nos bigramas curados de português
    if (!candidate && prevWord) {
      const curList = CURATED_BIGRAMS[prevWord.toLowerCase()];
      if (curList) {
        const found = curList.find((w) => w.toLowerCase().startsWith(prefix.toLowerCase()));
        if (found) candidate = found;
      }
    }

    // 3. Tenta palavras mais usadas do próprio documento atual
    if (!candidate) {
      candidate = index.getWordByPrefix(prefix);
    }

    // 4. Tenta nas palavras mais frequentes da língua portuguesa
    if (!candidate) {
      const pNorm = prefix.toLowerCase();
      for (const w of PALAVRAS_LISTA) {
        if (w.toLowerCase().startsWith(pNorm) && w.length > pNorm.length) {
          candidate = w;
          break;
        }
      }
    }

    if (candidate && candidate.toLowerCase().startsWith(prefix.toLowerCase())) {
      let suffix = candidate.slice(prefix.length);
      if (prefix[0] === prefix[0].toUpperCase() && suffix.length > 0) {
        if (prefix === prefix.toUpperCase()) {
          suffix = suffix.toUpperCase();
        }
      }
      if (suffix.length > 0) {
        return { text: suffix, pos };
      }
    }

    return null;
  }

  // --- Caso 2: Usuário terminou uma palavra e deu espaço (prever próxima palavra) ---
  const spaceMatch = /\s+$/.exec(before);
  if (spaceMatch) {
    const trimmed = before.trim();
    if (!trimmed) return null;

    const words = trimmed.split(/[\s,;:!?—\-]+/);
    const lastWord = words[words.length - 1];
    const secondLastWord = words.length > 1 ? words[words.length - 2] : "";

    let nextWords: string | null = null;

    // 1. Trigrama no documento atual
    if (secondLastWord && lastWord) {
      nextWords = index.getBestTrigram(secondLastWord, lastWord);
    }

    // 2. Trigrama curado da língua portuguesa
    if (!nextWords && secondLastWord && lastWord) {
      const key = `${secondLastWord.toLowerCase()} ${lastWord.toLowerCase()}`;
      const list = CURATED_TRIGRAMS[key];
      if (list && list.length > 0) {
        nextWords = list[0];
      }
    }

    // 3. Bigrama no documento atual
    if (!nextWords && lastWord) {
      nextWords = index.getBestBigram(lastWord);
    }

    // 4. Bigrama curado da língua portuguesa
    if (!nextWords && lastWord) {
      const list = CURATED_BIGRAMS[lastWord.toLowerCase()];
      if (list && list.length > 0) {
        nextWords = list[0];
      }
    }

    if (nextWords && nextWords.trim().length > 0) {
      if (nextWords.toLowerCase() === lastWord.toLowerCase()) return null;
      if (after.trim().startsWith(nextWords)) return null;

      return { text: nextWords, pos };
    }
  }

  return null;
}
