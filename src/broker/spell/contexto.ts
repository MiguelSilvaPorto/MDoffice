// Contexto do corretor: o quanto uma palavra combina com a que veio antes.
//
// Usa o recorte de bigramas do modelo de n-gramas (`public/ngrams/ctx-pt.json`, gerado
// por `scripts/gerar-contexto.mjs`) com suavização de Dirichlet e backoff para o
// unigrama: uma sequência que existe no corpus puxa a nota do candidato ("vou para a
// **casa**"); uma que não existe simplesmente não ajuda — o candidato fica com o peso
// da própria palavra, sem penalidade.
//
// Puro (sem DOM e sem worker): dá para testar no Node.

export interface ModeloCtx {
  /** palavra (minúscula) -> índice nas tabelas do corpus */
  indice: Map<string, number>;
  /** contagem de cada palavra (unigrama) */
  n: number[];
  /** sucessores de cada contexto: [índice, contagem, índice, contagem, …] */
  b: Record<string, number[]>;
  /** total observado de cada contexto (denominador do bigrama) */
  bt: Record<string, number>;
  /** soma dos unigramas (denominador do unigrama) */
  total: number;
}

/** Quanto o unigrama pesa quando o bigrama é raro (suavização de Dirichlet). */
const SUAVIZACAO = 5;

/** Quantas vezes acima do esperado para a nota de contexto chegar a 1. */
const RAZAO_FORTE = 20;

/** Monta o modelo a partir do JSON (`{w, n, b, bt}`); null quando o formato não bate. */
export function montarContexto(json: unknown): ModeloCtx | null {
  const j = json as { w?: unknown; n?: unknown; b?: unknown; bt?: unknown };
  if (!Array.isArray(j.w) || !Array.isArray(j.n) || !j.b || !j.bt) return null;
  const w = j.w as string[];
  const n = j.n as number[];
  const indice = new Map<string, number>();
  let total = 0;
  for (let i = 0; i < w.length; i++) {
    total += n[i] ?? 0;
    const palavra = w[i];
    if (palavra && !indice.has(palavra)) indice.set(palavra, i);
  }
  return { indice, n, b: j.b as Record<string, number[]>, bt: j.bt as Record<string, number>, total };
}

/** Probabilidade (em log) de `palavra` vir depois de `anterior`. */
export function logProb(palavra: string, anterior: string | undefined, m: ModeloCtx): number {
  const alvo = palavra.toLowerCase();
  const i = m.indice.get(alvo);
  const uni = ((i === undefined ? 0 : (m.n[i] ?? 0)) + 1) / (m.total + m.indice.size);
  const ctx = anterior?.toLowerCase();
  if (!ctx) return Math.log(uni);
  const chave = m.indice.get(ctx);
  if (chave === undefined) return Math.log(uni);
  const totalCtx = m.bt[String(chave)];
  const sucessores = m.b[String(chave)];
  if (!sucessores || !totalCtx) return Math.log(uni);
  let contagem = 0;
  if (i !== undefined) {
    for (let k = 0; k + 1 < sucessores.length; k += 2) {
      if (sucessores[k] === i) {
        contagem = sucessores[k + 1];
        break;
      }
    }
  }
  return Math.log((contagem + SUAVIZACAO * uni) / (totalCtx + SUAVIZACAO));
}

/**
 * Nota de contexto de 0 a 1: 0 = tão esperado quanto a própria palavra (ou menos);
 * 1 = muito acima do esperado (20× o unigrama). É o que o corretor soma à nota do
 * candidato para desempatar pelo que a frase pede.
 */
export function notaContexto(palavra: string, anterior: string | undefined, m: ModeloCtx | null | undefined): number {
  if (!m || !anterior) return 0;
  const comContexto = Math.exp(logProb(palavra, anterior, m));
  const semContexto = Math.exp(logProb(palavra, undefined, m));
  if (semContexto <= 0) return 0;
  const razao = comContexto / semContexto;
  if (razao <= 1) return 0;
  return Math.min(1, Math.log(razao) / Math.log(RAZAO_FORTE));
}
