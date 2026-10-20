// Harness da tela Início: monta a página REAL (renderHomePage + o CSS real) num Chrome
// headless e salva a foto — para conferir o logo no cabeçalho, as cores dos módulos e o
// aviso de marcas no rodapé.
//
// Uso: node scripts/harness-inicio.mjs [claro|escuro]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });
const tema = String(process.argv[2] ?? "claro") === "escuro" ? "dark" : "light";

const entrada = join(raiz, "scripts", ".harness-inicio.ts");
writeFileSync(
  entrada,
  `
import { renderHomePage } from "../src/homePage";
import "../src/styles.css";

document.documentElement.dataset.theme = ${JSON.stringify(tema)};
document.body.classList.add("home-open");

const slot = document.getElementById("home-slot") as HTMLElement;
const nada = () => {};
renderHomePage(slot, {
  createDoc: nada,
  createTemplate: nada,
  openExisting: nada,
  importOffice: nada,
  openPath: nada,
  recents: () => [],
  preview: async () => ({ forma: "vazia" }),
  drafts: async () => [],
  openDraft: nada,
  deleteDraft: async () => {},
  closeHome: nada,
  hasOpenTabs: false,
});
`,
  "utf8"
);

await build({
  entryPoints: [entrada],
  bundle: true,
  outfile: join(temp, "harness-inicio.js"),
  logLevel: "error",
  external: ["/fonts/*"],
  loader: { ".woff2": "file", ".woff": "file", ".png": "file", ".svg": "file" },
});
const css = "harness-inicio.css";
writeFileSync(
  join(temp, "harness-inicio.html"),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}">
<style>html, body { margin: 0; height: 100%; } #home-page { height: 100vh; }</style>
</head><body><section id="home-page"><div id="home-slot"></div></section><script src="harness-inicio.js"></script></body></html>`,
  "utf8"
);

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const foto = join(temp, `inicio-${tema}.png`);
execFileSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1180,1500",
  "--screenshot=" + foto,
  "--virtual-time-budget=2500",
  "file:///" + join(temp, "harness-inicio.html").replace(/\\/g, "/"),
]);
console.log("foto:", foto);
