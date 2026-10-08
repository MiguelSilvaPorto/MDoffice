// Tipos mínimos para o typo-js (a biblioteca não traz .d.ts).
declare module "typo-js" {
  export default class Typo {
    constructor(lang: string, affData: string, wordsData: string, options?: Record<string, unknown>);
    check(word: string): boolean;
    suggest(word: string, limit?: number): string[];
  }
}
