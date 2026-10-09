// Segunda opinião da IA local sobre as trocas que as regras propuseram: pontua a frase com a palavra original e com a
// troca (quanto mais natural, maior a nota). Troca que deixa a frase claramente pior sai da lista; as que passam
// ganham no motivo o resultado da conferência. Se a IA não estiver disponível (sem WebGPU, modelo ausente ou desligada),
// as trocas ficam como as regras as propuseram.

import { llmDevice, scoreSentences } from "../llm/client";
import { describeGroup, type DeepResult, type Proposal } from "./analyze";
import { waitCalm } from "./scheduler";

/** Troca que deixa a frase pior que isso (em log-probabilidade) é descartada. Calibrado em trocas boas/ruins escritas à mão. */
export const CORTE_DESCARTA = -6;
/** Acima disso a IA "confirma" (a frase fica tão natural quanto a original, ou mais). */
export const CORTE_CONFIRMA = -2.5;
/** Frases por chamada ao modelo (o modelo agrupa em lotes menores por dentro). */
const POR_CHAMADA = 16;

const juntar = (p: Proposal, word: string) => `${p.before}${word}${p.after}`;

/** Confere as trocas com a IA local. Devolve true se a IA foi usada. */
export async function refineWithLm(res: DeepResult, opts: { background?: boolean; onProgress?: (done: number, total: number) => void } = {}): Promise<boolean> {
  const all = res.groups.flatMap((g) => g.proposals);
  if (!all.length) return false;
  const deltas = new Map<string, number>();
  for (let i = 0; i < all.length; i += POR_CHAMADA / 2) {
    if (opts.background) await waitCalm(); // em segundo plano: só com o computador parado
    const chunk = all.slice(i, i + POR_CHAMADA / 2);
    const texts = chunk.flatMap((p) => [juntar(p, p.original), juntar(p, p.replacement)]);
    const scores = await scoreSentences(texts);
    if (!scores) return false; // sem IA: deixa como está
    chunk.forEach((p, k) => deltas.set(p.id, scores[2 * k + 1] - scores[2 * k]));
    opts.onProgress?.(Math.min(all.length, i + chunk.length), all.length);
  }
  for (const g of res.groups) {
    g.proposals = g.proposals.filter((p) => (deltas.get(p.id) ?? 0) >= CORTE_DESCARTA);
    for (const p of g.proposals) {
      const d = deltas.get(p.id)!;
      p.lmDelta = d;
      if (d >= CORTE_CONFIRMA) {
        p.reason += d >= 1 ? ` A IA local confirma: a frase fica mais natural com “${p.replacement.toLowerCase()}”.` : ` A IA local confirma: a frase fica tão natural quanto a original.`;
      } else {
        p.confidence = "média";
        p.reason += ` A IA local vê a frase um pouco menos natural com “${p.replacement.toLowerCase()}” — confira antes de aceitar.`;
      }
    }
    if (g.proposals.length) g.why = describeGroup(g.shown, g.count, g.every, g.proposals);
  }
  res.groups = res.groups.filter((g) => g.proposals.length);
  res.lm = llmDevice() || "local";
  return true;
}
