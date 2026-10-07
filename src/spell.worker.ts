// Worker do corretor: carrega o dicionário pt-BR e responde as palavras erradas.
// Fica separado para a interface não travar durante o carregamento (~alguns segundos).
import Typo from "typo-js";

interface SpellHit {
  word: string;
  suggestions: string[];
}

let typo: { check(w: string): boolean; suggest(w: string, limit?: number): string[] } | null = null;

self.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as { type: string; id?: number; words?: string[]; base?: string };

  if (data.type === "init") {
    void (async () => {
      try {
        const base = data.base ?? self.location.href;
        const load = async (file: string) => {
          const res = await fetch(new URL(`dicionario/${file}`, base));
          if (!res.ok) throw new Error(`${file}: ${res.status}`);
          return res.text();
        };
        const [aff, dic] = await Promise.all([load("pt_BR.aff"), load("pt_BR.dic")]);
        typo = new Typo("pt_BR", aff, dic, { platform: "any" });
        self.postMessage({ type: "ready" });
      } catch (err) {
        self.postMessage({ type: "failed", error: String(err) });
      }
    })();
    return;
  }

  if (data.type === "check") {
    const words = data.words ?? [];
    if (!typo) {
      self.postMessage({ type: "result", id: data.id, hits: [] });
      return;
    }
    const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const hits: SpellHit[] = [];
    for (const word of words) {
      if (!word) continue;
      if (typo.check(word)) continue;
      const lower = word.toLowerCase();
      if (lower !== word && typo.check(lower)) continue;
      const base = strip(word);
      const suggestions = typo.suggest(word, 12);
      // primeiro as que só mudam o acento (erro mais comum: "otima" → "ótima")
      suggestions.sort((a, b) => Number(strip(b) === base) - Number(strip(a) === base));
      hits.push({ word, suggestions: suggestions.slice(0, 6) });
    }
    self.postMessage({ type: "result", id: data.id, hits });
  }
});
