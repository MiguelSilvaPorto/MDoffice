// Testa os Arranjos de lâmina: a detecção de cartões (enfeites como o triângulo grande e painéis de
// fundo NÃO são cartões), o cartão com tudo o que anda com ele, e o resultado sem sobreposição.
// Uso: node scripts/testar-arranjos.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-arranjos-"));
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/arranjos.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "arranjos.mjs"), logLevel: "error" });
const A = await import(pathToFileURL(join(tmp, "arranjos.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

let n = 0;
const forma = (x, y, w, h, extra = {}) => ({ id: `s${++n}`, kind: "forma", text: "", fill: "#1F9D55", box: { x, y, w, h }, ...extra });
const texto = (x, y, w, h, t) => ({ id: `s${++n}`, kind: "texto", text: t, fill: "", box: { x, y, w, h }, paras: [{ runs: [{ text: t, size: 12 }] }] });
const sobrepoe = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;

// 4 cartões (retângulo arredondado com texto) + triângulo enorme por cima + painel de fundo
const cartoes = [[10, 30], [40, 30], [10, 60], [40, 60]].flatMap(([x, y], i) => [forma(x, y, 25, 20, { geom: "roundRect" }), texto(x + 2, y + 6, 21, 6, `Pessoa ${i + 1}`)]);
const triangulo = forma(5, 20, 70, 70, { geom: "triangle", opacity: 0.4 });
const painel = forma(5, 25, 70, 70, { geom: "rect", fillX: { kind: "solid", color: "EEEEEE" } });
const titulo = texto(5, 4, 60, 8, "Conheça nossa equipe");
const slide = { id: "x", layout: "blank", md: "", notes: "", shapes: [titulo, triangulo, painel, ...cartoes] };

const un = A.unidadesDa(slide);
ok("o triângulo e o painel não viram cartões (4 unidades)", un.length === 4, `unidades=${un.length}`);
ok("cada unidade leva o cartão e o texto (2 formas)", un.every((u) => u.ids.length === 2));

for (const [id, v] of [["grade", 2], ["grade", 3], ["lista", 0], ["destaque", 0], ["faixa", 0]]) {
  const novo = A.aplicarArranjo(slide, id, v, 16 / 9);
  const caixas = A.unidadesDa(novo).map((u) => u.box);
  let colisao = false;
  for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) if (sobrepoe(caixas[i], caixas[j])) colisao = true;
  ok(`${id} ${v || ""}: nenhum cartão se sobrepõe`.trim(), !colisao);
  ok(`${id} ${v || ""}: tudo dentro da lâmina`.trim(), caixas.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= 100.01 && b.y + b.h <= 100.01));
  ok(`${id} ${v || ""}: o enfeite não se mexeu`.trim(), JSON.stringify(novo.shapes.find((s) => s.id === triangulo.id).box) === JSON.stringify(triangulo.box));
}
if (falhas) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
