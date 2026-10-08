// Indexador do documento: aprende, em tempo real e só no seu computador, as palavras que você usa.

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

    const rx = /[a-zA-ZÀ-ÿ0-9_-]+/g;
    let match: RegExpExecArray | null;
    const tokens: string[] = [];

    while ((match = rx.exec(text)) !== null) {
      tokens.push(match[0]);
    }

    for (let i = 0; i < tokens.length; i++) {
      const orig = tokens[i];
      const norm = orig.toLowerCase();

      this.wordFreq.set(norm, (this.wordFreq.get(norm) ?? 0) + 1);
      if (!this.originalCase.has(norm)) {
        this.originalCase.set(norm, orig);
      }

      // Bigrama
      if (i > 0) {
        const prev = tokens[i - 1].toLowerCase();
        let bMap = this.bigrams.get(prev);
        if (!bMap) {
          bMap = new Map();
          this.bigrams.set(prev, bMap);
        }
        bMap.set(orig, (bMap.get(orig) ?? 0) + 1);
      }

      // Trigrama
      if (i > 1) {
        const p1 = tokens[i - 2].toLowerCase();
        const p2 = tokens[i - 1].toLowerCase();
        const key = `${p1} ${p2}`;
        let tMap = this.trigrams.get(key);
        if (!tMap) {
          tMap = new Map();
          this.trigrams.set(key, tMap);
        }
        tMap.set(orig, (tMap.get(orig) ?? 0) + 1);
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
