// Tipos compartilhados do sistema de sugestão e correção.

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
   * Categoria para a política da correção automática:
   * "ponto-final" = fecha o parágrafo com ponto (só entra quando o parágrafo acabou);
   * "quebra-frase" = reestrutura a frase (nunca entra sozinha; só pelo aviso/“Corrigir tudo”).
   */
  classe?: "ponto-final" | "quebra-frase";
}

export interface WritingStats {
  words: number;
  sentences: number;
  avgWordsPerSentence: number;
  longSentences: number;
  repeated: { word: string; count: number; from: number; to: number }[];
}
