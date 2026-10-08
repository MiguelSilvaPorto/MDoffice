// Gera o modelo de idioma da sugestão de palavras (public/ngrams/pt.json) a partir de textos em português.
// Só guarda CONTAGENS de palavras e sequências de 2–3 palavras (nenhum texto do corpus é copiado).
//
// Uso:  node scripts/build-ngrams.mjs <saida.json> <corpus1.txt> [corpus2.txt ...] [--holdout=20 --test=<teste.txt>]
//   --holdout=N  separa 1 parágrafo a cada N para um arquivo de teste (--test=...), fora do modelo
//   --vocab=N    tamanho do vocabulário (padrão 22000)
//   --trimin=N   descarta contextos de trigrama com menos de N ocorrências (padrão 4)
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [out, ...inputs] = args.filter((a) => !a.startsWith("--"));
if (!out || !inputs.length) {
  console.error("uso: node scripts/build-ngrams.mjs <saida.json> <corpus.txt...> [--holdout=N --test=arquivo --vocab=N]");
  process.exit(1);
}
const VOCAB = +(opt.vocab ?? 22000);
const HOLD = +(opt.holdout ?? 0);
const TRI_MIN = +(opt.trimin ?? 4); // contextos de trigrama com menos ocorrências que isso são descartados (modelo menor)

const BOUNDARY = "<s>";
const COMMA = ",";
const NUM = "#";
const WORD = /[A-Za-zÀ-ÿ]+(?:-[A-Za-zÀ-ÿ]+)*|\d+(?:[.,]\d+)*|,/g;

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
        toks.push(low);
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

// bigramas: contexto -> [(próxima, contagem)...] (top 12, contagem >= 2) + total do contexto
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
  B[ia] = l.slice(0, 12).flat();
}

// trigramas: "a b" -> [(próxima, contagem)...] (top 5, contagem >= 2, contexto com >= 4 ocorrências)
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
  T[ck] = l.slice(0, 5).flat();
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
