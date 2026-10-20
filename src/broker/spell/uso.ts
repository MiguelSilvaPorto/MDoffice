// Decisão por USO e CONTEXTO para palavra que existe no dicionário.
//
// O corretor de ortografia não tem o que acusar quando a forma escrita é palavra de verdade
// ("media" existe — é o verbo mediar; "aguda" existe — é o feminino de agudo; "resta" existe).
// No CONTEXTO, porém, quase sempre só uma leitura cabe: "a «media» das notas" pede "média";
// "há «aguda» a prever" pede "ajuda".
//
// O que este módulo faz: propõe as trocas de CLASSE que dão uma palavra real (x↔ch, g↔j, c↔ç,
// tecla vizinha, "h" mudo, dobra…) e compara o quanto cada leitura combina com a palavra
// anterior no modelo de n-gramas. Só devolve quando a escrita NÃO aparece naquele contexto e a
// candidata aparece com muita vantagem — é **pergunta** (sugestão), nunca correção automática.
//
// Sem DOM: recebe o `LangModel` do `ghost/model.ts` pronto.

import type { LangModel } from "../ghost/model";
import { variantesDeClasse } from "./confusoes";

/** Quantas vezes a candidata precisa ser mais provável no contexto do que a escrita. */
export const VANTAGEM_MINIMA = 20;

/** Piso de uso no corpus da candidata, para não trocar uma raridade por outra. */
export const PISO_FREQUENCIA = 100;

/** Suavização do bigrama (mesma ideia de `spell/contexto.ts`). */
const SUAVIZACAO = 5;

export interface TrocaComUso {
  /** a candidata como o modelo a escreve (inicial maiúscula, quando é nome próprio) */
  palavra: string;
  /** quantas vezes ela é mais provável naquele contexto do que a escrita */
  vantagem: number;
  /** total dela no corpus */
  frequencia: number;
}

/** Quantas vezes `alvo` aparece depois de `anterior` no corpus. */
function contaBigrama(modelo: LangModel, idAnterior: number, idAlvo: number): number {
  for (const s of modelo.bigram(idAnterior).succ) {
    if (s.id === idAlvo) return s.count;
  }
  return 0;
}

/**
 * A melhor troca de classe para a palavra escrita **segundo o contexto** — ou null.
 * `anterior` é a palavra que veio antes (minúscula; `<s>` no começo do texto). Sem
 * contexto, sem modelo ou sem evidência suficiente, não opina.
 */
export function trocaPorContexto(escrita: string, anterior: string | undefined, modelo: LangModel | null): TrocaComUso | null {
  if (!modelo || !anterior) return null;
  const base = escrita.toLowerCase();
  const idEscrita = modelo.idOf.get(base);
  // A escrita precisa estar no vocabulário do corpus: sem isso não há uso com que comparar
  // (e termo técnico/estrangeiro não deve ser questionado por este caminho).
  if (idEscrita === undefined) return null;
  const idAnterior = modelo.idOf.get(anterior);
  if (idAnterior === undefined) return null;
  const { total } = modelo.bigram(idAnterior);
  if (!total) return null;
  // A escrita já aparece depois desta palavra? Então o contexto não a estranha.
  if (contaBigrama(modelo, idAnterior, idEscrita) > 0) return null;

  const n = (id: number): number => modelo.data.n[id] ?? 0;
  const pCtx = (id: number): number => (contaBigrama(modelo, idAnterior, id) + SUAVIZACAO * (n(id) / modelo.total)) / (total + SUAVIZACAO);
  const pEscrita = pCtx(idEscrita);
  // Palavra COMUM que o modelo não viu depois desta palavra: a tabela de bigramas guarda
  // só os sucessores mais frequentes de cada contexto, então a ausência não é erro — pode
  // ser só uma combinação rara ("à mão"). Sem evidência do contexto, uma palavra comum não
  // é questionada (era daqui que saía "mão" → "não").
  const frequenciaEscrita = n(idEscrita);
  // Nome próprio não é troca de classe: quem escreve "caso aja divergência" quer "haja", não
  // "Ana". As variantes de tecla vizinha/acento chegam a nomes do corpus ("aja" → "ana"), e o
  // modelo os prefere porque o nome é frequente — o resultado era a sugestão absurda do relato.
  // Só deixa passar quando a própria pessoa escreveu com maiúscula ("Ana" não vira "ana").
  const escritaMaiuscula = escrita[0] !== escrita[0]?.toLowerCase();

  let melhor: TrocaComUso | null = null;
  for (const variante of variantesDeClasse(base)) {
    const id = modelo.idOf.get(variante);
    if (id === undefined) continue;
    if (modelo.caps?.has(id) && !escritaMaiuscula) continue;
    const freq = n(id);
    if (freq < PISO_FREQUENCIA) continue;
    // A candidata precisa aparecer NESTE contexto; sem isso, só a frequência não decide
    // quando a escrita é uma palavra comum.
    if (contaBigrama(modelo, idAnterior, id) === 0 && frequenciaEscrita >= 1000) continue;
    const vantagem = pCtx(id) / pEscrita;
    if (vantagem < VANTAGEM_MINIMA) continue;
    if (!melhor || vantagem > melhor.vantagem) {
      melhor = { palavra: modelo.display(id), vantagem, frequencia: freq };
    }
  }
  return melhor;
}
