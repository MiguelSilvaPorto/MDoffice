// Formas curtas que mantêm o sentido do trecho: perífrases ("com o objetivo de" → "para")
// e palavras longas com equivalente curto ("posteriormente" → "depois").
//
// Curado à mão: só entra o que não muda o sentido nem a concordância — a troca é uma
// sugestão ("Encurtar: …"), nunca uma correção automática. Cada entrada economiza 2+ letras.

export const ENCURTAMENTOS: [string, string][] = [
  // finalidade
  ["com o objetivo de", "para"],
  ["com a finalidade de", "para"],
  ["com o propósito de", "para"],
  ["com a intenção de", "para"],
  ["com o intuito de", "para"],
  ["no sentido de", "para"],
  // causa
  ["devido ao fato de que", "porque"],
  ["pelo fato de que", "porque"],
  // assunto
  ["no que diz respeito a", "sobre"],
  ["com relação a", "sobre"],
  ["em relação a", "sobre"],
  ["a respeito de", "sobre"],
  // capacidade/possibilidade
  ["tem a capacidade de", "pode"],
  ["têm a capacidade de", "podem"],
  ["tem a possibilidade de", "pode"],
  ["têm a possibilidade de", "podem"],
  ["é capaz de", "pode"],
  ["são capazes de", "podem"],
  ["ser capaz de", "poder"],
  ["serem capazes de", "poderem"],
  // verbo + substantivo → verbo (só as que consomem a preposição: "fazer uso de X" → "usar X")
  ["levar em consideração", "considerar"],
  ["levar em conta", "considerar"],
  ["fazer uso de", "usar"],
  ["fazer uso do", "usar o"],
  ["fazer uso da", "usar a"],
  // frequência/modo
  ["na maioria das vezes", "quase sempre"],
  ["no final das contas", "no fim"],
  ["de modo geral", "em geral"],
  ["de maneira geral", "em geral"],
  // palavras longas com equivalente curto
  ["posteriormente", "depois"],
  ["anteriormente", "antes"],
  ["atualmente", "hoje"],
  ["exclusivamente", "só"],
  ["imediatamente", "já"],
  ["possivelmente", "talvez"],
  ["praticamente", "quase"],
  ["extremamente", "muito"],
  ["rapidamente", "depressa"],
  ["adicionalmente", "também"],
  ["consequentemente", "por isso"],
];
