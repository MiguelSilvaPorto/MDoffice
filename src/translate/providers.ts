// Motores de tradução: interface comum, erros e o motor online gratuito (MyMemory).

export interface Provider {
  id: string;
  label: string;
  /** Traduz vários textos (já protegidos). Devolve na mesma ordem. */
  translate(texts: string[], signal: AbortSignal): Promise<string[]>;
}

export class QuotaError extends Error {
  constructor(msg = "O limite gratuito do tradutor online acabou por hoje.") {
    super(msg);
    this.name = "QuotaError";
  }
}

export class OfflineError extends Error {}

/** Quebra um texto em pedaços de até `max` caracteres, respeitando o fim das frases. */
export function chunkText(text: string, max = 420): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      out.push(cur.trim());
      cur = "";
    }
    if (s.length > max) {
      for (let k = 0; k < s.length; k += max) out.push(s.slice(k, k + max).trim());
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

/** MyMemory: gratuito, sem chave (com e-mail o limite diário sobe de 5 mil para 50 mil letras). */
export function myMemoryProvider(getEmail: () => string): Provider {
  const one = async (q: string, signal: AbortSignal): Promise<string> => {
    const params = new URLSearchParams({ q, langpair: "pt-BR|en-GB" });
    const email = getEmail().trim();
    if (email) params.set("de", email);
    let res: Response;
    try {
      res = await fetch(`https://api.mymemory.translated.net/get?${params}`, { signal });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new Error("Sem conexão com o tradutor online. Confira a internet ou use o modo offline.");
    }
    if (res.status === 429) throw new QuotaError();
    const data = (await res.json()) as { responseData?: { translatedText?: string }; quotaFinished?: boolean; responseStatus?: number | string };
    const text = data.responseData?.translatedText ?? "";
    if (data.quotaFinished || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(text)) throw new QuotaError();
    if (!text) throw new Error("O tradutor online não devolveu nada para este trecho.");
    return text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  };
  return {
    id: "online",
    label: "Online (MyMemory)",
    async translate(texts, signal) {
      const out: string[] = new Array(texts.length);
      let next = 0;
      const worker = async () => {
        while (next < texts.length) {
          const idx = next++;
          const parts = chunkText(texts[idx]);
          const done: string[] = [];
          for (const p of parts) done.push(await one(p, signal));
          out[idx] = done.join(" ");
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      return out;
    },
  };
}
