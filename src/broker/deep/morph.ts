// Morfologia mínima do português para trocar uma palavra por sinônimo SEM mudar a forma:
// "fazemos" → (fazer, 1ª pessoa do plural) → "realizamos"; "problemas" → (problema, plural) → "questões".
// Só entende verbos regulares e plural/feminino comuns. O resultado sempre é conferido contra o vocabulário do
// idioma (ver `valid`), então, quando a forma gerada não existe, a troca é simplesmente descartada.

export type VerbClass = "ar" | "er" | "ir";

export type Tag = { kind: "verb"; cls: VerbClass; form: string } | { kind: "noun"; plural: boolean; fem: boolean };

/** terminações dos verbos regulares, depois de tirar "ar/er/ir" do infinitivo */
const ENDINGS: Record<VerbClass, Record<string, string>> = {
  ar: {
    inf: "ar", ger: "ando", pms: "ado", pfs: "ada", pmp: "ados", pfp: "adas",
    pr1s: "o", pr2s: "as", pr3s: "a", pr1p: "amos", pr3p: "am",
    pt1s: "ei", pt2s: "aste", pt3s: "ou", pt1p: "amos", pt3p: "aram",
    im1s: "ava", im2s: "avas", im1p: "ávamos", im3p: "avam",
    fu1s: "arei", fu3s: "ará", fu1p: "aremos", fu3p: "arão",
    co1s: "aria", co2s: "arias", co1p: "aríamos", co3p: "ariam",
    su1s: "e", su2s: "es", su1p: "emos", su3p: "em",
  },
  er: {
    inf: "er", ger: "endo", pms: "ido", pfs: "ida", pmp: "idos", pfp: "idas",
    pr1s: "o", pr2s: "es", pr3s: "e", pr1p: "emos", pr3p: "em",
    pt1s: "i", pt2s: "este", pt3s: "eu", pt1p: "emos", pt3p: "eram",
    im1s: "ia", im2s: "ias", im1p: "íamos", im3p: "iam",
    fu1s: "erei", fu3s: "erá", fu1p: "eremos", fu3p: "erão",
    co1s: "eria", co2s: "erias", co1p: "eríamos", co3p: "eriam",
    su1s: "a", su2s: "as", su1p: "amos", su3p: "am",
  },
  ir: {
    inf: "ir", ger: "indo", pms: "ido", pfs: "ida", pmp: "idos", pfp: "idas",
    pr1s: "o", pr2s: "es", pr3s: "e", pr1p: "imos", pr3p: "em",
    pt1s: "i", pt2s: "iste", pt3s: "iu", pt1p: "imos", pt3p: "iram",
    im1s: "ia", im2s: "ias", im1p: "íamos", im3p: "iam",
    fu1s: "irei", fu3s: "irá", fu1p: "iremos", fu3p: "irão",
    co1s: "iria", co2s: "irias", co1p: "iríamos", co3p: "iriam",
    su1s: "a", su2s: "as", su1p: "amos", su3p: "am",
  },
};

/** verbos muito irregulares: nunca gera formas deles */
const IRREGULAR = new Set(["ser", "estar", "ir", "ter", "haver", "vir", "pôr", "ver", "dar", "ler", "crer", "rir", "dizer", "fazer", "trazer", "poder", "querer", "saber", "caber", "valer", "medir", "pedir", "ouvir", "sair", "cair", "seguir", "vestir", "dormir", "subir", "sentir"]);

/** Formas de verbos irregulares muito repetidos (só para reconhecer o que foi escrito; nunca para gerar). */
const IRREGULAR_FORMS: Record<string, Record<string, string>> = {
  fazer: { fazer: "inf", fazendo: "ger", feito: "pms", feita: "pfs", feitos: "pmp", feitas: "pfp", faço: "pr1s", faz: "pr3s", fazemos: "pr1p", fazem: "pr3p", fiz: "pt1s", fez: "pt3s", fizemos: "pt1p", fizeram: "pt3p", fazia: "im1s", fazíamos: "im1p", faziam: "im3p", farei: "fu1s", fará: "fu3s", faremos: "fu1p", farão: "fu3p", faria: "co1s", fariam: "co3p", faça: "su1s", façamos: "su1p", façam: "su3p" },
};

