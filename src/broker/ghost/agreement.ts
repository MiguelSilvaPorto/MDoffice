// Concordância de gênero e número: depois de "o", "uma", "os", "das"… a palavra que vem tem de combinar.
// É uma regra simples (olha só o artigo/pronome logo antes e a terminação da candidata) usada para
// derrubar sugestões que não concordam ("a projeto", "os casa"). Em dúvida, não faz nada.

interface Agr {
  g: "m" | "f";
  n: "s" | "p";
}

const m = (n: "s" | "p"): Agr => ({ g: "m", n });
const f = (n: "s" | "p"): Agr => ({ g: "f", n });

/** Palavras que dizem gênero e número da palavra seguinte. ("nos", "a", "o" sozinhos são ambíguos, mas depois deles ainda vale.) */
const DETERMINERS: Record<string, Agr> = {};
for (const w of ["o", "um", "este", "esse", "aquele", "meu", "teu", "seu", "nosso", "vosso", "ao", "do", "no", "pelo", "dum", "num", "outro", "algum", "nenhum", "mesmo", "próprio", "cada"]) DETERMINERS[w] = m("s");
for (const w of ["a", "uma", "esta", "essa", "aquela", "minha", "tua", "sua", "nossa", "vossa", "à", "da", "na", "pela", "duma", "numa", "outra", "alguma", "nenhuma", "mesma", "própria"]) DETERMINERS[w] = f("s");
for (const w of ["os", "uns", "estes", "esses", "aqueles", "meus", "teus", "seus", "nossos", "aos", "dos", "pelos", "muitos", "vários", "alguns", "outros", "todos", "poucos", "diversos", "ambos", "nenhuns"]) DETERMINERS[w] = m("p");
for (const w of ["as", "umas", "estas", "essas", "aquelas", "minhas", "tuas", "suas", "nossas", "às", "das", "nas", "pelas", "muitas", "várias", "algumas", "outras", "todas", "poucas", "diversas", "ambas", "nenhumas"]) DETERMINERS[w] = f("p");

/** Palavras que terminam como substantivo mas não se comportam assim (ou são invariáveis). */
const SKIP = new Set(["para", "pela", "pelo", "pelas", "pelos", "mais", "menos", "uma", "umas", "essa", "essas", "esta", "estas", "isso", "aqui", "agora", "ainda", "sempre", "depois", "antes", "ontem", "hoje", "como", "quando", "onde", "mesmo", "mesma", "pois", "tudo", "nada", "todo", "toda", "todos", "todas", "outro", "outra", "dia", "dias", "mapa", "mapas", "planeta", "tema", "temas", "problema", "problemas", "sistema", "sistemas", "programa", "programas", "idioma", "idiomas", "clima", "poema", "cinema", "drama", "dilema", "grama", "gramas", "tele", "mão", "mãos", "foto", "fotos", "moto", "motos"]);

function shapeOf(w: string): Partial<Agr> | null {
  if (w.length < 4 || SKIP.has(w) || /[-\d]/.test(w)) return null;
  // número
  let n: "s" | "p" | undefined;
  if (/(ões|ães|ais|eis|ois|uis|ns|res|zes|ses)$/.test(w) || /[aeiou]s$/.test(w)) n = "p";
  else if (/[aeiouãõ]$|[rlzm]$|ão$/.test(w)) n = "s";
  // gênero (pelo singular)
  const sing = n === "p" ? w.replace(/(ões|ães)$/, "ão").replace(/ais$/, "al").replace(/eis$/, "el").replace(/ns$/, "m").replace(/(res|zes)$/, (x) => x.slice(0, -2)).replace(/s$/, "") : w;
  let g: "m" | "f" | undefined;
  if (/(ção|são|dade|gem|tude|ice|ura|eza|ância|ência|agem|ia)$/.test(sing)) g = "f";
  else if (/(mento|ismo|ário|or|ão)$/.test(sing)) g = sing.endsWith("ão") && !/(ção|são)$/.test(sing) ? "m" : "m";
  else if (/a$/.test(sing)) g = "f";
  else if (/o$/.test(sing)) g = "m";
  if (!n && !g) return null;
  return { g, n };
}

/** Quanto multiplicar a chance de `word` aparecer logo depois de `prev` (1 = sem opinião; <1 = não concorda). */
export function agreementFactor(prev: string | undefined, word: string): number {
  if (!prev) return 1;
  const det = DETERMINERS[prev];
  if (!det) return 1;
  const sh = shapeOf(word);
  if (!sh) return 1;
  let f = 1;
  if (sh.n && sh.n !== det.n) f *= 0.25;
  if (sh.g && sh.g !== det.g) f *= 0.3;
  return f;
}

/** Depois de um artigo/pronome com gênero e número claros: a palavra concorda? (null = não há artigo, ou não dá para saber) */
export function agrees(prev: string | undefined, word: string): boolean | null {
  const det = prev ? DETERMINERS[prev] : undefined;
  if (!det) return null;
  const sh = shapeOf(word);
  if (!sh || !sh.g || !sh.n) return false; // sem como confirmar o gênero: melhor não arriscar
  return sh.g === det.g && sh.n === det.n;
}
