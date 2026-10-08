// Expressões que soam melhor de outro jeito e conectivos que pedem vírgula.

/** Expressões que soam melhor de outro jeito. */
export const PHRASES: { rx: RegExp; fix: string; message: string }[] = [
  { rx: /\ba\s+n[íi]vel\s+de\b/gi, fix: "em nível de", message: "Prefira “em nível de” (e não “a nível de”)." },
  { rx: /\bno\s+sentido\s+de\b/gi, fix: "para", message: "“no sentido de” → prefira “para”." },
  { rx: /\bprimeiramente\b/gi, fix: "primeiro", message: "“primeiramente” → “primeiro” costuma ficar mais natural." },
  { rx: /\bdevido\s+ao\s+fato\s+de\s+que\b/gi, fix: "porque", message: "“devido ao fato de que” → use “porque”." },
  { rx: /\bcom\s+o\s+objetivo\s+de\b/gi, fix: "para", message: "“com o objetivo de” → “para” é mais direto." },
  { rx: /\bfazer\s+com\s+que\b/gi, fix: "fazer", message: "“fazer com que” pode virar só “fazer”." },
  { rx: /\bem\s+fun[çc][ãa]o\s+disso\b/gi, fix: "por isso", message: "“em função disso” → “por isso”." },
];

/** Conectivos que pedem vírgula quando abrem a frase. */
export const INTRO_CONNECTIVES = [
  "além disso",
  "além do mais",
  "por outro lado",
  "dessa forma",
  "dessa maneira",
  "desse modo",
  "sendo assim",
  "assim sendo",
  "no entanto",
  "portanto",
  "por isso",
  "por fim",
  "ou seja",
  "isto é",
  "em resumo",
  "em suma",
  "de modo geral",
  "via de regra",
  "por exemplo",
  "em primeiro lugar",
  "em segundo lugar",
  "por conseguinte",
  "consequentemente",
  "além disto",
  "diante disso",
];
