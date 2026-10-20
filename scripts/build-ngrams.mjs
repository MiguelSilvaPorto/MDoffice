// Gera o modelo de idioma da sugestão de palavras (public/ngrams/pt.json) a partir de textos em português.
// Só guarda CONTAGENS de palavras e sequências de 2–3 palavras (nenhum texto do corpus é copiado).
//
// Uso:  node scripts/build-ngrams.mjs <saida.json> <corpus1.txt|pasta> [corpus2.txt ...] [--holdout=20 --test=<teste.txt>]
//   --holdout=N  separa 1 parágrafo a cada N para um arquivo de teste (--test=...), fora do modelo
//   --vocab=N    tamanho do vocabulário (padrão 22000)
//   --trimin=N   descarta contextos de trigrama com menos de N ocorrências (padrão 4)
//   --bi=N --tri=N  quantas palavras seguintes guardar por contexto (padrão 12 e 5)
//
// Uma PASTA vale como o conjunto dos `*.txt` dentro dela (o corpus baixado por
// `baixar-corpus.mjs` passa de mil arquivos: na linha de comando não caberia).
import fs from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [out, ...entradas] = args.filter((a) => !a.startsWith("--"));
const inputs = entradas.flatMap((caminho) => {
  if (!fs.statSync(caminho).isDirectory()) return [caminho];
  return fs
    .readdirSync(caminho)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => join(caminho, f));
});
if (!out || !inputs.length) {
  console.error("uso: node scripts/build-ngrams.mjs <saida.json> <corpus.txt|pasta> [...] [--holdout=N --test=arquivo --vocab=N --bi=12 --tri=5]");
  process.exit(1);
}
const VOCAB = +(opt.vocab ?? 22000);
const HOLD = +(opt.holdout ?? 0);
const TRI_MIN = +(opt.trimin ?? 4); // contextos de trigrama com menos ocorrências que isso são descartados (modelo menor)
// quantas palavras seguintes guardar por contexto: o padrão (12/5) é o pt.json, de onde saem os
// arquivos do corretor; os modelos maiores da sugestão (pt-40/80/160.json) passam --bi/--tri
const BI_TOP = +(opt.bi ?? 12);
const TRI_TOP = +(opt.tri ?? 5);

const BOUNDARY = "<s>";
const COMMA = ",";
const NUM = "#";
const WORD = /[A-Za-zÀ-ÿ]+(?:-[A-Za-zÀ-ÿ]+)*|\d+(?:[.,]\d+)*|,/g;

// Pré-passagem: o texto da web tem muita gente escrevendo sem acento ("voce", "nao", "relatorio"). Quando a grafia sem
// acento é bem mais rara (15x ou mais) que a acentuada, ela é erro de digitação: conta como a palavra certa e não entra
// no vocabulário (assim a correção de digitação do app ainda reconhece "voce" como erro). "esta/está", "pais/país" ficam,
// porque as duas grafias são palavras de verdade e têm frequência parecida.
const fixAccent = new Map();
{
  const pre = new Map();
  for (const f of inputs) {
    const m = fs.readFileSync(f, "utf8").toLowerCase().match(/[a-zà-ÿ]+/g) ?? [];
    for (const w of m) pre.set(w, (pre.get(w) ?? 0) + 1);
  }
  const strip = (w) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [a, ca] of pre) {
    const plain = strip(a);
    if (plain === a || plain.length < 3) continue;
    const cp = pre.get(plain) ?? 0;
    if (cp > 0 && ca >= 15 * cp && ca >= 30) fixAccent.set(plain, a);
  }
  console.error(`grafias sem acento tratadas como erro: ${fixAccent.size} (ex.: ${[...fixAccent.entries()].slice(0, 12).map(([p, a]) => p + "→" + a).join(", ")})`);
}

const uni = new Map();
const bi = new Map();
const tri = new Map();
const capSeen = new Map(); // palavra -> [vezes capitalizada no meio da frase, total no meio]
const inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

