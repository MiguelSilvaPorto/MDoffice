// Testa a qualidade da SUGESTÃO (texto fantasma): a correção do que foi digitado e a régua de
// precisão/economia nos textos de teste — a mesma do scripts/eval-ghost.mts, com o modelo de
// idioma real do app. O relato que originou o teste: "a sugestão aparece errada" (a base antiga
// acertava 49% do que mostrava).
// Uso: node scripts/testar-ghost.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "ghost-"));
const empacotar = async (fonte, saida) => {
  await build({ stdin: { contents: fonte, resolveDir: raiz, loader: "ts" }, bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

const G = await empacotar(
  `export { predictFromLine, THRESHOLDS } from "./src/broker/ghost/predict.ts";
   export { DocumentIndex } from "./src/broker/ghost/documentIndex.ts";
   export { setLanguageModel } from "./src/broker/ghost/model.ts";`,
  "ghost.mjs"
);

// O modelo de idioma real do app (o mesmo que o eval-ghost usa com GHOST_MODEL).
G.setLanguageModel(JSON.parse(readFileSync(join(raiz, "public/ngrams/pt.json"), "utf8")));

// ---------------------------------------------------------------- a correção do digitado
{
  const idx = new G.DocumentIndex();
  // o caso do relato: "noçao" vira "noção" sozinho (a correção vem antes de qualquer previsão;
  // a palavra terminou no espaço — é assim que o app chama)
  const r = G.predictFromLine("vc tem noçao ", "", 13, idx);
  ok("ghost: corrige a palavra digitada (noçao → noção)", r?.text === "noção " && r.replace === 6, JSON.stringify(r ?? null));
  // palavra certa não vira correção
  const certo = G.predictFromLine("vc tem noção ", "", 13, idx);
  ok("ghost: palavra certa não vira correção", !certo?.replace, JSON.stringify(certo ?? null));
}

// ---------------------------------------------------------------- a régua (precisão e economia)
{
  const texto = readFileSync(join(raiz, "scripts/corpus-wikipedia.txt"), "utf8");
  const paras = texto.split(/\n+/).filter((p) => p.trim().length > 30);
  const index = new G.DocumentIndex();
  const st = { keys: 0, ganho: 0, shown: 0, hit: 0, posicoes: 0 };
  // A régua é uma POPULAÇÃO FIXA: cada fronteira de digitação, sem "pular" o texto aceito. A
  // simulação com salto (eval-ghost) depende das decisões do próprio modelo (a população muda
  // quando o modelo muda) e por isso não serve para comparar versões.
  for (const para of paras) {
    for (let i = 1; i < para.length; i++) {
      st.keys++;
      const before = para.slice(0, i);
      const rest = para.slice(i);
      if (!(/[A-Za-zÀ-ÿ0-9]$/.test(before) || /\s$/.test(before))) continue;
      st.posicoes++;
      const pred = G.predictFromLine(before, "", i, index);
      // a correção do que foi digitado tem teste próprio (acima) e não entra na régua
      if (!pred?.text || pred.replace) continue;
      st.shown++;
      const palavras = pred.text.trim().split(/\s+/);
      let okn = 0;
      let len = 0;
      for (const w of palavras) {
        if (rest.toLowerCase().startsWith((pred.text.slice(0, len) + w).toLowerCase())) {
          okn++;
          len += w.length;
        } else break;
      }
      if (okn === 0 && palavras.length === 1 && rest.toLowerCase().startsWith(pred.text.trimEnd().toLowerCase())) {
        okn = 1;
        len = pred.text.trimEnd().length;
      }
      if (okn > 0) {
        st.hit++;
        st.ganho += Math.max(0, len - 1);
      }
    }
    index.update(para);
  }
  const precisao = (100 * st.hit) / Math.max(1, st.shown);
  const economia = (100 * st.ganho) / Math.max(1, st.keys);
  const cobertura = (100 * st.shown) / Math.max(1, st.posicoes);
  console.log(`   mostradas: ${st.shown} em ${st.posicoes} posições (cobertura ${cobertura.toFixed(1)}%)`);
  console.log(`   precisão: ${precisao.toFixed(1)}%   economia de teclas: ${economia.toFixed(1)}%`);
  ok("ghost: a sugestão mostrada acerta pelo menos 88% das vezes", precisao >= 88, `${precisao.toFixed(1)}%`);
  ok("ghost: ainda economiza teclas (não é mostrar nada)", economia >= 18, `${economia.toFixed(1)}%`);
  ok("ghost: mostra com regularidade (não é raridade)", cobertura >= 5, `${cobertura.toFixed(1)}%`);
}

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "Tudo certo.");
process.exit(falhas ? 1 : 0);
