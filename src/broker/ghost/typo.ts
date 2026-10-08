// Correção do que acabou de ser digitado: "voce" → "você", "resultdo" → "resultado".
// Só age numa palavra que NÃO existe no vocabulário e não é começo de nenhuma, e só propõe uma troca quando ela é
// clara (uma letra de diferença, palavra comum, sem rival parecido). É só uma sugestão: Tab aplica, nada muda sozinho.

import type { LangModel } from "./model";

const LETTERS = "abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúç";

const accentMaps = new WeakMap<LangModel, Map<string, number>>();

const strip = (w: string): string => w.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** sem acento → a palavra com acento mais comum (só para as que perdem alguma coisa ao tirar o acento) */
function accentMap(model: LangModel): Map<string, number> {
  let m = accentMaps.get(model);
  if (m) return m;
  m = new Map();
  for (let id = 3; id < model.words.length; id++) {
    const w = model.words[id];
    const s = strip(w);
    if (s === w) continue;
    const cur = m.get(s);
    if (cur === undefined || model.data.n[id] > model.data.n[cur]) m.set(s, id);
  }
  accentMaps.set(model, m);
  return m;
}

/** Uma troca/inserção/remoção/inversão de letra. */
function* edits(w: string): Generator<string> {
  for (let i = 0; i < w.length; i++) yield w.slice(0, i) + w.slice(i + 1); // faltou apagar
  for (let i = 0; i < w.length - 1; i++) yield w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2); // letras trocadas de lugar
  for (let i = 0; i < w.length; i++) for (const c of LETTERS) if (c !== w[i]) yield w.slice(0, i) + c + w.slice(i + 1); // letra errada
  for (let i = 0; i <= w.length; i++) for (const c of LETTERS) yield w.slice(0, i) + c + w.slice(i); // faltou uma letra
}

/** A palavra certa para o que foi digitado, ou null se não houver uma troca clara. `typed` em minúsculas. */
export function fixTypo(model: LangModel, typed: string): string | null {
  if (typed.length < 3 || /[-\d]/.test(typed)) return null;
  if (model.idOf.has(typed)) return null; // é uma palavra
  if (model.withPrefix(typed, 1).length) return null; // ainda pode estar sendo digitada
  // 1) só faltou o acento
  const acc = accentMap(model).get(typed);
  if (acc !== undefined && model.data.n[acc] >= 30) return model.words[acc];
  // 2) uma letra errada, sobrando ou faltando
  if (typed.length < 5) return null;
  let best = -1;
  let bestN = 0;
  let second = 0;
  const seen = new Set<number>();
  for (const e of edits(typed)) {
    const id = model.idOf.get(e);
    if (id === undefined || id < 3 || seen.has(id)) continue;
    seen.add(id);
    const n = model.data.n[id];
    if (n > bestN) {
      second = bestN;
      bestN = n;
      best = id;
    } else if (n > second) second = n;
  }
  // palavra comum e sem rival parecido de peso semelhante
  if (best >= 0 && bestN >= 150 && bestN >= 4 * second) return model.words[best];
  return null;
}
