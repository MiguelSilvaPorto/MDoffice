// Dados da planilha: células, abas e o livro inteiro.
// Mesmo papel do src/powerpoint/schema.ts (deck -> slides) e do src/word/schema.ts.

/** Como o número aparece na célula (vira numFmt no .xlsx). */
export type FormatoNumero = "geral" | "decimal" | "moeda" | "porcento" | "data";

export type Alinhamento = "esquerda" | "centro" | "direita";

/** Aparência de uma célula (vira fonte/preenchimento/alinhamento/numFmt no .xlsx). */
export interface Estilo {
  negrito?: boolean;
  italico?: boolean;
  cor?: string; // cor do texto (hex de 6, sem #)
  fundo?: string; // cor de preenchimento (hex de 6, sem #)
  alinhamento?: Alinhamento;
  numero?: FormatoNumero;
  casas?: number; // casas decimais (padrão 2)
}

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

/** Configuração do livro: o "Configurar planilha" do App (como o do PowerPoint). */
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
/** How grande a área rolável é (o Excel usa 16384 colunas e 1048576 linhas; aqui basta para trabalhar). */
export const MAX_COLUNAS = 60;
export const MAX_LINHAS = 1000;

/** Limite de células por aba: evita travar a tela com digitação descontrolada. */
export const LIMITE_CELULAS = 60_000;