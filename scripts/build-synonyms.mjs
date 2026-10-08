// Condensa o dicionário de sinônimos do LibreOffice (th_pt_BR.dat, formato MyThes, derivado do TeP 2.0)
// num arquivo pequeno (public/ngrams/syn-pt.json) só com palavras comuns do português.
//
// Uso: node scripts/build-synonyms.mjs <th_pt_BR.dat> <public/ngrams/pt.json> <saida.json>
//   th_pt_BR.dat: https://raw.githubusercontent.com/LibreOffice/dictionaries/master/pt_BR/th_pt_BR.dat
//
// Para cada palavra, junta os sinônimos de todos os sentidos e ordena pelos que mais aparecem e mais comuns. Só entram
// palavras simples (sem espaço) que existam no vocabulário do modelo de idioma, para as trocas serem naturais.
import fs from "node:fs";

const [thPath, modelPath, out] = process.argv.slice(2);
if (!thPath || !modelPath || !out) {
  console.error("uso: node scripts/build-synonyms.mjs <th_pt_BR.dat> <pt.json> <saida.json>");
  process.exit(1);
}
const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
const count = new Map(model.w.map((w, i) => [w, model.n[i]]));
const common = (w) => (count.get(w) ?? 0) >= 40;

const lines = fs.readFileSync(thPath, "utf8").split("\n");
const syns = new Map(); // palavra -> Map(sinônimo -> nº de sentidos que o citam)
for (let i = 1; i < lines.length; i++) {
  const m = /^([^|(]+)\|(\d+)$/.exec(lines[i]);
  if (!m) continue;
  const head = m[1].toLowerCase();
  const n = +m[2];
  const isCommonHead = common(head) && !/\s/.test(head);
  for (let k = 1; k <= n; k++) {
    const sense = lines[i + k] ?? "";
    if (!isCommonHead) continue;
    const parts = sense.replace(/^\([^)]*\)/, "").split("|");
    const seen = new Set();
    for (const raw of parts) {
      const w = raw.trim().toLowerCase();
      if (!w || w === head || /\s/.test(w) || seen.has(w)) continue;
      seen.add(w);
      if (!common(w)) continue;
      let mm = syns.get(head);
      if (!mm) syns.set(head, (mm = new Map()));
      mm.set(w, (mm.get(w) ?? 0) + 1);
    }
  }
  i += n;
}

const result = {};
for (const [head, mm] of syns) {
  const list = [...mm.entries()]
    // os que aparecem em mais sentidos e são mais comuns vêm primeiro
    .sort((a, b) => b[1] - a[1] || count.get(b[0]) - count.get(a[0]))
    .slice(0, 10)
    .map(([w]) => w);
  if (list.length) result[head] = list;
}
fs.writeFileSync(out, JSON.stringify(result));
console.error(`palavras com sinônimos: ${Object.keys(result).length}; arquivo: ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
