// Memória de traduções (só no seu computador): evita traduzir de novo o que não mudou.

const CACHE_KEY = "mdc.tr-cache.v1";
const CACHE_MAX = 3000;

export class TranslationCache {
  private map = new Map<string, string>();
  private saveTimer: number | undefined;

  constructor() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) for (const [k, v] of JSON.parse(raw) as [string, string][]) this.map.set(k, v);
    } catch {
      /* cache vazio */
    }
  }

  get(key: string): string | undefined {
    return this.map.get(key);
  }

  set(key: string, value: string): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > CACHE_MAX) this.map.delete(this.map.keys().next().value as string);
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify([...this.map.entries()]));
      } catch {
        /* sem espaço: segue só em memória */
      }
    }, 1500);
  }

  clear(): void {
    this.map.clear();
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignora */
    }
  }
}
