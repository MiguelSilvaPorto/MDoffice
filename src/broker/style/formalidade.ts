// Frase formal: regras que precisam de uma janela de contexto.
//
// O catálogo de `data/informal.ts` troca palavra por palavra; aqui ficam as construções
// em que a decisão depende do que vem antes/depois — oralidade de sujeito (“a gente” +
// verbo), conector de fala abrindo a frase (“Aí eu fui”), repetição de “então”, a
// impessoal de relato (“você vê que”) e a redundância de tempo (“há três anos atrás”).
//
// O tom continua mandando: informal não opina; neutro só as redundâncias claras;
// formal aponta tudo. Citação (`>`) fica fora: quem escreveu está citando alguém.

import { getTone } from "../tone";
import { aGenteFix } from "../data/aGente";
import type { RuleCtx } from "./types";

/** A posição está numa linha de citação (`>`)? Regras de registro não entram em citação. */
export function emCitacao(mask: string, pos: number): boolean {
  const linha = mask.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  return mask.slice(linha, pos + 1).trimStart().startsWith(">");
}

/** A posição abre frase? (começo do texto, depois de . ! ? ou de quebra de linha) */
export function abreFrase(mask: string, pos: number): boolean {
  if (pos === 0) return true;
  const antes = mask.slice(0, pos);
  const corte = Math.max(antes.lastIndexOf("."), antes.lastIndexOf("!"), antes.lastIndexOf("?"), antes.lastIndexOf("\n"));
  return antes.slice(corte + 1).trim() === "";
}

/** Começa maiúscula naquela posição do texto? (preserva a caixa na sugestão) */
function ehMaiuscula(text: string, pos: number): boolean {
  const c = text[pos];
  return c !== undefined && c !== c.toLowerCase();
}

/** "analisou" → "Analisou-se" — a impessoal com "se" só é sugerida quando não há objeto logo depois. */
const SEM_IMPESSOAL = new Set(["é", "foi", "está", "estava", "era", "será", "estará", "seria", "estaria", "terá", "teria", "irá", "iria", "vai", "vem", "veio", "virá", "gosta", "gostou", "gostava", "gostaria"]);

function impessoalComSe(text: string, fim: number, verb: string, maiuscula: boolean): string | null {
  if (SEM_IMPESSOAL.has(verb.toLowerCase())) return null;
  // objeto logo depois mudaria a concordância ("a gente analisou os dados" → "analisaram-se os dados"):
  // só entra quando o verbo fecha a oração ou é seguido de "que" (oração desenvolvida).
  const seguinte = /^[^\S\n]*([\p{L}]+)?/u.exec(text.slice(fim))?.[1] ?? null;
  if (seguinte && seguinte.toLowerCase() !== "que") return null;
  const forma = `${verb}-se`;
  return maiuscula ? forma[0].toUpperCase() + forma.slice(1) : forma;
}

const PRONOMES = "eu|você|ele|ela|nós|vocês|eles|elas|a gente";

/**
 * “a gente” + verbo (oralidade de sujeito): a troca direta é “nós” + verbo conjugado;
 * quando o verbo fecha a oração (ou pede “que”), a impessoal com “se” entra como
 * segunda alternativa. Só no tom formal — no neutro, “a gente” fica em paz.
 */
export function aGente({ text, mask, push }: RuleCtx): void {
  if (getTone() !== "formal") return;
  const rx = /(?<![\p{L}])(a gente|A gente)([^\S\n]+([\p{L}]+))?/gu;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    if (emCitacao(mask, m.index)) continue;
    const phrase = m[1];
    const verb = m[3];
    const abre = abreFrase(mask, m.index);
    const quem = ehMaiuscula(text, m.index) || abre ? "Nós" : "nós";
    const plural = verb ? aGenteFix(verb) : null;
    const impessoal = verb ? impessoalComSe(text, m.index + m[0].length, verb, ehMaiuscula(text, m.index) || abre) : null;
    if (verb && (plural || impessoal)) {
      const troca = plural ? `${quem} ${plural}` : undefined;
      const alternativas = [impessoal, troca].filter((s): s is string => s !== undefined);
      push(
        m.index,
        m.index + m[0].length,
        `“${phrase} ${verb}” é informal — em texto formal use ` +
          [troca ? `“${troca}”` : null, impessoal ? `a impessoal “${impessoal}”` : null].filter(Boolean).join(" ou ") +
          "; risco: muda a pessoa do discurso",
        troca,
        alternativas,
        troca !== undefined,
        "oralidade"
      );
    } else {
      push(
        m.index,
        m.index + phrase.length,
        `“${phrase}” é informal — em texto formal use “${quem}” (ajuste o verbo); em trabalho acadêmico, prefira a impessoal (“analisou-se”, “este trabalho analisou”)`,
        undefined,
        [],
        false,
        "oralidade"
      );
    }
  }
}

/**
 * “Aí eu fui” / “Daí nós perdemos o prazo” — conector de fala abrindo a frase, com
 * sujeito logo depois. “aí” locativo (“aí está o problema”) não casa: precisa do sujeito.
 * A sugestão troca o conector E o sujeito (“Então, eu”), então o começo de frase já
 * sai com maiúscula.
 */
