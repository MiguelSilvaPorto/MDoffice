// O "ímã" do giro: perto de um ângulo cardeal (0°, 90°, 180°, 270°…) a forma
// encosta nele, em vez de parar em 1,2° ou 88,7° e exigir um movimento de precisão
// para voltar. Puro (sem DOM) para dar para testar no Node.
//
// A tolerância é pequena de propósito: fora dela o giro é livre. O `Shift` continua
// valendo por cima (passos de 15°), que também inclui os cardeais.

/** O passo do ímã: 0°, 90°, 180°, 270°… (e o 360°, que é o mesmo 0°). */
export const PASSO_DO_IMA = 90;

/** Até quantos graus do cardeal o giro "encosta" nele. */
export const TOLERANCIA_DO_IMA = 3;

export interface ResultadoIma {
  rot: number;
  /** a forma encostou num cardeal neste movimento? */
  imantado: boolean;
}

/**
 * Encosta `graus` no múltiplo de 90 mais próximo quando a distância é de até
 * `tolerancia`. Sem ímã, devolve o ângulo como veio (e `imantado: false`).
 */
export function imantarAngulo(graus: number, tolerancia = TOLERANCIA_DO_IMA): ResultadoIma {
  const alvo = Math.round(graus / PASSO_DO_IMA) * PASSO_DO_IMA;
  if (Math.abs(graus - alvo) > tolerancia) return { rot: graus, imantado: false };
  return { rot: alvo, imantado: true };
}
