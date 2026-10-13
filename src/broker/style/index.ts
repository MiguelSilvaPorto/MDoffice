// Regras de estilo e gramática. A ORDEM da lista importa: se duas regras avisam o mesmo trecho,
// vale a primeira.

import { MASCA, maskNonProse } from "../mask";
import { getTone } from "../tone";
import type { WritingIssue } from "../types";
import { abbreviationsAndGlued, repeatedWords, doubleSpaces, spaceBeforePunct, spaceAfterPunct, spaceAfterSentence, repeatedPunct } from "./spacing";
import { commasAroundExpressions, safeSentenceBreak, longRunWithoutPunct, adversativeComma, introConnectiveComma, adverbialComma, missingFinalPeriod, subordinateComma } from "./punctuation";
import { duplicatedPunct, frasesColadas } from "./limpeza";
import { lowercaseAfterPeriod, paragraphStartLowercase } from "./capitalization";
import { phrases } from "./phrases";
import { informalRegister, aGente } from "./register";
import { abntHours, abntHoursColon, abntUnits, abntMonths, abntAcronymPlural, abntCitation, abntPage, abntEtAl, abntDash, abntLatin } from "./abnt";
import { personalLongSentence } from "./personal";
import { fazerImpessoal } from "./concordancia";
import type { Rule } from "./types";

const RULES: Rule[] = [
  abbreviationsAndGlued,
  repeatedWords,
  doubleSpaces,
  spaceBeforePunct,
  spaceAfterPunct,
  spaceAfterSentence,
  repeatedPunct,
  duplicatedPunct,
  frasesColadas,
  commasAroundExpressions,
  safeSentenceBreak,
  longRunWithoutPunct,
  lowercaseAfterPeriod,
  paragraphStartLowercase,
  phrases,
  adversativeComma,
  subordinateComma,
  introConnectiveComma,
  adverbialComma,
  missingFinalPeriod,
  informalRegister,
  aGente,
  fazerImpessoal,
  abntHours,
  abntHoursColon,
  abntUnits,
  abntMonths,
  abntAcronymPlural,
  abntCitation,
  abntPage,
  abntEtAl,
  abntDash,
  abntLatin,
  personalLongSentence,
];

/** Memória de 1 entrada: a cada pausa o app chama checkStyle várias vezes com o mesmo texto. */
let cache: { chave: string; issues: WritingIssue[] } | null = null;

/** Devolve cópias: quem chama pode mexer nos avisos (o checkText funde ortografia + ponto) sem estragar a memória. */
const copia = (lista: WritingIssue[]): WritingIssue[] => lista.map((i) => ({ ...i, suggestions: [...i.suggestions] }));

export function checkStyle(text: string): WritingIssue[] {
  const chave = `${getTone()}\u0000${text}`;
  if (cache && cache.chave === chave) return copia(cache.issues);

  const issues: WritingIssue[] = [];
  const mask = maskNonProse(text);

  const push = (from: number, to: number, message: string, fix?: string, suggestions: string[] = [], safe = false, classe?: WritingIssue["classe"]) => {
    const word = text.slice(from, to);
    if (!word.trim()) return;
    issues.push({ from, to, word, kind: "style", message, suggestions, fix, safe, classe });
  };

  const ctx = { text, mask, push };
  for (const rule of RULES) rule(ctx);

  const seen = new Set<string>();
  const limpos = issues
    .filter((i) => {
      // dentro da máscara (código, link, HTML)? A máscara já está calculada — nada de refazê-la por aviso.
      const pedaco = mask.slice(i.from, i.to);
      return !(/^[·\s]*$/.test(pedaco) && pedaco.includes(MASCA) && text.slice(i.from, i.to).trim() !== "");
    })
    .filter((i) => {
      const key = `${i.from}-${i.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.from - b.from);

  cache = { chave, issues: limpos };
  return copia(limpos);
}
