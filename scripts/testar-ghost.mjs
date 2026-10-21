// Testa a qualidade da SUGESTÃO (texto fantasma): a correção do que foi digitado e a régua de
// precisão/economia nos textos de teste — a mesma do scripts/eval-ghost.mts, com o modelo de
// idioma real do app. O relato que originou o teste: "a sugestão aparece errada" (a base antiga
// acertava 49% do que mostrava).
// Uso: node scripts/testar-ghost.mjs
import { build } from "esbuild";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "ghost-"));
const empacotar = async (fonte, saida) => {
  await build({ stdin: { contents: fonte, resolveDir: raiz, loader: "ts" }, bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

// a intensidade (Configurações) mora no localStorage: o teste escolhe o modo de cada régua
let modo = "equilibrado";
globalThis.localStorage = { getItem: (k) => (k === "mdc.ghost.mode" ? modo : null), setItem() {}, removeItem() {} };

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

const G = await empacotar(
  `export { predictFromLine, THRESHOLDS } from "./src/broker/ghost/predict.ts";
   export { DocumentIndex } from "./src/broker/ghost/documentIndex.ts";
   export { setLanguageModel } from "./src/broker/ghost/model.ts";
   export { consumeTyped, aceiteDoTab, aceiteDaPalavra } from "./src/broker/ghost/suggestion.ts";`,
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

// ---------------------------------------------------------------- pronome + verbo
{
  const idx = new G.DocumentIndex();
  // o relato: "colo" querendo "coloquei" — depois de "eu" vem verbo na 1ª pessoa
  const r = G.predictFromLine("Eu colo", "", 7, idx);
  ok("ghost: eu colo → coloquei", r?.text === "quei", JSON.stringify(r?.text ?? null));
  const n = G.predictFromLine("Ontem nós fize", "", 14, idx);
  ok("ghost: nós fize → fizemos", n?.text === "mos", JSON.stringify(n?.text ?? null));
  // próxima palavra: "dia" é 8× mais provável que a segunda — antes só aparecia com 45% de chance
  const p = G.predictFromLine("Bom ", "", 4, idx);
  ok("ghost: Bom → dia", p?.text?.startsWith("dia") === true, JSON.stringify(p?.text ?? null));
}

// ---------------------------------------------------------------- frases do dia a dia, em cada nível
// Os níveis maiores (Configurações → Modelo de palavras) saem de outro corpus (texto da web): um
// corpus de Wikipédia fez "Bom " virar "Bom Jesus" (nome de cidade) e "Tecnologia da " perder "informação".
// Todo nível presente tem de acertar o que a pessoa escreve no dia a dia.
{
  const CASOS = [
    ["Bom ", (t) => t?.startsWith("dia")],
    ["Tecnologia da ", (t) => t?.startsWith("informação")],
    ["Eu colo", (t) => t === "quei"],
    ["é uma área pou", (t) => t === "co"],
    ["obrig", (t) => t === "ado"],
    ["vc tem noçao ", (t) => t === "noção "],
  ];
  for (const arq of ["pt-40.json", "pt-80.json", "pt-160.json"]) {
    const caminho = join(raiz, "public/ngrams", arq);
    if (!existsSync(caminho)) {
      console.log(`      (${arq} não está nesta cópia: rode npm run corpus)`);
      continue;
    }
    G.setLanguageModel(JSON.parse(readFileSync(caminho, "utf8")));
    const idx = new G.DocumentIndex();
    for (const [antes, certo] of CASOS) {
      const r = G.predictFromLine(antes, "", antes.length, idx);
      ok(`ghost (${arq}): ${JSON.stringify(antes)}`, certo(r?.text), JSON.stringify(r?.text ?? null));
    }
  }
  // a régua abaixo mede o pt.json (a base)
  G.setLanguageModel(JSON.parse(readFileSync(join(raiz, "public/ngrams/pt.json"), "utf8")));
}

// ---------------------------------------------------------------- a régua (precisão e economia)
function regua() {
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
  return { precisao, economia, cobertura };
}

// discreta: a régua de sempre (mostra pouco e certeiro)
modo = "discreto";
{
  const { precisao, economia, cobertura } = regua();
  ok("ghost (discreta): a sugestão mostrada acerta pelo menos 88% das vezes", precisao >= 88, `${precisao.toFixed(1)}%`);
  ok("ghost (discreta): ainda economiza teclas", economia >= 18, `${economia.toFixed(1)}%`);
  ok("ghost (discreta): mostra com regularidade", cobertura >= 5, `${cobertura.toFixed(1)}%`);
}
// equilibrada (o padrão): arrisca como o Copilot — mostra muito mais e economiza mais teclas
modo = "equilibrado";
{
  const { precisao, economia, cobertura } = regua();
  ok("ghost (equilibrada): economiza mais teclas que a discreta", economia >= 24, `${economia.toFixed(1)}%`);
  ok("ghost (equilibrada): aparece em boa parte das posições", cobertura >= 15, `${cobertura.toFixed(1)}%`);
  ok("ghost (equilibrada): ainda acerta boa parte do que mostra", precisao >= 40, `${precisao.toFixed(1)}%`);
}

// ---------------------------------------------------------------- o palpite das próximas palavras
// O pedido: além de completar a palavra, prever até as duas próximas (mais claras); o Tab aceita a
// palavra e a seta para a direita traz uma palavra do palpite por vez.
modo = "equilibrado";
{
  const idx = new G.DocumentIndex();
  const r = G.predictFromLine("Por ou", "", 6, idx);
  ok("ghost: completa a palavra e arrisca a próxima (Por ou → tro + lado)", r?.text === "tro" && r?.extra === " lado", JSON.stringify(r ? [r.text, r.extra] : null));
  const palavras = (r?.extra ?? "").trim().split(/\s+/).filter(Boolean).length;
  ok("ghost: o palpite tem no máximo duas palavras", palavras <= G.THRESHOLDS.palpite, String(palavras));

  const s = { text: "o", extra: " lado bom", pos: 8 };
  const tab = G.aceiteDoTab(s);
  ok("ghost: o Tab aceita só a palavra e deixa o palpite", tab?.insert === "o" && tab?.rest?.text === "" && tab?.rest?.extra === " lado bom", JSON.stringify(tab));
  const seta1 = G.aceiteDaPalavra({ ...tab.rest, pos: 9 });
  ok("ghost: a seta traz uma palavra do palpite", seta1?.insert === " lado" && seta1?.rest?.extra === " bom", JSON.stringify(seta1));
  const seta2 = G.aceiteDaPalavra({ ...seta1.rest, pos: 14 });
  ok("ghost: a última palavra do palpite encerra a sugestão", seta2?.insert === " bom" && seta2?.rest === null, JSON.stringify(seta2));
  const firme = G.aceiteDaPalavra({ text: "tado final", extra: " ficou", pos: 0 });
  ok("ghost: a seta anda pela parte firme antes do palpite", firme?.insert === "tado" && firme?.rest?.text === " final" && firme?.rest?.extra === " ficou", JSON.stringify(firme));
  const digitou = G.consumeTyped({ text: "o", extra: " lado", pos: 8 }, "o");
  ok("ghost: digitar a palavra à mão mantém o palpite", digitou?.text === "" && digitou?.extra === " lado", JSON.stringify(digitou));
  const espaco = G.consumeTyped(digitou, " ");
  ok("ghost: digitar o espaço come o palpite", espaco?.extra === "lado", JSON.stringify(espaco));
  ok("ghost: digitar outra coisa descarta o palpite", G.consumeTyped(digitou, "x") === null);
  const corr = G.aceiteDaPalavra({ text: "noção ", pos: 13, replace: 6 });
  ok("ghost: correção continua inteira na seta", corr?.insert === "noção " && corr?.rest === null, JSON.stringify(corr));
}

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "Tudo certo.");
process.exit(falhas ? 1 : 0);