export interface Lemma {
  lemma: string;
  tag: Tag;
}

/** Todas as leituras possíveis de uma palavra como forma de uma palavra do dicionário (`known`). */
export function analyze(word: string, known: (lemma: string) => boolean): Lemma[] {
  const out: Lemma[] = [];
  // verbos irregulares conhecidos
  for (const [lemma, table] of Object.entries(IRREGULAR_FORMS)) {
    const form = table[word];
    if (form && known(lemma)) out.push({ lemma, tag: { kind: "verb", cls: "er", form } });
  }
  // verbos regulares
  for (const cls of ["ar", "er", "ir"] as VerbClass[]) {
    for (const [form, end] of Object.entries(ENDINGS[cls])) {
      if (!word.endsWith(end) || word.length - end.length < 2) continue;
      const lemma = word.slice(0, word.length - end.length) + cls;
      if (!IRREGULAR.has(lemma) && known(lemma)) out.push({ lemma, tag: { kind: "verb", cls, form } });
    }
  }
  // substantivos e adjetivos: singular, plural, feminino
  const bases: { lemma: string; plural: boolean; fem: boolean }[] = [{ lemma: word, plural: false, fem: false }];
  if (word.endsWith("s")) {
    const pl: string[] = [];
    if (word.endsWith("ões") || word.endsWith("ães") || word.endsWith("ãos")) pl.push(word.slice(0, -3) + "ão");
    if (word.endsWith("ais")) pl.push(word.slice(0, -3) + "al");
    if (word.endsWith("eis")) pl.push(word.slice(0, -3) + "el");
    if (word.endsWith("ns")) pl.push(word.slice(0, -2) + "m");
    if (/(res|zes|ses)$/.test(word)) pl.push(word.slice(0, -2));
    pl.push(word.slice(0, -1));
    for (const l of pl) bases.push({ lemma: l, plural: true, fem: false });
  }
  for (const b of [...bases]) {
    if (b.lemma.endsWith("a")) bases.push({ lemma: b.lemma.slice(0, -1) + "o", plural: b.plural, fem: true });
  }
  for (const b of bases) if (known(b.lemma)) out.push({ lemma: b.lemma, tag: { kind: "noun", plural: b.plural, fem: b.fem } });
  return out;
}

/** Flexiona `lemma` do mesmo jeito indicado por `tag`. Devolve null se não souber. */
export function inflect(lemma: string, tag: Tag): string | null {
  if (tag.kind === "verb") {
    const cls = lemma.slice(-2) as VerbClass;
    if (!(cls in ENDINGS) || IRREGULAR.has(lemma) || lemma.length < 4) return null;
    const end = ENDINGS[cls][tag.form];
    if (!end) return null;
    let stem = lemma.slice(0, -2);
    // mudanças de grafia para manter o som (comecar → comece, chegar → chegue, dirigir → dirija)
    if (tag.form.startsWith("su") || tag.form === "pt1s" || (cls === "ir" && tag.form === "pr1s")) {
      if (stem.endsWith("c") && /^[ei]/.test(end) && cls !== "ir") stem = stem.slice(0, -1) + "qu";
      else if (stem.endsWith("ç") && /^[ei]/.test(end)) stem = stem.slice(0, -1) + "c";
      else if (stem.endsWith("g") && /^[ei]/.test(end) && cls === "ar") stem = stem + "u";
      else if (stem.endsWith("g") && /^[ao]/.test(end) && cls === "ir") stem = stem.slice(0, -1) + "j";
    }
    return stem + end;
  }
  let w = lemma;
  if (tag.fem && w.endsWith("o")) w = w.slice(0, -1) + "a";
  if (tag.plural) {
    if (w.endsWith("ão")) w = w.slice(0, -2) + "ões";
    else if (w.endsWith("al")) w = w.slice(0, -2) + "ais";
    else if (w.endsWith("el")) w = w.slice(0, -2) + "eis";
    else if (w.endsWith("m")) w = w.slice(0, -1) + "ns";
    else if (/[rz]$/.test(w)) w += "es";
    else if (w.endsWith("s")) return null;
    else w += "s";
  }
  return w;
}
