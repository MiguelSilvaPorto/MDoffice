// Harness de conferência visual do painel lateral (o corpo do painel REAL, com o CSS REAL), para
// medir e fotografar: o filtro Designer/Visual/Arrumação/Tudo tem de CABER no painel em qualquer
// largura. Uso: node scripts/harness-painel.mjs 260   -> temp/painel-260.png + a linha de medidas
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });
const largura = Number(process.argv[2] ?? 260);

const entrada = join(raiz, "scripts", ".harness-painel.ts");
writeFileSync(
  entrada,
  `
import "../src/styles.css";

// o corpo da Composição como o app monta (powerpoint.ts), com o cabeçalho, a dica, o filtro e o
// "aplicar a todas": é o suficiente para o layout do filtro, que é o que o harness confere
const host = document.getElementById("painel") as HTMLElement;
host.innerHTML = \`
  <div class="pp-side-head"><span>Composição</span><span class="pp-side-hint">geradas no seu computador</span></div>
  <p class="pp-ideias-dica">Sugestões para <b>esta lâmina</b>: o <b>Designer</b> desenha a arte; o <b>Visual</b> muda cores, fonte e o formato das caixas; a <b>Arrumação</b> reposiciona o conteúdo.</p>
  <div class="pp-seg" role="group" aria-label="O que as sugestões mudam">
    <button type="button" class="on">Designer</button>
    <button type="button">Visual</button>
    <button type="button">Arrumação</button>
    <button type="button">Tudo</button>
  </div>
  <label class="pp-ideias-todas"><input type="checkbox" /> Aplicar o visual a todas as lâminas</label>
\`;

const seg = host.querySelector<HTMLElement>(".pp-seg")!;
const corpo = host.closest(".pp-side-corpo") as HTMLElement | null;
const botoes = [...seg.querySelectorAll<HTMLElement>("button")];
const cortados = botoes.filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent ?? "");
const sobra = seg.scrollWidth - seg.clientWidth;
document.getElementById("info")!.textContent =
  "painel=" + host.clientWidth + "  filtro=" + seg.clientWidth + "/" + seg.scrollWidth +
  "  sobra=" + sobra + (sobra > 1 ? " (ESTOURA)" : " (cabe)") +
  "  botoes=" + botoes.map((b) => (b.textContent ?? "").slice(0, 4) + ":" + b.clientWidth + "/" + b.scrollWidth).join(" ") +
  "  cortados=" + (cortados.length ? cortados.join(",") : "-") +
  "  corpo=" + (corpo ? corpo.clientWidth + "/" + corpo.scrollWidth : "?");
`,
  "utf8"
);

await build({
  entryPoints: [entrada],
  bundle: true,
  outfile: join(temp, "harness-painel.js"),
  logLevel: "error",
  external: ["/fonts/*"],
  loader: { ".woff2": "file", ".woff": "file", ".png": "file", ".svg": "file" },
});
const css = existsSync(join(temp, "harness-painel.css")) ? "harness-painel.css" : "";
writeFileSync(
  join(temp, "harness-painel.html"),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="${css}">
<style>body { margin: 0; background: var(--bg); width: ${largura}px; }
#painel { --pp-side-w: ${largura}px; }</style>
</head><body><pre id="info" style="padding:6px 10px;color:#555;font:11px monospace;white-space:pre-wrap"></pre><aside id="painel" class="pp-side"></aside><script src="harness-painel.js"></script></body></html>`,
  "utf8"
);

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const foto = join(temp, `painel-${largura}.png`);
execFileSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--window-size=${largura + 20},400`,
  `--screenshot=${foto}`,
  "--virtual-time-budget=1500",
  `file:///${join(temp, "harness-painel.html").replace(/\\/g, "/")}`,
]);
console.log("foto:", foto);
