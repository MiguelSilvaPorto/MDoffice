// Vírgulas, quebra de frases longas e ponto final.

import type { RuleCtx } from "./types";
import { PHRASES, INTRO_CONNECTIVES, ADVERBIAIS_VIRGULA } from "../data/phrases";

/** Expressões que pedem vírgula dos DOIS lados. */
export function commasAroundExpressions({ text, mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // Expressões explicativas/intercaladas: pedem vírgula dos dois lados.
  // Os limites são por letra/dígito (e não \b, que não enxerga acentos:
  // "isto é" nunca casava).
  //
  // As conjunções adversativas ("porém", "contudo", "entretanto", "todavia")
  // NÃO entram aqui de propósito: quem cuida delas é `adversativeComma`, que pede
  // a vírgula de antes (a obrigatória). Com as duas regras ligadas, "mas" e "porém"
  // recebiam vírgula antes E depois, e aí a vírgula chegava duplicada.
  const entreVirgulas = /(?<![\p{L}\d])(ou seja|isto é|por exemplo|em outras palavras|ou melhor|no entanto|portanto|além disso|além do mais)(?![\p{L}\d])/giu;
  while ((m = entreVirgulas.exec(mask)) !== null) {
    const ini = m.index;
    const fim = ini + m[0].length;
    // o espaço antes da expressão entra no trecho trocado (senão sobrava “ ,”)
    const espacoAntes = /[^\S\n]/.test(text.slice(Math.max(0, ini - 1), ini));
    const de = ini - (espacoAntes ? 1 : 0);
    const antes = text.slice(Math.max(0, de - 1), de);
    const depois = text.slice(fim, fim + 1);
    if (!/[\p{L}\d)\]"'»]$/u.test(antes)) continue; // começo de linha/pontuação: outra regra cuida
    if (depois === ",") continue; // já tem vírgula depois
    if (depois === "" || depois === "\n") continue; // fim de linha: a vírgula ficaria solta
    // “Além disso” maiúsculo depois de palavra minúscula é frase nova: quem cuida é a regra de frases coladas
    if (/[A-ZÁÀÂÃÉÊÍÓÔÕÚ]/.test(m[0][0]) && /[\p{Ll}\d]/u.test(antes)) continue;
    push(de, fim, `Em volta de “${m[0]}” costumam vir vírgulas`, `, ${m[0]},`, [], false);
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
      push(ini, fim, "Frase muito comprida: comece nova frase aqui", `. ${comMaiuscula}`, [], false, "quebra-frase");
    }
  }
}

