// Dados da planilha: células, abas e o livro inteiro.
// Mesmo papel do src/powerpoint/schema.ts (deck -> slides) e do src/word/schema.ts.

/** Como o número aparece na célula (vira numFmt no .xlsx). */
export type FormatoNumero = "geral" | "decimal" | "moeda" | "porcento" | "data";

export type Alinhamento = "esquerda" | "centro" | "direita" | "justificado";

/** Aparência de uma célula (vira fonte/preenchimento/alinhamento/numFmt no .xlsx). */
export interface Estilo {
  negrito?: boolean;
  italico?: boolean;
  /** família da fonte (ex.: "Calibri", "Arial") */
  fonte?: string;
  /** tamanho da fonte em pontos (padrão 11) */
  tamanho?: number;
  cor?: string; // cor do texto (hex de 6, sem #)
  fundo?: string; // cor de preenchimento (hex de 6, sem #)
  alinhamento?: Alinhamento;
  numero?: FormatoNumero;
  casas?: number; // casas decimais (padrão 2)
}

/** Fonte e tamanho que o Excel usa quando a célula não escolhe outro. */
export const FONTE_PADRAO = "Calibri";
export const TAMANHO_PADRAO = 11;

/** Uma célula guarda o texto cru que o usuário digitou (com "=" quando é fórmula). */
export interface Celula {
  texto: string;
  formula?: boolean;
  estilo?: Estilo;
}

/** Uma aba (planilha) da pasta de trabalho. */
export interface Folha {
  nome: string;
  /** células por referência A1 em maiúsculas (ex.: "B4") */
  celulas: Record<string, Celula>;
  /** largura por índice de coluna (0 = A), em px — 0 usa COLUNA_PX */
  colunas: Record<number, number>;
  /** altura por índice de linha (0 = 1), em px — 0 usa LINHA_PX */
  linhas: Record<number, number>;
  /** faixas mescladas no formato "A1:B2" */
  mesclas: string[];
  /** painéis congelados a partir do canto superior esquerdo (0 = nenhum) */
  congelado?: { colunas: number; linhas: number };
}

/** A pasta de trabalho inteira (o que vira um arquivo .xlsx). */
export interface Livro {
  folhas: Folha[];
  /** índice da aba visível */
  ativa: number;
}

/** Configuração do livro (grade, casas, moeda e zoom), preservada no documento. */
export interface ConfigPlanilha {
  /** mostrar as linhas da grade */
  grade: boolean;
  /** zoom da grade, em % (50 a 200) */
  zoom: number;
  /** casas decimais usadas quando o formato é "decimal" ou "moeda" */
  casas: number;
  /** símbolo da moeda usado no formato "moeda" */
  moeda: string;
}

// ---------- medidas da grade (px na tela; o .xlsx converte para as suas unidades) ----------

export const COLUNA_PX = 104;
export const LINHA_PX = 25;
export const CABECALHO_COL_PX = 46;
export const CABECALHO_LINHA_PX = 26;

/**
 * Limites do Excel de verdade — a grade é "infinita": ela nasce pequena e cresce
 * sozinha conforme você desce/direita (ou cola), até estes tetos.
 */
export const LIMITE_COLUNAS = 16_384;
export const LIMITE_LINHAS = 1_048_576;

/** Tamanho com que a grade nasce; cresce sob demanda (dobrando) até o limite. */
export const COLUNAS_INICIAIS = 60;
export const LINHAS_INICIAIS = 1000;

/** Teto de células que uma única colagem pode criar (proteção contra conteúdo gigante). */
export const LIMITE_COLAR = 200_000;