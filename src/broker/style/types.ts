// Contexto que cada regra de estilo recebe.

import type { WritingIssue } from "../types";

export interface RuleCtx {
  /** texto original */
  text: string;
  /** texto com código, links e HTML escondidos (mesmo comprimento) */
  mask: string;
  /** registra um aviso de estilo */
  push: (from: number, to: number, message: string, fix?: string, suggestions?: string[], safe?: boolean, classe?: WritingIssue["classe"]) => void;
  /**
   * Linhas que são **títulos** — no Markdown o `#` já as marca no texto; no Word elas vêm
   * da projeção (`titulos`). A regra do ponto final as ignora (título não fecha com ponto).
   */
  titulos?: ReadonlySet<number>;
}

export type Rule = (ctx: RuleCtx) => void;
export type { WritingIssue };