/** Trecho comprido sem nenhuma pontuação. */
export function longRunWithoutPunct({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // trecho comprido sem NENHUMA pontuação: falta vírgula/ponto entre as orações.
  // Quando dá para achar um ponto seguro (antes de um pronome-sujeito que abre
  // oração), vira uma sugestão de quebra; senão, só avisa — quebrar orações no
  // escuro precisa de leitura humana.
  const semPontoRx = /(?<![\p{L}\d])[\p{L}\d]+(?:\s+[\p{L}\d]+){24,}/gu;
  while ((m = semPontoRx.exec(mask)) !== null) {
    const inicio = m.index;
    const esperto = pontoSeguro(m[0]);
    if (esperto) {
      const from = inicio + esperto.espaco;
      const pron = esperto.pronome;
      push(
        from,
        from + 1 + pron.length,
        "Trecho muito longo sem pontuação: comece uma frase nova aqui",
        `. ${pron[0].toUpperCase()}${pron.slice(1)}`,
        [],
        false,
        "trecho-longo"
      );
      continue;
    }
    // Sem quebra segura: só avisa — e a marca cobre o TRECHO INTEIRO, porque é dele que a
    // mensagem fala (antes eram 60 caracteres, e parecia que o aviso apontava outra coisa).
    push(
      inicio,
      inicio + m[0].length,
      "Esse trecho está muito longo sem vírgulas nem pontos — separe em orações (frases curtas leem melhor e a IA entende melhor)",
      undefined,
      [],
      false,
      "trecho-longo"
    );
  }
}

/** Vírgula antes de “mas”, “porém”, “contudo”… */
export function adversativeComma({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // A adversativa coordenativa pede a vírgula de ANTES ("entregou o projeto, entretanto
  // faltou teste"). A segunda vírgula ("..., entretanto, ...") é aceita quando a
  // conjunção vem intercalada, mas o app só emite a que é obrigatória em qualquer
  // leitura — é a mesma decisão do corpus (caso 16, "porém") e do commit que tirou as
  // adversativas da regra de expressões: com as duas regras no mesmo trecho, "mas" e
  // "porém" recebiam vírgula antes E depois, e aí a vírgula chegava duplicada.
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
 * Palavra que pode continuar a expressão ("no começo DE tudo", "com o tempo LIVRE"):
 * nesses casos a vírgula depois da expressão entraria no lugar errado.
 */
export const CONTINUA_EXPRESSAO = new Set([
  "de", "do", "da", "dos", "das", "para", "pra", "por", "com", "sem", "em", "no", "na", "nos", "nas",
  "que", "qual", "quais", "cujo", "cuja", "cujos", "cujas",
  "mais", "menos", "muito", "muita", "muitos", "muitas", "pouco", "pouca", "poucos", "poucas",
  "todo", "toda", "todos", "todas",
  "livre", "livres", "passado", "passada", "futuro", "futura", "inteiro", "inteira",
  "curto", "curta", "longo", "longa", "vago", "vaga", "disponível", "suficiente", "necessário",
]);

/** Há pelo menos `min` palavras desde a última pontuação até `pos`? (oração já desenvolvida) */
function trechoDesenvolvido(mask: string, pos: number, min: number): boolean {
  let inicio = pos;
  while (inicio > 0 && !/[.!?\n]/.test(mask[inicio - 1])) inicio--;
  return (mask.slice(inicio, pos).match(/[\p{L}\d]+/gu) ?? []).length >= min;
}

/**
 * Vírgula depois das expressões adverbiais de tempo/modo:
 *  - abrindo a frase: "Com o tempo, era…";
 *  - retomando a oração num trecho já desenvolvido: "…revisar hoje em dia, eu quero…".
 */
export function adverbialComma({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  for (const expr of ADVERBIAIS_VIRGULA) {
    // 1) abrindo a frase
    const abertura = new RegExp(`(?:^|[.!?]\\s+|\\n)(${expr})(?=\\s+[\\p{L}])`, "giu");
    while ((m = abertura.exec(mask)) !== null) {
      const matched = m[1];
      const start = m.index + (m[0].length - matched.length);
      const fim = start + matched.length;
      if (mask.slice(fim, fim + 1) === ",") continue;
      const seguinte = (/[\p{L}]+/u.exec(mask.slice(fim))?.[0] ?? "").toLowerCase();
      if (CONTINUA_EXPRESSAO.has(seguinte)) continue;
      push(start, fim, `Depois de “${matched}” costuma vir uma vírgula`, `${matched},`, [`${matched},`]);
    }
    // 2) retomando a oração (pronome-sujeito logo depois), num trecho já desenvolvido
    const meio = new RegExp(`\\s(${expr})\\s(?=(a gente|vocês|você|eles|elas|nós|ele|ela|eu|tu)(?=\\s+[\\p{L}]))`, "giu");
    while ((m = meio.exec(mask)) !== null) {
      const matched = m[1];
      const start = m.index + 1;
      if (!trechoDesenvolvido(mask, start, 6)) continue;
      push(start, start + matched.length, `Depois de “${matched}” costuma vir uma vírgula`, `${matched},`, [`${matched},`]);
    }
  }
}

/**
 * Palavras que, antes do pronome, indicam que ele NÃO abre oração nova
 * (subordinação, preposição, coordenação, advérbio…): o ponto não entra ali.
 */
export const ANTES_DO_PRONOME = new Set([
  "que", "se", "para", "pra", "por", "de", "do", "da", "dos", "das", "com", "sem", "em", "no", "na", "nos", "nas",
  "ao", "aos", "à", "às", "um", "uma", "quando", "porque", "enquanto", "como", "conforme", "segundo", "só", "até",
  "mas", "e", "ou", "nem", "entre", "sobre", "me", "te", "lhe", "nos", "vos", "também", "ainda", "já", "não", "nem",
  "talvez", "sempre", "nunca", "depois", "antes", "então", "aí", "aqui", "ali", "lá", "hoje", "ontem", "amanhã", "agora",
]);

/** O pronome-sujeito que abre oração nova (a regex é compilada uma vez: a checagem roda a cada pausa). */
const RX_PRONOME = /(?<=[\p{L}\d])(\s+)(a gente|vocês|você|eles|elas|nós|ele|ela|eu|tu)(?=\s+[\p{L}])/giu;

/**
 * Ponto seguro dentro de um trecho comprido: antes de um pronome-sujeito que abre
 * oração nova (o pronome não pode vir logo depois de subordinante/preposição) e
 * já depois de a oração se desenvolver. Fica de fora quando quem manda é a
 * vírgula dos adverbiais ("…hoje em dia, eu…").
 */
function pontoSeguro(run: string): { espaco: number; pronome: string } | null {
  let m: RegExpExecArray | null;
  while ((m = RX_PRONOME.exec(run)) !== null) {
    const antes = run.slice(0, m.index);
    const palavra = (/([\p{L}]+)$/u.exec(antes)?.[1] ?? "").toLowerCase();
    if (ANTES_DO_PRONOME.has(palavra)) continue;
    if ((antes.match(/[\p{L}\d]+/gu) ?? []).length < 8) continue;
    if (ADVERBIAIS_VIRGULA.some((e) => antes.toLowerCase().endsWith(e))) continue; // a vírgula do adverbial cuida
    return { espaco: m.index, pronome: m[2] };
  }
  return null;
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
        push(start, lineEnd, "Falta o ponto final no fim do parágrafo", `${text.slice(start, lineEnd)}.`, [], false, "ponto-final");
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
