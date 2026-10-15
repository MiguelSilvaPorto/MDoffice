// Harness de conferência visual da fita (a Fita REAL + o CSS REAL), para fotografar e ajustar.
// Uso: node scripts/harness-fita.mjs 1520   -> gera temp/harness-fita.html e a foto com o Chrome
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });
const largura = Number(process.argv[2] ?? 1520);
const aba = String(process.argv[3] ?? "desenhar");

const entrada = join(raiz, "scripts", ".harness-fita.ts");
writeFileSync(
  entrada,
  `
import { Fita } from "../src/powerpoint/ui/fita";
import { ligarEncaixeFita } from "../src/fita";
import "../src/styles.css";

const host = document.getElementById("pp-ribbon") as HTMLElement;
const base: any = {
  temLamina: true, indice: 0, total: 1, layout: "conteudo", oculta: false,
  formas: [], forma: undefined, editando: false, trecho: null,
  podeDesfazer: false, podeRefazer: false, temCopia: false, zoom: 100,
  ferramenta: null, pincel: { cor: "4f46e5", w: 2, modo: "livre", assistente: true, tipo: "caneta" },
  fixas: true, encaixe: true, grade: false, faixaVertical: false,
  paleta: [], fontes: ["Segoe UI"], setup: { aspect: "16:9", theme: "claro", showNumber: true, footer: "", fontFamily: "Segoe UI", fontSize: 18, bg: "" },
  ultimoLayout: "conteudo", temGrupo: false, largura: 0, altura: 0, celulas: null, cantosSel: ["tl", "tr", "br", "bl"],
  estudio: false, podeIsolar: false, regioes: false, pintura: "nenhuma", pinturaTransp: 0.35,
  modelo: false, desvinculavel: false, revinculavel: false,
};
try {
  const fita = new Fita(host, { estado: () => base, run: () => {} });
  host.querySelector<HTMLElement>('[data-aba="${aba}"]')?.click();
  ligarEncaixeFita({ el: host, painel: ".ppr-painel", grupo: ".ppr-grupo", corpo: ".ppr-corpo", rotulo: ".ppr-rotulo" });
} catch (e) {
  document.title = "ERRO: " + e;
  const p = document.createElement("pre");
  p.id = "erro";
  p.textContent = String(e) + "\\n" + (e as Error).stack;
  document.body.append(p);
}
`,
  "utf8"
);

await build({
  entryPoints: [entrada],
  bundle: true,
  outfile: join(temp, "harness-fita.js"),
  logLevel: "error",
  // as fontes do app vêm de /fonts/... (servidas pelo public/): no harness ficam penduradas, o que
  // não muda o layout que queremos fotografar
  external: ["/fonts/*"],
  loader: { ".woff2": "file", ".woff": "file", ".png": "file", ".svg": "file" },
});
const css = existsSync(join(temp, "harness-fita.css")) ? "harness-fita.css" : "";
const info = "<pre id='info' style='padding:6px 10px;color:#555;font:11px monospace'></pre>" +
  "<script>(function(){var h=document.getElementById('pp-ribbon'),p=h.querySelector('.ppr-painel:not([hidden])');" +
  "document.getElementById('info').textContent='ajuste='+getComputedStyle(h).getPropertyValue('--fita-ajuste')+'  degrau='+(h.dataset.fitaDegrau||'-')+'  painel='+p.clientWidth+'  conteudo='+p.scrollWidth+'  colapsados='+h.querySelectorAll('.fita-grupo-recolhido').length;})()</" + "script>";
writeFileSync(
  join(temp, "harness-fita.html"),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="${css}">
<style>body { margin: 0; background: var(--bg); }
#pp-ribbon { width: ${largura}px; } #erro { padding: 12px; color: #b91c1c; font: 12px monospace; white-space: pre-wrap; }</style>
</head><body><div id="pp-ribbon" class="pp-ribbon ppr" role="toolbar"></div><script src="harness-fita.js"></script>${info}</body></html>`,
  "utf8"
);

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const foto = join(temp, `fita-${aba}-${largura}.png`);
execFileSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--window-size=${largura},260`,
  `--screenshot=${foto}`,
  `--virtual-time-budget=1500`,
  `file:///${join(temp, "harness-fita.html").replace(/\\/g, "/")}`,
]);
console.log("foto:", foto);
