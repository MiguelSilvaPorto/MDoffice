// Baixa artigos da Wikipédia em português (dataset wikimedia/wikipedia, via datasets-server do Hugging Face)
// em posições espalhadas, para gerar o modelo de idioma com scripts/build-ngrams.mjs.
// Uso: node scripts/fetch-corpus.mjs <saida.txt> <chamadas de 100 artigos> <máx. de caracteres por artigo>
import fs from "node:fs";

const out = process.argv[2];
const CALLS = +(process.argv[3] ?? 30);
const MAXC = +(process.argv[4] ?? 8000);
const TOTAL = 1112246;
const stream = fs.createWriteStream(out);
let bytes = 0;
let arts = 0;

const clean = (t) =>
  t
    .replace(/\n+(?:Referências|Ligações externas|Notas|Ver também|Bibliografia|Fontes)\b[\s\S]*$/, "")
    .replace(/\(\s*[^)]{0,100}\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[ \t]+/g, " ");

const used = new Set();
for (let i = 0; i < CALLS; i++) {
  let off;
  do off = Math.floor(Math.random() * (TOTAL / 100)) * 100;
  while (used.has(off));
  used.add(off);
  const url = `https://datasets-server.huggingface.co/rows?dataset=wikimedia/wikipedia&config=20231101.pt&split=train&offset=${off}&length=100`;
  let rows = null;
  for (let t = 0; t < 5 && !rows; t++) {
    try {
      const r = await fetch(url);
      if (r.ok) rows = (await r.json()).rows;
      else await new Promise((x) => setTimeout(x, 3000 * (t + 1)));
    } catch {
      await new Promise((x) => setTimeout(x, 3000 * (t + 1)));
    }
  }
  for (const { row } of rows ?? []) {
    const t = clean(row.text ?? "").slice(0, MAXC);
    if (t.length < 400) continue; // esboços curtos
    stream.write(t + "\n\n");
    bytes += t.length;
    arts++;
  }
  console.log(`${i + 1}/${CALLS}  artigos=${arts}  ${(bytes / 1e6).toFixed(1)} MB`);
}
stream.end();