export function aiConector({ mask, push }: RuleCtx): void {
  if (getTone() !== "formal") return;
  const rx = new RegExp(`(?<![\\p{L}])(aí|Aí|daí|Daí)([^\\S\\n]*,?[^\\S\\n]*)(${PRONOMES})(?![\\p{L}])(?=[^\\S\\n]+[\\p{L}])`, "gu");
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    if (!abreFrase(mask, m.index)) continue;
    if (emCitacao(mask, m.index)) continue;
    // abrindo a frase a sugestão já sai com maiúscula ("Aí eu fui" → "Então, eu")
    const sugestoes = [`Então, ${m[3]}`, `Em seguida, ${m[3]}`];
    push(
      m.index,
      m.index + m[0].length,
      `“${m[1]}” abrindo a frase é oralidade — em texto formal use “então” ou “em seguida”; risco: muda a ligação entre as orações`,
      undefined,
      sugestoes,
      false,
      "oralidade"
    );
  }
}

/**
 * “Então” em texto formal: abrindo a frase com sujeito de fala pede conector de escrita;
 * repetido no mesmo parágrafo, o segundo em diante pede variação. No meio de uma
 * conclusão lógica (“se chove, então…”) ele fica — por isso não se mexe na 1ª vez.
 */
export function entaoConector({ mask, push }: RuleCtx): void {
  if (getTone() !== "formal") return;
  const rx = /(?<![\p{L}])então(?![\p{L}])/giu;
  const pronomeDepois = new RegExp(`^([^\\S\\n]*,?[^\\S\\n]*)(${PRONOMES})(?![\\p{L}])(?=[^\\S\\n]+[\\p{L}])`, "u");
  const doParagrafo = new Map<number, number>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    if (emCitacao(mask, m.index)) continue;
    const para = Math.max(0, mask.lastIndexOf("\n\n", Math.max(0, m.index - 1)) + 2);
    const contagem = (doParagrafo.get(para) ?? 0) + 1;
    doParagrafo.set(para, contagem);

    const sujeito = pronomeDepois.exec(mask.slice(m.index + m[0].length));
    if (abreFrase(mask, m.index) && sujeito) {
      // a sugestão troca o conector E o sujeito (“Então eu” → “Portanto, eu”):
      // o começo de frase já sai com maiúscula
      push(
        m.index,
        m.index + m[0].length + sujeito[0].length,
        "“então” abrindo a frase é oralidade — em texto formal use “portanto” ou “dessa forma”; risco: pode ser conclusão lógica",
        undefined,
        [`Portanto, ${sujeito[2]}`, `Dessa forma, ${sujeito[2]}`],
        false,
        "muleta"
      );
      continue;
    }
    if (contagem > 1) {
      push(
        m.index,
        m.index + m[0].length,
        `“então” repetido no parágrafo (${contagem}ª vez) — varie com “portanto”, “logo” ou “dessa forma”`,
        undefined,
        ["portanto", "logo", "dessa forma"],
        false,
        "muleta"
      );
    }
  }
}

/** “você vê que” / “vocês viram que” — 2ª pessoa de relato; a formal é impessoal. */
export function voceVeQue({ text, mask, push }: RuleCtx): void {
  if (getTone() !== "formal") return;
  const rx = /(?<![\p{L}])(você|vocês)[^\S\n]+(vê|veem|viu|viram)[^\S\n]+que(?![\p{L}])/giu;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    if (emCitacao(mask, m.index)) continue;
    const cap = ehMaiuscula(text, m.index) || abreFrase(mask, m.index);
    push(
      m.index,
      m.index + m[0].length,
      `“${m[0]}” é oralidade de 2ª pessoa — em texto formal use “observa-se que” ou “verifica-se que”; risco: muda a pessoa do discurso`,
      undefined,
      cap ? ["Observa-se que", "Verifica-se que"] : ["observa-se que", "verifica-se que"],
      false,
      "oralidade"
    );
  }
}

/** “há três anos atrás”: “há” e “atrás” dizem a mesma coisa — sobra um dos dois. */
export function haAtras({ text, mask, push }: RuleCtx): void {
  if (getTone() === "informal") return;
  const rx = /(?<![\p{L}])([Hh]á)[^\S\n]+([\p{L}\d]+)[^\S\n]+(anos?|meses?|dias?|semanas?|décadas?|horas?)[^\S\n]+atrás(?![\p{L}])/gu;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    if (emCitacao(mask, m.index)) continue;
    const ha = ehMaiuscula(text, m.index) || abreFrase(mask, m.index) ? "Há" : "há";
    push(
      m.index,
      m.index + m[0].length,
      `“${ha} ${m[2]} ${m[3]} atrás” é redundante — use “${ha} ${m[2]} ${m[3]}” (ou “${m[2]} ${m[3]} atrás”)`,
      `${ha} ${m[2]} ${m[3]}`,
      [],
      false,
      "redundancia"
    );
  }
}
