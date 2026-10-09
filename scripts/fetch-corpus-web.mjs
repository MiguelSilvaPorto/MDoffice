// Baixa páginas da web em português (HuggingFaceFW/fineweb-2, config por_Latn, via datasets-server do Hugging Face)
// em posições espalhadas. É texto de blogs, notícias, sites de empresas e órgãos públicos: bem mais parecido com o que as
// pessoas escrevem do que a Wikipédia. Serve de entrada para scripts/build-ngrams.mjs.
// Uso: node scripts/fetch-corpus-web.mjs <saida.txt> <chamadas de 100 páginas> <máx. de caracteres por página>
import fs from "node:fs";

const out = process.argv[2];
const CALLS = +(process.argv[3] ?? 60);
const MAXC = +(process.argv[4] ?? 6000);
const TOTAL = 199_000_000;
if (!out) {
  console.error("uso: node scripts/fetch-corpus-web.mjs <saida.txt> <chamadas> <max-chars>");
  process.exit(1);
}
const stream = fs.createWriteStream(out);
let bytes = 0;
let pages = 0;

/** Tira linhas de menu/rodapé (curtas, sem pontuação) e deixa só parágrafos de verdade. */
function clean(t) {
  return t
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 60 && /[.!?]$/.test(l) && /[a-zà-ú]/.test(l) && !/https?:\/\//.test(l))
    .join("\n");
}

for (let i = 0; i < CALLS; i++) {
  const off = Math.floor(Math.random() * (TOTAL / 100)) * 100;
  const url = `https://datasets-server.huggingface.co/rows?dataset=HuggingFaceFW/fineweb-2&config=por_Latn&split=train&offset=${off}&length=100`;
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
    const t = clean((row.text ?? "").slice(0, MAXC * 2)).slice(0, MAXC);
    if (t.length < 300) continue;
    stream.write(t + "\n\n");
    bytes += t.length;
    pages++;
  }
  console.log(`${i + 1}/${CALLS}  páginas=${pages}  ${(bytes / 1e6).toFixed(1)} MB`);
}
stream.end();
