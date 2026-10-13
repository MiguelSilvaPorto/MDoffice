// Gera `public/ngrams/ctx-pt.json`: o vocabulário + as CONTAGENS de bigramas do modelo,
// sem os trigramas — é o que o corretor usa para escolher entre candidatos parecidos
// pelo contexto ("vou para a **casa**" × "vou para a **casa**s").
//
// Por que existe: o modelo completo tem 7,2 MB (os trigramas são 3,5 MB + 1,7 MB de
// totais). O corretor só precisa de `w`/`n` (vocabulário e unigramas, para o backoff) e
// `b`/`bt` (sucessores e total de cada contexto). Isso dá ~2 MB.
//
// Os índices de `b`/`bt` apontam para `w`, então `w` e `n` vão COMPLETOS, sem o filtro
// de `gerar-frequencia.mjs` (lá o corretor monta a própria lista; aqui os índices
// precisam continuar válidos).
//
// Uso: node scripts/gerar-contexto.mjs
import fs from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const origem = join(raiz, "public/ngrams/pt.json");
const destino = join(raiz, "public/ngrams/ctx-pt.json");

const modelo = JSON.parse(fs.readFileSync(origem, "utf8"));
if (!Array.isArray(modelo.w) || !Array.isArray(modelo.n) || typeof modelo.b !== "object" || typeof modelo.bt !== "object") {
  console.error("pt.json não está no formato esperado ({w, n, b, bt}).");
  process.exit(1);
}

// Só os contextos que terminam em palavra de verdade (o modelo guarda também
// números e pontuação como "palavras"): o corretor nunca consulta esses.
const b = {};
let contextos = 0;
for (const [chave, sucessores] of Object.entries(modelo.b)) {
  const anterior = modelo.w[Number(chave)];
  if (!anterior || !/^[\p{Letter}]{2,}$/u.test(anterior)) continue;
  b[chave] = sucessores;
  contextos++;
}

fs.writeFileSync(destino, JSON.stringify({ v: 1, w: modelo.w, n: modelo.n, b, bt: modelo.bt }));
const mb = (fs.statSync(destino).size / 1024 / 1024).toFixed(1);
console.log(`ctx-pt.json: ${modelo.w.length} palavras, ${contextos} contextos, ${mb} MB`);
