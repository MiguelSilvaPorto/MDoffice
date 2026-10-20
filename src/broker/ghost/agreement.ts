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

// ---------------------------------------------------------------- pessoa do verbo
// Depois de "eu" vem verbo na 1ª pessoa ("eu coloquei", "eu acho"), depois de "nós" o "-mos" etc.
// O modelo do idioma veio da Wikipédia (quase sem primeira pessoa) e guarda só os 12 sucessores mais
// comuns de cada palavra: sem esta regra, "eu colo" sugeria "colocar" (1314 ocorrências) e nunca
// "coloquei" (98). Para não confundir verbo com substantivo ("filho", "colocado"), a forma só conta
// como verbo se o infinitivo dela existe no vocabulário (coloquei → colocar).

type Pessoa = "eu" | "tu" | "ele" | "nos" | "eles";

const PRONOMES: Record<string, Pessoa> = {
  eu: "eu", tu: "tu", nós: "nos",
  ele: "ele", ela: "ele", você: "ele",
  eles: "eles", elas: "eles", vocês: "eles",
};

/** O que pode ficar entre o pronome e o verbo ("eu não fiz", "eu já tinha", "eu me lembro"). */
const ENTRE = new Set(["não", "já", "também", "ainda", "sempre", "nunca", "só", "me", "te", "se", "nos", "lhe", "o", "a", "os", "as", "mesmo", "realmente", "apenas", "quase", "até"]);

/** Verbos irregulares mais usados, por pessoa (a terminação não denuncia). */
const IRREGULARES: Record<Pessoa, string[]> = {
  eu: ["sou", "estou", "vou", "tenho", "faço", "digo", "posso", "quero", "vejo", "venho", "ponho", "sei", "fiz", "fui", "tive", "estive", "pude", "quis", "disse", "vim", "pus", "soube", "trouxe", "era", "tinha", "ia", "vinha", "estava", "podia", "queria", "sabia", "acho", "gosto", "preciso", "consigo", "sinto", "peço", "ouço", "durmo", "devo", "farei", "direi", "trarei"],
  tu: ["és", "estás", "vais", "tens", "fazes", "podes", "queres", "sabes", "foste", "tiveste", "fizeste", "disseste"],
  ele: ["é", "está", "vai", "tem", "faz", "diz", "pode", "quer", "vê", "vem", "põe", "sabe", "fez", "foi", "teve", "esteve", "pôde", "disse", "veio", "pôs", "trouxe", "era", "tinha", "ia", "vinha", "estava", "podia", "queria", "sabia", "deve", "precisa", "acha", "gosta"],
  nos: ["somos", "estamos", "vamos", "temos", "fazemos", "podemos", "queremos", "sabemos", "fomos", "tivemos", "fizemos", "éramos", "tínhamos", "estávamos", "íamos"],
  eles: ["são", "estão", "vão", "têm", "fazem", "dizem", "podem", "querem", "veem", "vêm", "sabem", "fizeram", "foram", "tiveram", "estiveram", "disseram", "vieram", "eram", "tinham", "iam", "estavam", "podiam", "queriam"],
};
const IRREG: Record<Pessoa, Set<string>> = Object.fromEntries(Object.entries(IRREGULARES).map(([k, v]) => [k, new Set(v)])) as Record<Pessoa, Set<string>>;
const TODOS_IRREG = new Set(Object.values(IRREGULARES).flat());

/** Terminações regulares de cada pessoa: [terminação, vogal temática possível do infinitivo]. */
const FORMAS: Record<Pessoa, [string, string[]][]> = {
  eu: [["ei", ["ar"]], ["arei", ["ar"]], ["erei", ["er"]], ["irei", ["ir"]], ["ava", ["ar"]], ["ia", ["er", "ir"]], ["i", ["er", "ir"]], ["o", ["ar", "er", "ir"]]],
  tu: [["aste", ["ar"]], ["este", ["er"]], ["iste", ["ir"]], ["as", ["ar"]], ["es", ["er", "ir"]]],
  ele: [["ou", ["ar"]], ["eu", ["er"]], ["iu", ["ir"]], ["ava", ["ar"]], ["ia", ["er", "ir"]], ["a", ["ar"]], ["e", ["er", "ir"]], ["ará", ["ar"]], ["erá", ["er"]], ["irá", ["ir"]]],
  nos: [["amos", ["ar"]], ["emos", ["er"]], ["imos", ["ir"]], ["ávamos", ["ar"]], ["íamos", ["er", "ir"]]],
  eles: [["aram", ["ar"]], ["eram", ["er"]], ["iram", ["ir"]], ["avam", ["ar"]], ["iam", ["er", "ir"]], ["am", ["ar"]], ["em", ["er", "ir"]], ["arão", ["ar"]], ["erão", ["er"]], ["irão", ["ir"]]],
};

/** O radical com a grafia do infinitivo (coloqu → coloc, chegu → cheg, comec → começ). */
function radicais(stem: string): string[] {
  const out = [stem];
  if (stem.endsWith("qu")) out.push(stem.slice(0, -2) + "c");
  if (stem.endsWith("gu")) out.push(stem.slice(0, -1));
  if (stem.endsWith("c")) out.push(stem.slice(0, -1) + "ç");
  if (stem.endsWith("j")) out.push(stem.slice(0, -1) + "g");
  return out;
}

/** `word` é uma forma verbal dessa pessoa (o infinitivo existe no vocabulário)? */
function formaDaPessoa(p: Pessoa, word: string, exists: (w: string) => boolean): boolean {
  if (IRREG[p].has(word)) return true;
  if (/(ado|ido|ada|ida|ção|mento|dade)$/.test(word)) return false; // particípio/substantivo
  for (const [fim, vogais] of FORMAS[p]) {
    if (!word.endsWith(fim) || word.length - fim.length < 2) continue;
    for (const r of radicais(word.slice(0, -fim.length))) for (const v of vogais) if (exists(r + v)) return true;
  }
  return false;
}

/** A pessoa do sujeito logo antes do cursor (com "não", "já", "me"… no meio), ou null. */
export function pessoaDoSujeito(tokens: readonly string[]): Pessoa | null {
  let i = tokens.length - 1;
  let pulou = 0;
  while (i >= 0 && ENTRE.has(tokens[i]) && pulou < 2) {
    i--;
    pulou++;
  }
  if (i < 0) return null;
  if (tokens[i] === "gente" && tokens[i - 1] === "a") return "ele";
  return PRONOMES[tokens[i]] ?? null;
}

/**
 * Quanto multiplicar a chance de `word` depois do sujeito `p` (1 = sem opinião): verbo da pessoa
 * certa sobe muito; verbo de outra pessoa, infinitivo e substantivo descem (logo depois de "eu",
 * quase sempre vem verbo). Advérbios e pronomes oblíquos ("não", "já", "me") ficam neutros.
 */
export function personFactor(p: Pessoa | null, word: string, exists: (w: string) => boolean): number {
  if (!p || word.length < 2 || ENTRE.has(word) || word === ",") return 1;
  if (formaDaPessoa(p, word, exists)) return 6;
  if (TODOS_IRREG.has(word)) return 0.3; // irregular de outra pessoa ("eu foi")
  return 0.35;
}
