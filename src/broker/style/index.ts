// Regras de estilo e gramática. A ORDEM da lista importa: se duas regras avisam o mesmo trecho,
// vale a primeira.

import { MASCA, maskNonProse } from "../mask";
import { getTone } from "../tone";
import type { WritingIssue } from "../types";
import { abbreviationsAndGlued, repeatedWords, doubleSpaces, spaceBeforePunct, spaceAfterPunct, spaceAfterSentence, repeatedPunct } from "./spacing";
import { commasAroundExpressions, safeSentenceBreak, longRunWithoutPunct, adversativeComma, introConnectiveComma, adverbialComma, missingFinalPeriod, subordinateComma } from "./punctuation";
import { duplicatedPunct, frasesColadas } from "./limpeza";
import { divisoresDoTrecho } from "./divisores";
import { encurtarTrecho } from "../encurtar";
import { lowercaseAfterPeriod, paragraphStartLowercase } from "./capitalization";
import { phrases } from "./phrases";
import { informalRegister } from "./register";
import { aGente, aiConector, entaoConector, voceVeQue, haAtras, vouEstarGerundio, vouFazer } from "./formalidade";
import { REGRAS_ABNT } from "../abnt";
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
  informalRegister,
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
  aGente,
  aiConector,
  entaoConector,
  voceVeQue,
  vouEstarGerundio,
  vouFazer,
  haAtras,
  fazerImpessoal,
  ...REGRAS_ABNT,
  personalLongSentence,
];

/** Memória de 1 entrada: a cada pausa o app chama checkStyle várias vezes com o mesmo texto. */
let cache: { chave: string; issues: WritingIssue[] } | null = null;

/** Devolve cópias: quem chama pode mexer nos avisos (o checkText funde ortografia + ponto) sem estragar a memória. */
const copia = (lista: WritingIssue[]): WritingIssue[] =>
  lista.map((i) => ({
    ...i,
    suggestions: [...i.suggestions],
    divisores: i.divisores?.map((d) => ({ ...d })),
    trocas: i.trocas?.map((t) => ({ ...t })),
  }));

/** Rótulo curto para um divisor que outra regra já achou (", porque", ". E", "hoje em dia,"). */
function rotuloDoDivisor(fix: string): string {
  if (fix.startsWith(". ")) return "começar frase nova";
  const conj = /^, ([\p{L}]+)/u.exec(fix);
  if (conj) return `vírgula antes de “${conj[1]}”`;
  if (fix.endsWith(",")) return `vírgula depois de “${fix.slice(0, -1)}”`;
  return "vírgula";
}

/**
 * Trecho longo: junta os avisos que falam do MESMO trecho e dá o que fazer.
 * - o aviso do perfil ("Frase de 55 palavras…") absorve o do trecho sem pontuação quando
 *   cobrem a mesma frase — antes eram duas faixas amarelas e dois popups diferentes;
 * - cada aviso longo (sem quebra pronta) ganha os divisores — inclusive os que outras
 *   regras já acham dentro dele (". E deixará", ", pois") — e até três trocas que encurtam.
 */
function enriquecerTrechosLongos(issues: WritingIssue[], text: string, mask: string): WritingIssue[] {
  const ehLongo = (i: WritingIssue) => i.classe === "frase-longa" || i.classe === "trecho-longo";
  if (!issues.some(ehLongo)) return issues;

  // divisores que outras regras já acham: a correção delas é a mesma coisa que o "Dividir:" faria
  const reusados = issues
    .filter((j) => j.fix !== undefined && /^[.,;:]\s/.test(j.fix))
    .map((j) => ({
      from: j.from,
      to: j.to,
      insert: j.fix as string,
      rotulo: rotuloDoDivisor(j.fix as string),
      confianca: ((j.fix as string).startsWith(". ") ? "alta" : "media") as "alta" | "media",
    }));

  // o aviso do perfil cobre a frase inteira: os avisos de trecho dentro dela saem
  const cobertos = new Set<WritingIssue>();
  for (const perfil of issues.filter((i) => i.classe === "frase-longa")) {
    for (const trecho of issues) {
      if (trecho.classe === "trecho-longo" && trecho.from < perfil.to && perfil.from < trecho.to) cobertos.add(trecho);
    }
  }
  const finais = issues.filter((i) => !cobertos.has(i));

  for (const i of finais) {
    if (!ehLongo(i) || i.fix !== undefined) continue; // com quebra pronta, o aviso já é acionável
    const vistos = new Set<string>();
    const divisores = [...reusados.filter((r) => r.from >= i.from && r.to <= i.to), ...divisoresDoTrecho(text, i.from, i.to)]
      .filter((d) => {
        const chave = `${d.from}-${d.to}-${d.insert}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return !mask.slice(d.from, d.to).includes(MASCA); // dentro de código/link não se mexe
      })
      // primeiro o que divide em frases novas (é o que "dividir em duas" pede), depois as vírgulas
      .sort((a, b) => Number(b.insert.startsWith(". ")) - Number(a.insert.startsWith(". ")) || a.from - b.from);
    i.divisores = divisores.length
      ? divisores.slice(0, 4).map(({ from, to, insert, rotulo }) => ({ from, to, insert, rotulo }))
      : undefined;
    const trocas = encurtarTrecho(text, i.from, i.to, 3);
    i.trocas = trocas.length ? trocas : undefined;
  }
  return finais;
}

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

  const finais = enriquecerTrechosLongos(limpos, text, mask);

  cache = { chave, issues: finais };
  return copia(finais);
}
