// Harness de conferência do corretor do Word: monta o editor REAL (ProseMirror + o schema do
// Word + o plugin do corretor) numa página, com uma palavra sublinhada e uma imagem colada
// logo depois dela — e responde NA PRÓPRIA FOTO às duas perguntas do relato:
//   • clicar na IMAGEM abre sugestão?  (tem de dizer NÃO)
//   • clicar na PALAVRA abre?           (tem de dizer SIM, ancorado nela)
// O corretor de verdade é trocado por um dublê que sempre acusa "Awdaw" (o texto projetado
// põe a imagem como um espaço, então é ela que fica na borda da faixa do problema).
//
// Uso: node scripts/harness-corretor.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const entrada = join(raiz, "scripts", ".harness-corretor.ts");
writeFileSync(
  entrada,
  `
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import "../src/styles.css";
import { schema } from "../src/word/schema";
import { spellPlugin } from "../src/word/spell";

const alvo = document.getElementById("doc") as HTMLElement;
const p = schema.nodes.paragraph!;
const svg =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='150'>" +
      "<rect width='100%' height='100%' rx='8' fill='#dbeafe' stroke='#93c5fd'/>" +
      "<text x='16' y='34' font-family='sans-serif' font-size='15' fill='#1e3a8a'>imagem colada</text>" +
      "<text x='16' y='58' font-family='sans-serif' font-size='12' fill='#3b82f6'>(é a imagem do print)</text></svg>"
  );
const imagem = schema.nodes.image!.create({ src: svg, width: 260, height: 150 });
const doc = schema.nodes.doc!.create(null, [
  p.create(null, [schema.text("Awdaw"), imagem]),
  p.create(null, [schema.text("Segunda linha: o documento tem texto de verdade.")]),
]);

const view = new EditorView(alvo, {
  state: EditorState.create({
    doc,
    plugins: [
      spellPlugin({
        getIgnore: () => new Set<string>(),
        ignoreHere: () => {},
        addToDictionary: () => {},
        enabled: () => true,
      }),
    ],
  }),
});

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const ate = async (cond: () => boolean) => {
  for (let i = 0; i < 100 && !cond(); i++) await espera(20);
};
const clicar = (el: Element) => {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + Math.min(r.height / 2, 40);
  const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, view: window } as MouseEventInit;
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  // o "mouseup" vai no MESMO elemento (como no navegador de verdade): o ProseMirror entrega
  // esse evento ao "handleClick", e é o alvo dele que decide se o clique foi no texto
  el.dispatchEvent(new MouseEvent("mouseup", opts));
};
const popup = () => document.querySelector(".wd-pop") as HTMLElement | null;
const linhas: string[] = [];

(async () => {
  await ate(() => !!document.querySelector(".wd-issue"));
  const img = document.querySelector("#doc img") as HTMLImageElement | null;
  const palavra = document.querySelector(".wd-issue") as HTMLElement | null;
  if (!img || !palavra) {
    linhas.push("ERRO: sem imagem ou sem sublinhado");
  } else {
    linhas.push("sublinhado: " + (palavra.textContent ?? "") + " (classe " + palavra.className + ")");
    clicar(img);
    await espera(80);
    linhas.push("clique na IMAGEM  -> " + (popup() ? "ABRIU O POPUP  ✗" : "não abriu  ✓"));
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    clicar(palavra);
    await espera(80);
    const pop = popup();
    linhas.push("clique na PALAVRA -> " + (pop ? "abriu  ✓" : "não abriu  ✗"));
    if (pop) {
      const a = palavra.getBoundingClientRect();
      const b = pop.getBoundingClientRect();
      linhas.push(
        "âncora: popup.left=" + Math.round(b.left) + "px  palavra.left=" + Math.round(a.left) + "px  Δ=" + Math.round(Math.abs(b.left - a.left)) + "px"
      );
      linhas.push("imagem tocada? " + (document.querySelector(".wd-issue img") ? "SIM ✗" : "não  ✓"));
    }
  }
  const res = document.getElementById("res") as HTMLElement;
  res.textContent = linhas.join("\\n");
  res.dataset.pronto = "1";
  document.title = linhas.join(" | ");
})();
`,
  "utf8"
);

await build({
  entryPoints: [entrada],
  bundle: true,
  outfile: join(temp, "harness-corretor.js"),
  platform: "browser",
  format: "iife",
  logLevel: "error",
  external: ["/fonts/*"],
  // o corretor de verdade consulta o assistente (broker): no harness ele é um dublê que acusa
  // só a palavra do relato — o que está em teste é o CLIQUE, não a lista de sugestões
  plugins: [
    {
      name: "duble-do-corretor",
      setup(b) {
        b.onResolve({ filter: /^\.\.\/broker\/writing$/ }, () => ({ path: "duble", namespace: "duble" }));
        b.onLoad({ filter: /.*/, namespace: "duble" }, () => ({
          loader: "ts",
          contents: `export async function checkText() {
  return [{ from: 0, to: 5, word: "Awdaw", kind: "spell", message: "“Awdaw” não está no dicionário", suggestions: [] }];
}`,
        }));
      },
    },
  ],
});

const css = existsSync(join(temp, "harness-corretor.css")) ? "harness-corretor.css" : "";
writeFileSync(
  join(temp, "harness-corretor.html"),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}">
<style>
body { margin: 0; background: #eef1f5; font: 14px/1.5 "Segoe UI", sans-serif; color: #1c212b; }
#pagina { width: 640px; margin: 18px auto; background: #fff; border: 1px solid #d5d9e0; border-radius: 6px; padding: 26px 30px; }
#doc { outline: none; min-height: 260px; }
#doc p { margin: 0 0 10px; }
#doc img { vertical-align: middle; border-radius: 6px; }
#res { margin: 0 18px 18px; padding: 12px 14px; background: #0f172a; color: #e2e8f0; border-radius: 10px; font: 13px/1.6 monospace; white-space: pre-wrap; }
#res:empty::before { content: "rodando…"; color: #94a3b8; }
</style></head>
<body>
<div id="pagina"><div id="doc"></div></div>
<pre id="res"></pre>
<script src="harness-corretor.js"></script>
</body></html>`,
  "utf8"
);

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const foto = join(temp, "corretor.png");
execFileSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=720,560",
  "--screenshot=" + foto,
  "--virtual-time-budget=3000",
  "file:///" + join(temp, "harness-corretor.html").replace(/\\/g, "/"),
]);
console.log("foto:", foto);
