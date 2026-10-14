// Estatísticas do texto: palavras, frases, frases longas, palavras repetidas e
// marcadores informais (MIP — marcadores informais por 1.000 palavras).

import { ehClasseMarcador, PESO_CLASSE } from "./data/informal";
import { maskNonProse } from "./mask";
import { getTone, setTone } from "./tone";
import { informalRegister } from "./style/register";
import { aGente, aiConector, entaoConector, voceVeQue, vouEstarGerundio, vouFazer, haAtras } from "./style/formalidade";
import type { RuleCtx } from "./style/types";
import type { ClasseMarcador, MarcadorInformal, WritingIssue, WritingStats } from "./types";

/** As regras que produzem marcador informal (catálogo + janelas de frase). */
const REGRAS_MARCADOR: ((ctx: RuleCtx) => void)[] = [informalRegister, aGente, aiConector, entaoConector, voceVeQue, vouEstarGerundio, vouFazer, haAtras];

/** Frase em volta do trecho (o painel mostra o trecho, não só a palavra). */
function fraseEmVolta(text: string, from: number, to: number): string {
  let ini = from;
  while (ini > 0 && !/[.!?\n]/.test(text[ini - 1])) ini--;
  let fim = to;
  while (fim < text.length && !/[.!?\n]/.test(text[fim])) fim++;
  const frase = text.slice(ini, fim).replace(/\s+/g, " ").trim();
  return frase.length > 140 ? `${frase.slice(0, 137)}…` : frase;
}

/**
 * Varredura CRUA dos marcadores informais (catálogo + janelas de frase), na ordem do texto.
 *
 * É própria em vez de `checkStyle` de propósito: o `checkStyle` corta o que outra regra
 * cobre primeiro — o internetês ("vc", "msm"), que `data/abbreviations.ts` já corrige —
 * e tanto o MIP quanto a formalização precisam de TODOS os marcadores. Sempre no tom
 * formal: o tom decide o que vira aviso, mas aqui se mede/planeja o texto.
 */
export function achadosInformais(text: string): WritingIssue[] {
  const mask = maskNonProse(text);
  const achados: WritingIssue[] = [];
  const push: RuleCtx["push"] = (from, to, message, fix, suggestions = [], safe = false, classe) => {
    const word = text.slice(from, to);
    if (!word.trim()) return;
    achados.push({ from, to, word, kind: "style", message, suggestions, fix, safe, classe });
  };
  const tom = getTone();
  const forcou = tom !== "formal";
  if (forcou) setTone("formal");
  try {
    for (const regra of REGRAS_MARCADOR) regra({ text, mask, push });
  } finally {
    if (forcou) setTone(tom);
  }
  const vistos = new Set<string>();
  return achados
    .filter((i) => ehClasseMarcador(i.classe))
    .filter((i) => {
      const chave = `${i.from}-${i.to}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .sort((a, b) => a.from - b.from);
}

/**
 * Marcadores informais do texto, com classe e risco (é o que o painel de revisão e o MIP usam).
 */
export function marcadoresInformais(text: string): MarcadorInformal[] {
  return achadosInformais(text).map((i) => ({
    classe: i.classe as ClasseMarcador,
    from: i.from,
    to: i.to,
    word: i.word,
    message: i.message,
    frase: fraseEmVolta(text, i.from, i.to),
    // "seguro" = a troca não mexe no sentido (tem correção); as demais só se sugerem
    seguro: i.fix !== undefined,
  }));
}

const arredonda1 = (n: number) => Math.round(n * 10) / 10;

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

  // ------------------------------------------------ MIP
  const marcadores = marcadoresInformais(text);
  const peso = (lista: MarcadorInformal[]) => lista.reduce((soma, marcador) => soma + PESO_CLASSE[marcador.classe], 0);
  const porMil = (p: number) => (words > 0 ? arredonda1((p / words) * 1000) : 0);
  const porClasse = new Map<ClasseMarcador, { count: number; peso: number }>();
  for (const marcador of marcadores) {
    const atual = porClasse.get(marcador.classe) ?? { count: 0, peso: 0 };
    atual.count++;
    atual.peso += PESO_CLASSE[marcador.classe];
    porClasse.set(marcador.classe, atual);
  }

  const sentCount = Math.max(1, sentences.length);
  return {
    words,
    sentences: sentences.length,
    avgWordsPerSentence: Math.round((words / sentCount) * 10) / 10,
    longSentences,
    repeated,
    mip: porMil(peso(marcadores)),
    // "depois": o que restaria se o app aplicasse sozinho as trocas seguras
    mipDepois: porMil(peso(marcadores.filter((marcador) => !marcador.seguro))),
    marcadores,
    marcadoresPorClasse: Array.from(porClasse.entries())
      .map(([classe, v]) => ({ classe, count: v.count, peso: v.peso }))
      .sort((a, b) => b.peso - a.peso || b.count - a.count),
  };
}
