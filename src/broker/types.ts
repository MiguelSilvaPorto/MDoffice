// Tipos compartilhados do sistema de sugestão e correção.

/**
 * Classe de um marcador informal (catálogo `data/informal.ts` e regras de frase em
 * `style/formalidade.ts`). É o que dá a contagem por classe e o peso do MIP
 * (marcadores informais por 1.000 palavras, em `stats.ts`).
 */
export type ClasseMarcador = "giria" | "internetes" | "contracao" | "muleta" | "oralidade" | "atenuacao" | "redundancia" | "vagueza";

/** Um marcador informal encontrado no texto (para o MIP e o painel de revisão). */
export interface MarcadorInformal {
  classe: ClasseMarcador;
  from: number;
  to: number;
  word: string;
  message: string;
  /** frase em volta do marcador (o trecho que o painel mostra) */
  frase: string;
  /** true = a troca não mexe no sentido (o app pode corrigir sozinho) */
  seguro: boolean;
}

export interface WritingIssue {
  from: number;
  to: number;
  word: string;
  kind: "spell" | "style";
  message: string;
  /** palavras para trocar (ortografia/sinônimos) */
  suggestions: string[];
  /** correção direta da regra (quando existe) */
  fix?: string;
  /** pode ser aplicada sozinha enquanto se digita (espaços, maiúsculas, abreviações) */
  safe?: boolean;
  /** correção de ortografia em que dá para confiar (aplicada sozinha pela correção automática) */
  auto?: string;
  /**
   * Categoria do aviso. Serve para a política da correção automática:
   * "ponto-final" = fecha o parágrafo com ponto (só entra quando o parágrafo acabou);
   * "quebra-frase" = reestrutura a frase (nunca entra sozinha; só pelo aviso/“Corrigir tudo”).
   *
   * As demais classes (internetês, contração, muleta…) marcam um **marcador informal**:
   * é o que conta no MIP e no agrupamento por classe do painel de revisão.
   */
  classe?: "ponto-final" | "quebra-frase" | ClasseMarcador;
}

export interface WritingStats {
  words: number;
  sentences: number;
  avgWordsPerSentence: number;
  longSentences: number;
  repeated: { word: string; count: number; from: number; to: number }[];
  /** marcadores informais por 1.000 palavras (MIP) do texto atual */
  mip: number;
  /** MIP estimado se o app aplicasse sozinho o que é seguro (as trocas com correção) */
  mipDepois: number;
  /** ocorrências de marcadores informais (trecho, frase, classe e risco) */
  marcadores: MarcadorInformal[];
  /** contagem e peso por classe (para o painel de revisão) */
  marcadoresPorClasse: { classe: ClasseMarcador; count: number; peso: number }[];
}