const testOut = [];
let paraN = 0;
let sentences = 0;
for (const f of inputs) {
  const text = fs.readFileSync(f, "utf8");
  for (const para of text.split(/\n+/)) {
    if (para.trim().length < 20) continue;
    if (HOLD && ++paraN % HOLD === 0) {
      testOut.push(para);
      continue;
    }
    for (const sent of para.split(/[.!?;:()…]+\s+|[.!?;:()…]+$/)) {
      const raw = sent.match(WORD);
      if (!raw || raw.length < 2) continue;
      sentences++;
      const toks = [BOUNDARY];
      raw.forEach((w, i) => {
        if (/^\d/.test(w)) return void toks.push(NUM);
        if (w === COMMA) return void toks.push(COMMA);
        const low = w.toLowerCase();
        if (i > 0 && /^[A-ZÀ-Ý]/.test(w) && toks[toks.length - 1] !== COMMA) {
          const c = capSeen.get(low) ?? [0, 0];
          c[0]++;
          capSeen.set(low, c);
        } else if (i > 0) {
          const c = capSeen.get(low) ?? [0, 0];
          c[1]++;
          capSeen.set(low, c);
        }
        toks.push(fixAccent.get(low) ?? low);
      });
      for (let i = 0; i < toks.length; i++) {
        inc(uni, toks[i]);
        if (i > 0) inc(bi, toks[i - 1] + " " + toks[i]);
        if (i > 1) inc(tri, toks[i - 2] + " " + toks[i - 1] + " " + toks[i]);
      }
    }
  }
}
console.error(`frases: ${sentences}, palavras distintas: ${uni.size}, bigramas: ${bi.size}, trigramas: ${tri.size}`);

// vocabulário: especiais primeiro, depois as mais frequentes
const specials = [BOUNDARY, COMMA, NUM];
const words = [...uni.entries()]
  .filter(([w, c]) => !specials.includes(w) && c >= 3)
  .sort((a, b) => b[1] - a[1])
  .slice(0, VOCAB)
  .map(([w]) => w);
const vocab = [...specials, ...words];
const id = new Map(vocab.map((w, i) => [w, i]));

// palavras que quase sempre aparecem com inicial maiúscula (nomes próprios)
const caps = [];
vocab.forEach((w, i) => {
  const c = capSeen.get(w);
  if (c && c[0] + c[1] >= 5 && c[0] / (c[0] + c[1]) >= 0.7) caps.push(i);
});

// bigramas: contexto -> [(próxima, contagem)...] (top BI_TOP, contagem >= 2) + total do contexto
const biBy = new Map();
for (const [k, c] of bi) {
  const [a, b] = k.split(" ");
  const ia = id.get(a);
  const ib = id.get(b);
  if (ia === undefined || ib === undefined || ib < 3 && ib !== 1) continue; // nunca sugere <s> nem #
  if (c < 2) continue;
  let l = biBy.get(ia);
  if (!l) biBy.set(ia, (l = []));
  l.push([ib, c]);
}
const B = {};
for (const [ia, l] of biBy) {
  l.sort((x, y) => y[1] - x[1]);
  B[ia] = l.slice(0, BI_TOP).flat();
}

// trigramas: "a b" -> [(próxima, contagem)...] (top TRI_TOP, contagem >= 2, contexto com >= TRI_MIN ocorrências)
const triBy = new Map();
const triTot = new Map();
for (const [k, c] of tri) {
  const [a, b, d] = k.split(" ");
  const ia = id.get(a);
  const ib = id.get(b);
  const idd = id.get(d);
  if (ia === undefined || ib === undefined) continue;
  const ck = ia + " " + ib;
  triTot.set(ck, (triTot.get(ck) ?? 0) + c);
  if (idd === undefined || idd < 3 && idd !== 1 || c < 2) continue;
  let l = triBy.get(ck);
  if (!l) triBy.set(ck, (l = []));
  l.push([idd, c]);
}
const T = {};
const TT = {};
for (const [ck, l] of triBy) {
  const tot = triTot.get(ck);
  if (tot < TRI_MIN) continue;
  l.sort((x, y) => y[1] - x[1]);
  T[ck] = l.slice(0, TRI_TOP).flat();
  TT[ck] = tot;
}

// total de cada contexto de bigrama (para estimar probabilidades)
const BT = {};
for (const ia of biBy.keys()) BT[ia] = uni.get(vocab[ia]);

const model = { v: 1, w: vocab, n: vocab.map((w) => uni.get(w) ?? 0), c: caps, b: B, bt: BT, t: T, tt: TT };
const json = JSON.stringify(model);
fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, "") || ".", { recursive: true });
fs.writeFileSync(out, json);
console.error(`modelo: ${(json.length / 1e6).toFixed(2)} MB — vocabulário ${vocab.length}, contextos bi ${Object.keys(B).length}, tri ${Object.keys(T).length}`);
if (HOLD && opt.test) {
  fs.writeFileSync(opt.test, testOut.join("\n\n"));
  console.error(`teste separado: ${testOut.length} parágrafos → ${opt.test}`);
}
