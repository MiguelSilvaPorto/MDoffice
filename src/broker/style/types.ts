// Contexto que cada regra de estilo recebe.

import type { WritingIssue } from "../types";

export interface RuleCtx {
  /** texto original */
  text: string;
  /** texto com código, links e HTML escondidos (mesmo comprimento) */
  mask: string;
  /** registra um aviso de estilo */
  push: (from: number, to: number, message: string, fix?: string, suggestions?: string[], safe?: boolean) => void;
}

export type Rule = (ctx: RuleCtx) => void;
export type { WritingIssue };
