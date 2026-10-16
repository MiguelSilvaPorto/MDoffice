// Harness do seletor de fonte/tamanho (o componente REAL + o CSS REAL): abre a lista e mede a
// altura das linhas e a altura máxima, para conferir se ela está compacta.
// Uso: node scripts/harness-seletor.mjs   -> temp/seletor.png + a linha de medidas
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const entrada = join(raiz, "scripts", ".harness-seletor.ts");
writeFileSync(
  entrada,
  `
import "../src/styles.css";
import { melhorarSeletor } from "../src/seletor";
import { FONTES_COMUNS } from "../src/fontes";

// a mesma lista que a fita monta (a atual primeiro, depois as do deck e as comuns)
const atual = "Segoe UI";
const lista = [atual, ...FONTES_COMUNS];
const sel = document.createElement("select");
sel.className = "ppr-sel fonte";
sel.setAttribute("data-editavel", "");
sel.title = "Fonte";
sel.setAttribute("aria-label", "Fonte");
sel.innerHTML = lista.map((f) => \`<option value="\${f}"\${f === atual ? " selected" : ""} style="font-family:'\${f}'">\${f}</option>\`).join("");
document.getElementById("campo")!.append(sel);
melhorarSeletor(sel);

// abre a lista como o clique na setinha faz
const face = document.querySelector<HTMLElement>(".sel-face")!;
face.click();

requestAnimationFrame(() => {
  const menu = document.querySelector<HTMLElement>(".sel-menu")!;
  const itens = [...menu.querySelectorAll<HTMLElement>(".dd-item")];
  const item = itens[0];
  const estilo = item ? getComputedStyle(item) : null;
  document.getElementById("info")!.textContent =
    "itens=" + itens.length +
    "  linha=" + (item ? item.getBoundingClientRect().height.toFixed(1) : "?") + "px" +
    "  fonte=" + (estilo ? estilo.fontSize : "?") +
    "  menu=" + menu.clientHeight + "/" + menu.scrollHeight +
    "  largura=" + menu.clientWidth;
});
`,
  "utf8"
);

await build({
  entryPoints: [entrada],
  bundle: true,
  outfile: join(temp, "harness-seletor.js"),
  logLevel: "error",
  external: ["/fonts/*"],
  loader: { ".woff2": "file", ".woff": "file", ".png": "file", ".svg": "file" },
});
const css = existsSync(join(temp, "harness-seletor.css")) ? "harness-seletor.css" : "";
writeFileSync(
  join(temp, "harness-seletor.html"),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="${css}">
<style>body { margin: 0; background: var(--bg); padding: 8px; }
#info { color: #555; font: 11px monospace; white-space: pre-wrap; }</style>
</head><body>
<svg style="display:none" aria-hidden="true">
  <symbol id="i-chevron" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>
  <symbol id="i-check" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>
</svg>
<pre id="info"></pre><div id="campo"></div>
<script src="harness-seletor.js"></script></body></html>`,
  "utf8"
);

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const foto = join(temp, "seletor.png");
execFileSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=420,520",
  `--screenshot=${foto}`,
  "--virtual-time-budget=1500",
  `file:///${join(temp, "harness-seletor.html").replace(/\\/g, "/")}`,
]);
console.log("foto:", foto);
