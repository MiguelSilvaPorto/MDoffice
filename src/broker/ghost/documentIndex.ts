// Indexador do documento: aprende, em tempo real e só no seu computador, as palavras que você usa.

/** Contexto do começo de uma frase. */
export const SENTENCE_START = "<s>";

function add(m: Map<string, Map<string, number>>, key: string, word: string): void {
  let inner = m.get(key);
  if (!inner) m.set(key, (inner = new Map()));
  inner.set(word, (inner.get(word) ?? 0) + 1);
}

export class DocumentIndex {
  /** Mapa de frequência de palavras no documento: normalizado -> contagem */
  readonly wordFreq = new Map<string, number>();
  /** Grafia original da palavra encontrada (preserva CamelCase e acentos) */
  readonly originalCase = new Map<string, string>();
  /** Bigramas do documento: palavra1 -> { palavra2: contagem } */
  readonly bigrams = new Map<string, Map<string, number>>();
  /** Trigramas do documento: "palavra1 palavra2" -> { palavra3: contagem } */
  readonly trigrams = new Map<string, Map<string, number>>();

  update(text: string): void {
    this.wordFreq.clear();
    this.originalCase.clear();
    this.bigrams.clear();
    this.trigrams.clear();

    // frase por frase: o começo da frase vira o contexto "<s>" (assim o índice aprende como a pessoa ABRE as frases)
    // e nada atravessa o ponto final. As vírgulas contam como parte do contexto, como no modelo do idioma.
    const wordRx = /[A-Za-zÀ-ÿ]+(?:-[A-Za-zÀ-ÿ]+)*|\d+(?:[.,]\d+)*|,/g;
    for (const sentence of text.split(/[.!?;:()…]+(?:\s+|$)|\n+/)) {
      const raw = sentence.match(wordRx);
      if (!raw) continue;
      let p1 = "";
      let p2 = SENTENCE_START;
      for (const w of raw) {
        const isWord = !/^[\d,]/.test(w);
        const norm = w === "," ? "," : /^\d/.test(w) ? "#" : w.toLowerCase();
        if (isWord) {
          this.wordFreq.set(norm, (this.wordFreq.get(norm) ?? 0) + 1);
          if (!this.originalCase.has(norm)) this.originalCase.set(norm, w);
          add(this.bigrams, p2, w);
          if (p1) add(this.trigrams, p1 + " " + p2, w);
        }
        p1 = p2;
        p2 = norm;
      }
    }
  }

  getBestTrigram(p1: string, p2: string): string | null {
    const key = `${p1.toLowerCase()} ${p2.toLowerCase()}`;
    const map = this.trigrams.get(key);
    if (!map || map.size === 0) return null;
    let bestWord: string | null = null;
    let max = -1;
    for (const [w, count] of map.entries()) {
      if (count > max) {
        max = count;
        bestWord = w;
      }
    }
    return bestWord;
  }

  getBestBigram(p: string, prefixFilter = ""): string | null {
    const map = this.bigrams.get(p.toLowerCase());
    if (!map || map.size === 0) return null;
    let bestWord: string | null = null;
    let max = -1;
    const filterNorm = prefixFilter.toLowerCase();
    for (const [w, count] of map.entries()) {
      if (filterNorm && !w.toLowerCase().startsWith(filterNorm)) continue;
      if (count > max) {
        max = count;
        bestWord = w;
      }
    }
    return bestWord;
  }

  getWordByPrefix(prefix: string): string | null {
    const norm = prefix.toLowerCase();
    let bestWord: string | null = null;
    let max = -1;
    for (const [w, count] of this.wordFreq.entries()) {
      if (w.startsWith(norm) && w.length > norm.length) {
        if (count > max) {
          max = count;
          bestWord = this.originalCase.get(w) ?? w;
        }
      }
    }
    return bestWord;
  }
}
