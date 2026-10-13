// Gera `public/ngrams/freq-pt.json`: só as PALAVRAS e as CONTAGENS do modelo de
// n-gramas, sem as tabelas de bigramas/trigramas.
//
// Por que existe: o corretor precisa de uma ordem de frequência para escolher
// entre sugestões parecidas ("extenso" ganha de "esterno"). O modelo completo tem
// 6,9 MB porque carrega as sequências de 2-3 palavras; o corretor não usa isso.
// Este arquivo leva só o vocabulário e as contagens (~300 KB) e deixa o worker
// do dicionário independente do modelo de predição.
//
// Uso: node scripts/gerar-frequencia.mjs
import fs from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const origem = join(raiz, "public/ngrams/pt.json");
const destino = join(raiz, "public/ngrams/freq-pt.json");

const modelo = JSON.parse(fs.readFileSync(origem, "utf8"));
if (!Array.isArray(modelo.w) || !Array.isArray(modelo.n)) {
  console.error("pt.json não está no formato esperado ({w, n}).");
  process.exit(1);
}

// Só palavras de letras (com acento) e com 2+ letras: pontuação e números não
// entram numa sugestão de palavra.
const palavras = [];
const contagens = [];
for (let i = 0; i < modelo.w.length; i++) {
  const w = modelo.w[i];
  if (!/^[\p{Letter}]{2,}$/u.test(w)) continue;
  palavras.push(w);
  contagens.push(modelo.n[i] ?? 0);
}

fs.writeFileSync(destino, JSON.stringify({ v: 1, w: palavras, n: contagens }));
const kb = Math.round(fs.statSync(destino).size / 1024);
console.log(`freq-pt.json: ${palavras.length} palavras, ${kb} KB`);
