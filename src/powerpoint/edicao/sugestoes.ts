// A fornada da Composição: junta numa lista só as duas metades que antes viviam separadas (as
// Ideias de design e os Arranjos). Cada sugestão é uma ARRUMAÇÃO (fórmula + variante: vale para a
// lâmina que a prévia mostra) e um VISUAL (design + acabamento: vale para a apresentação).
//
// Tudo determinístico, sem IA: o lote `n` devolve sempre as mesmas sugestões — é isso que faz a
// prévia do cartão ser exatamente o que o clique aplica — e o "Gerar mais" avança o lote. A escolha:
//
// - a ARRUMAÇÃO anda de um em um a partir do lote: dentro da fornada não se repete enquanto houver
//   fórmulas/variantes suficientes para a lâmina (a fornada encolhe em vez de mostrar duas vezes a
//   mesma arrumação);
// - o VISUAL anda por passos (o catálogo dividido pelos cartões): a fornada espalha designs em vez
//   de mostrar vizinhos do catálogo, e o deslocamento pelo lote troca o conjunto a cada fornada;
// - os últimos cartões são designs CRIADOS na hora (a semente avança a cada lote), como nas Ideias:
//   a fornada nunca é só catálogo.
import { ARRANJOS, variantesDe, type Arranjo } from "./arranjos";
import { gerarDesign } from "./gerador";
import type { ModeloPPT, TratamentoIdeia } from "./modelos";

/** Os acabamentos que a fornada gira (os mesmos das Ideias de design). */
export const ACABAMENTOS: TratamentoIdeia[] = ["recolorir", "cartao", "sombra", "cantos", "contorno"];

/** Um cartão da Composição: a arrumação da lâmina + o visual do deck. */
export interface SugestaoPPT {
  /** a fórmula da lâmina — `null` quando a lâmina não tem o que arrumar (o cartão é só visual) */
  arranjo: Arranjo | null;
  variante: number;
  modelo: ModeloPPT;
  tratamento: TratamentoIdeia;
}

export interface OpcoesSugestoes {
  /** quantas unidades de conteúdo a lâmina tem (decide as variantes de cada fórmula) */
  unidades: number;
  /**
   * A lâmina é arrumável? (`arrumavel` dos arranjos.) Uma lâmina de título — dois textos soltos —
   * não é: a fornada sai só de visuais, em vez de oferecer fórmulas que não mudam nada.
   */
  arrumavel?: boolean;
  /**
   * As arrumações que JÁ se sabe que funcionam nesta lâmina (legíveis, sem sobrepor). Com elas a
   * fornada roda por essas e varia o VISUAL — não encolhe para o número delas. Sem isto, as oito
   * fórmulas eram sorteadas primeiro e o filtro de legibilidade derrubava quase todas depois: o
   * modo "Tudo" ficava com UM cartão só.
   */
  arrumacoes?: { arranjo: Arranjo; variante: number }[];
  /** o catálogo à mão (presets + modelos criados pelo usuário) */
  modelos: ModeloPPT[];
  /** o lote à mostra — o "Gerar mais" avança */
  lote: number;
  /** quantos cartões a fornada tem (padrão 8) */
  quantas?: number;
  /** quantos cartões são designs criados na hora (padrão 2) */
  criadas?: number;
}

const QUANTAS_PADRAO = 8;
const CRIADAS_PADRAO = 2;

/** Uma arrumação possível da lâmina (fórmula + variante). */
interface Arrumacao {
  arranjo: Arranjo;
  variante: number;
}

/** Todas as arrumações que fazem sentido para a lâmina, na ordem das fórmulas. */
export function arrumacoesDe(unidades: number): Arrumacao[] {
  // lâmina vazia não tem o que arrumar (o painel mostra o aviso em vez de cartões condenados)
  if (unidades <= 0) return [];
  const lista: Arrumacao[] = [];
  for (const a of ARRANJOS) {
    // a hierarquia precisa de uma árvore (pai e pelo menos dois níveis): com menos de três cartões não há
    if ((a.id === "hierarquia" || a.id === "hierarquia-lado") && unidades < 3) continue;
    for (const v of variantesDe(a.id, unidades)) lista.push({ arranjo: a.id, variante: v });
  }
  return lista;
}

/**
 * A fornada do lote: `quantas` sugestões de arrumação × visual (ver o cabeçalho para as regras).
 * Numa lâmina que não é arrumável (`op.arrumavel === false`) as sugestões saem só de visual — a
 * arrumação vem `null`. Devolve lista vazia só quando não há nem catálogo (não deveria acontecer).
 */
export function sugestoesDe(op: OpcoesSugestoes): SugestaoPPT[] {
  const arrumacoes = op.arrumacoes ?? ((op.arrumavel ?? true) ? arrumacoesDe(op.unidades) : []);
  // sem a lista de arrumações conhecidas, a fornada encolhe se a lâmina não tem arrumações suficientes
  // (repetir a mesma num cartão ao lado faria o olho achar que os cartões são iguais); COM ela, o
  // visual é que varia (a mesma arrumação com designs diferentes), então a fornada tem o tamanho cheio
  const quantas = op.arrumacoes ? Math.max(1, op.quantas ?? QUANTAS_PADRAO) : arrumacoes.length ? Math.max(1, Math.min(op.quantas ?? QUANTAS_PADRAO, arrumacoes.length)) : Math.max(1, op.quantas ?? QUANTAS_PADRAO);
  const criadas = Math.max(0, Math.min(op.criadas ?? CRIADAS_PADRAO, quantas));
  const catalogo: { modelo: ModeloPPT; tratamento: TratamentoIdeia }[] = [];
  for (const m of op.modelos) for (const t of ACABAMENTOS) catalogo.push({ modelo: m, tratamento: t });
  // sem catálogo a fornada é toda criada na hora (não deveria acontecer: os presets existem)
  const doCatalogo = catalogo.length ? Math.max(1, quantas - criadas) : 0;
  const passo = catalogo.length ? Math.max(1, Math.floor(catalogo.length / doCatalogo)) : 1;
  const lote = Math.abs(Math.floor(op.lote));
  const criada = (semente: number): { modelo: ModeloPPT; tratamento: TratamentoIdeia } => ({
    modelo: gerarDesign(semente),
    tratamento: ACABAMENTOS[semente % ACABAMENTOS.length],
  });
  const out: SugestaoPPT[] = [];
  for (let k = 0; k < quantas; k++) {
    const a: { arranjo: Arranjo | null; variante: number } = arrumacoes.length ? arrumacoes[(lote + k) % arrumacoes.length] : { arranjo: null, variante: 0 };
    if (k >= doCatalogo) out.push({ ...a, ...criada(lote * Math.max(1, criadas) + (k - doCatalogo)) });
    else out.push({ ...a, ...catalogo[(lote * doCatalogo + k * passo) % catalogo.length] });
  }
  return out;
}
