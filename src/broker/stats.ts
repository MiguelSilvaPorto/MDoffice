// Estatísticas do texto: palavras, frases, frases longas e palavras repetidas.

import { maskNonProse } from "./mask";
import type { WritingStats } from "./types";

export function stats(text: string): WritingStats {
  const mask = maskNonProse(text).replace(/\s+/g, " ");
  const words = (mask.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;
  const sentences = mask.split(/[.!?]+\s/).filter((s) => s.trim().length > 12);
  let longSentences = 0;
  for (const s of sentences) {
    const n = (s.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;
    if (n > 35) longSentences++;
  }

  // palavras repetidas com exagero (fora de listas de parada)
  const stop = new Set([
    "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "é", "em", "um", "uma", "para", "por",
    "com", "que", "não", "na", "no", "se", "ao", "aos", "à", "às", "the", "of", "to", "and",
  ]);
  const counts = new Map<string, { count: number; from: number; to: number }>();
  const rx = /[\p{L}]{4,}/gu;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    const lower = m[0].toLowerCase();
    if (stop.has(lower)) continue;
    const current = counts.get(lower);
    if (current) current.count++;
    else counts.set(lower, { count: 1, from: m.index, to: m.index + m[0].length });
  }
  const repeated = Array.from(counts.entries())
    .filter(([, v]) => v.count >= 5)
    .map(([word, v]) => ({ word, count: v.count, from: v.from, to: v.to }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const sentCount = Math.max(1, sentences.length);
  return {
    words,
    sentences: sentences.length,
    avgWordsPerSentence: Math.round((words / sentCount) * 10) / 10,
    longSentences,
    repeated,
  };
}
