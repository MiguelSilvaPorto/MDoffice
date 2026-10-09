// Regras de estilo e gramática. A ORDEM da lista importa: se duas regras avisam o mesmo trecho,
// vale a primeira.

import { isInsideMask, maskNonProse } from "../mask";
import type { WritingIssue } from "../types";
import { abbreviationsAndGlued, repeatedWords, doubleSpaces, spaceBeforePunct, spaceAfterPunct, spaceAfterSentence, repeatedPunct } from "./spacing";
import { commasAroundExpressions, safeSentenceBreak, longRunWithoutPunct, adversativeComma, introConnectiveComma, missingFinalPeriod, subordinateComma } from "./punctuation";
import { lowercaseAfterPeriod, paragraphStartLowercase } from "./capitalization";
import { phrases } from "./phrases";
import { informalRegister, aGente } from "./register";
import { abntHours, abntHoursColon, abntUnits, abntMonths, abntAcronymPlural, abntCitation, abntPage, abntEtAl, abntDash, abntLatin } from "./abnt";
import { personalLongSentence } from "./personal";
import type { Rule } from "./types";

const RULES: Rule[] = [
  abbreviationsAndGlued,
  repeatedWords,
  doubleSpaces,
  spaceBeforePunct,
  spaceAfterPunct,
  spaceAfterSentence,
  repeatedPunct,
  commasAroundExpressions,
  safeSentenceBreak,
  longRunWithoutPunct,
  lowercaseAfterPeriod,
  paragraphStartLowercase,
  phrases,
  adversativeComma,
  subordinateComma,
  introConnectiveComma,
  missingFinalPeriod,
  informalRegister,
  aGente,
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

export function checkStyle(text: string): WritingIssue[] {
  const issues: WritingIssue[] = [];
  const mask = maskNonProse(text);

  const push = (from: number, to: number, message: string, fix?: string, suggestions: string[] = [], safe = false) => {
    const word = text.slice(from, to);
    if (!word.trim()) return;
    issues.push({ from, to, word, kind: "style", message, suggestions, fix, safe });
  };

  const ctx = { text, mask, push };
  for (const rule of RULES) rule(ctx);

  const seen = new Set<string>();

  return issues
    .filter((i) => !isInsideMask(text, i.from, i.to))
    .filter((i) => {
      const key = `${i.from}-${i.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.from - b.from);
}
