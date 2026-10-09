// Vírgulas, quebra de frases longas e ponto final.

import type { RuleCtx } from "./types";
import { PHRASES, INTRO_CONNECTIVES } from "../data/phrases";

/** Expressões que pedem vírgula dos DOIS lados. */
export function commasAroundExpressions({ text, mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // expressões que pedem vírgula dos DOIS lados (no meio da frase)
  const entreVirgulas = /\b(ou seja|isto é|por exemplo|em outras palavras|ou melhor|no entanto|porém|contudo|entretanto|todavia|portanto|além disso|além do mais)\b/giu;
  while ((m = entreVirgulas.exec(mask)) !== null) {
    const ini = m.index;
    const fim = ini + m[0].length;
    const antes = text.slice(Math.max(0, ini - 1), ini);
    const depois = text.slice(fim, fim + 1);
    if (antes === "," || depois === "," || antes === "\n" || antes === "") continue;
    if (ini === 0 || text.slice(Math.max(0, ini - 1), ini) === "\n") continue; // começo de linha: outra regra cuida
    push(ini, fim, `Em volta de “${m[0]}” costumam vir vírgulas`, `, ${m[0]},`, [], false);
  }
}

/** Frase muito comprida: quebra em pontos seguros. */
export function safeSentenceBreak({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // Frase muito comprida: propõe a quebra em pontos SEGUROS — antes de "e" (nova frase)
  // e antes de "como" (introduz exemplos). Só depois de 12+ palavras sem pontuação, e como
  // sugestão de troca (não mexe enquanto você digita; entra na pausa/salvar/Corrigir tudo).
  const quebraSegura = /(?<![\p{L},;:])((?:[\p{L}][\p{L}']*\s+){11,}?)(e|como)\s+([\p{L}])/giu;
  while ((m = quebraSegura.exec(mask)) !== null) {
    const conj = m[2];
    const ini = Math.max(0, m.index + m[1].length - 1); // inclui o espaço antes da conjunção
    const fim = ini + 1 + conj.length;
    if (conj.toLowerCase() === "como") {
      push(ini, fim, "Antes de “como” (exemplos) costuma vir vírgula", `, ${conj}`, [], false);
    } else {
      const comMaiuscula = conj[0].toUpperCase() + conj.slice(1);
      push(ini, fim, "Frase muito comprida: comece nova frase aqui", `. ${comMaiuscula}`, [], false);
    }
  }
}

/** Trecho comprido sem nenhuma pontuação. */
export function longRunWithoutPunct({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // trecho comprido sem NENHUMA pontuação: falta vírgula/ponto entre as orações
  // (não tenta adivinhar onde: só avisa — quebrar orações precisa de leitura humana)
  const semPontoRx = /(?<![\p{L}\d])[\p{L}\d]+(?:\s+[\p{L}\d]+){24,}/gu;
  while ((m = semPontoRx.exec(mask)) !== null) {
    const inicio = m.index;
    const fim = inicio + Math.min(m[0].length, 60);
    push(
      inicio,
      fim,
      "Esse trecho está muito longo sem vírgulas nem pontos — separe em orações (frases curtas leem melhor e a IA entende melhor)",
      undefined,
      [],
      false
    );
  }
}

/** Vírgula antes de “mas”, “porém”, “contudo”… */
export function adversativeComma({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // vírgula antes de "mas", "porém", "contudo"…
  const adversativeRx = /(?<![\p{L},;:\n])([\p{L}]{2,})\s+(mas|porém|contudo|entretanto|todavia)(?![\p{L}])/giu;
  while ((m = adversativeRx.exec(mask)) !== null) {
    const conjStart = m.index + m[0].length - m[2].length;
    const wsStart = m.index + m[1].length;
    push(wsStart, conjStart + m[2].length, `Falta vírgula antes de “${m[2]}”`, `, ${m[2]}`, [`, ${m[2]}`]);
  }
}

/** Vírgula depois de conectivos no começo da frase. */
export function introConnectiveComma({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // vírgula depois de conectivos no começo da frase
  for (const conn of INTRO_CONNECTIVES) {
    const rx = new RegExp(`(?:^|[.!?]\\s+|\\n)(${conn})(?=\\s+[\\p{L}])`, "giu");
    while ((m = rx.exec(mask)) !== null) {
      const matched = m[1];
      const start = m.index + (m[0].length - matched.length);
      push(start, start + matched.length, `Depois de “${matched}” costuma vir uma vírgula`, `${matched},`, [`${matched},`]);
    }
  }
}

/**
 * Palavras que NUNCA terminam uma frase (artigos, preposições, conjunções, pronomes relativos…): se o parágrafo
 * acaba numa delas, a frase está incompleta e o ponto final não entra.
 */
export const NAO_TERMINAM_FRASE = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "ao", "aos", "à", "às",
  "de", "do", "da", "dos", "das", "dum", "duma", "em", "no", "na", "nos", "nas", "num", "numa",
  "por", "pelo", "pela", "pelos", "pelas", "per", "para", "pra", "com", "sem", "sob", "sobre", "entre", "até", "desde", "perante", "após", "contra", "ante",
  "e", "ou", "mas", "nem", "que", "se", "como", "quando", "porque", "pois", "porém", "onde", "qual", "quais", "cujo", "cuja", "cujos", "cujas", "quanto", "quanta", "quantos", "quantas",
  "seu", "sua", "seus", "suas", "meu", "minha", "meus", "minhas", "teu", "tua", "nosso", "nossa", "nossos", "nossas",
  "este", "esta", "estes", "estas", "esse", "essa", "esses", "essas", "aquele", "aquela", "aqueles", "aquelas",
  "também", "ainda", "já", "mais", "menos", "muito", "pouco", "todo", "toda", "todos", "todas", "cada", "outro", "outra", "outros", "outras", "ser", "estar", "ter", "haver", "foi", "são", "está", "estão", "tem", "têm", "vai", "vão", "pode", "podem", "deve", "devem",
]);

/** Ponto final faltando no fim do parágrafo. */
export function missingFinalPeriod({ text, mask, push }: RuleCtx): void {
  // ponto final faltando em parágrafos
  {
    const lines = text.split("\n");
    const maskLines = mask.split("\n");
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = (maskLines[i] ?? "").trim();
      const words = trimmed.split(/\s+/).filter(Boolean).length;
      const skip = trimmed === "" || /^[#>\-*+\d|`<]/.test(trimmed) || /[|:]\s*$/.test(trimmed);
      const endsOk = /[.!?:;…)\]"'»]$/.test(trimmed);
      // o ponto só falta no FIM DO PARÁGRAFO: se a linha de baixo continua o texto,
      // a frase segue ali (é escrita "quebrada" em várias linhas) — não é erro
      const proxima = (maskLines[i + 1] ?? "").trim();
      const proximaCrua = (lines[i + 1] ?? "").trim();
      const fimDeParagrafo =
        i + 1 >= lines.length ||
        proxima === "" ||
        proximaCrua === "" ||
        /^([#>|`]|!\[|[-*+]\s|\d+\.\s|```)/.test(proximaCrua);
      const ultima = (/([\p{L}]+)$/u.exec(trimmed)?.[1] ?? "").toLowerCase();
      // frase incompleta (termina em "de", "para", "e", "que"…): ainda está sendo escrita, não fecha com ponto
      if (!skip && fimDeParagrafo && words >= 3 && !endsOk && /[\p{L}\d]$/u.test(trimmed) && !NAO_TERMINAM_FRASE.has(ultima)) {
        const lineEnd = offset + raw.trimEnd().length;
        const wm = /[\p{L}\d]+$/u.exec(text.slice(offset, lineEnd));
        const start = lineEnd - (wm ? wm[0].length : 1);
        push(start, lineEnd, "Falta o ponto final no fim do parágrafo", `${text.slice(start, lineEnd)}.`, []);
      }
      offset += raw.length + 1;
    }
  }
}

/**
 * Vírgula antes de conjunções que abrem uma oração subordinada, em frases mais longas ("..., pois", "..., embora").
 * Só entra onde quase sempre pede vírgula: "pois", "embora", "enquanto", "já que", "visto que", "uma vez que", "ainda que",
 * "mesmo que", "de modo que", "de forma que"; e "porque" só em frase bem comprida (curtas costumam ficar sem vírgula).
 */
export function subordinateComma({ mask, push }: RuleCtx): void {
  const CONJ: [string, number][] = [
    ["pois", 3],
    ["embora", 4],
    ["enquanto", 6],
    ["já que", 4],
    ["visto que", 4],
    ["uma vez que", 4],
    ["ainda que", 4],
    ["mesmo que", 5],
    ["de modo que", 5],
    ["de forma que", 5],
    ["porque", 11],
  ];
  const sentenceRx = /[^.!?\n]+/g;
  let s: RegExpExecArray | null;
  while ((s = sentenceRx.exec(mask)) !== null) {
    const sentence = s[0];
    for (const [conj, minBefore] of CONJ) {
      const rx = new RegExp(`(?<=[\\p{L}\\d])(\\s+)(${conj})(?=\\s+[\\p{L}])`, "giu");
      let m: RegExpExecArray | null;
      while ((m = rx.exec(sentence)) !== null) {
        const before = sentence.slice(0, m.index);
        const prevWord = (/([\p{L}]+)$/u.exec(before)?.[1] ?? "").toLowerCase();
        if (["e", "ou", "nem", "mas", "só", "mesmo", "até"].includes(prevWord)) continue; // "e porque…", "só porque…", "até que…"
        const nBefore = (before.match(/[\p{L}][\p{L}'-]*/gu) ?? []).length;
        if (nBefore < minBefore) continue;
        if (/,\s*$/.test(before)) continue;
        const start = s.index + m.index;
        push(start, start + m[1].length + m[2].length, `Costuma vir vírgula antes de “${m[2]}”`, `, ${m[2]}`, [], false);
      }
    }
  }
}
