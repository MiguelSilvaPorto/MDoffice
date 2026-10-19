// Bancada da Recomposição: lê um .pptx (uma CÓPIA — nunca o original), recompõe cada lâmina e
// mede o resultado: sobreposições, texto que vaza, menor letra de conteúdo, caixas fora da lâmina
// e o que mudou. Uso: node scripts/testar-recompor.mjs <arquivo.pptx> [--formas]
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: node scripts/testar-recompor.mjs <arquivo.pptx> [--formas]");
  process.exit(2);
}
const detalhar = process.argv.includes("--formas");
const tmp = mkdtempSync(join(tmpdir(), "pp-recompor-"));
async function empacotar(entrada, saida) {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
}

const imp = await empacotar("src/powerpoint/pptximport/index.ts", "imp.mjs");
const R = await empacotar("src/powerpoint/edicao/recompor.ts", "rec.mjs");

const deck = await imp.pptxToDeck(new Uint8Array(readFileSync(arquivo)));
const slides = deck.deck.slides;
const w = Number(deck.setup?.widthIn ?? 13.333);
const h = Number(deck.setup?.heightIn ?? 7.5);
const ratio = (w * 72) / (h * 72);

const letraMax = (s) => Math.max(s.fontSize || 0, ...(s.paras ?? []).flatMap((p) => p.runs.map((r) => r.size ?? 0)));
const texto = (s) => (s.paras ?? []).flatMap((p) => p.runs.map((r) => r.text ?? "")).join("").trim();

/** O texto cabe na caixa? (mesma conta da Arrumação) */
function textoCabe(s, alturaPt = 540) {
  const util = Math.max(8, (s.box.w / 100) * 960 - 8);
  const paras = (s.paras ?? []).map((p) => ({ texto: p.runs.map((r) => r.text ?? "").join(""), letra: Math.max(1, ...p.runs.map((r) => r.size ?? s.fontSize)) }));
  if (!paras.length) return true;
  const trechos = (s.paras ?? []).flatMap((p) => p.runs.map((r) => ({ texto: r.text ?? "", letra: r.size ?? s.fontSize })));
  if (!trechos.every((t) => Math.max(1, ...t.texto.split(/\s+/).map((x) => x.length)) * t.letra * 0.55 <= util * 1.08)) return false;
  const necessario = paras.reduce((a, p) => a + Math.max(1, Math.ceil((p.texto.length * p.letra * 0.5) / util)) * p.letra * 1.2, 0);
  return necessario <= ((s.box.h / 100) * alturaPt - 4) * 1.12;
}

const sobrepoe = (a, b) => {
  const w2 = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h2 = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w2 > 0 && h2 > 0 && w2 * h2 > 0.05 * Math.min(a.w * a.h, b.w * b.h);
};

console.log(`arquivo: ${arquivo}`);
console.log(`lâminas: ${slides.length} | ${w.toFixed(2)}×${h.toFixed(2)} in`);
console.log("");
let falhas = 0;
const resumo = [];
for (const [i, s] of slides.entries()) {
  const novo = R.recompor(s, ratio);
  const mudou = novo !== s;
  const caixas = novo.shapes.filter((f) => !f.fixa && f.box.w > 0 && f.box.h > 0);
  const fora = caixas.filter((f) => f.box.x < -0.5 || f.box.y < -0.5 || f.box.x + f.box.w > 100.5 || f.box.y + f.box.h > 100.5);
  // "vaza" só conta quando o texto cabia ANTES e deixou de caber (o modelo já usa caixas justas)
  const antes = new Map(s.shapes.map((f) => [f.id, f]));
  const vaza = novo.shapes.filter((f) => {
    if (f.fixa || !f.paras?.length || !texto(f) || textoCabe(f)) return false;
    const a = antes.get(f.id);
    return !!a && textoCabe(a);
  });
  const textos = novo.shapes.filter((f) => !f.fixa && f.paras?.length && texto(f));
  const letras = textos.map(letraMax).filter((n) => n > 0);
  const minLetra = letras.length ? Math.min(...letras) : 0;
  // sobreposição entre os TEXTOS da lâmina (os painéis de fundo ficam atrás do texto de propósito).
  // Só conta o que é NOVO: o deck original já tem sobreposições de desenho que não são defeito nosso.
  const textosDe = (sl) => sl.shapes.filter((f) => !f.fixa && f.paras?.length && texto(f));
  const contarSobre = (sl) => {
    const ts = textosDe(sl);
    let n = 0;
    for (let a = 0; a < ts.length; a++) for (let b = a + 1; b < ts.length; b++) if (sobrepoe(ts[a].box, ts[b].box)) n++;
    return n;
  };
  const sobre = Math.max(0, contarSobre(novo) - contarSobre(s));
  const ok = fora.length === 0 && vaza.length === 0 && sobre === 0;
  if (!ok) falhas++;
  resumo.push({ lamina: i + 1, mudou, fora: fora.length, vaza: vaza.length, sobre, minLetra: Math.round(minLetra * 10) / 10 });
  console.log(
    `lâmina ${String(i + 1).padStart(2)} | ${mudou ? "recomposta" : "sem mudança"} | sobreposições ${String(sobre).padStart(2)} | texto vazando ${String(vaza.length).padStart(2)} | fora da lâmina ${fora.length} | menor letra ${minLetra.toFixed(1)} pt | ${ok ? "ok" : "FALHA"}`
  );
  if (detalhar || !ok) {
    for (const f of vaza.slice(0, 6)) console.log(`          vaza: ${f.id} "${texto(f).slice(0, 40)}" letra ${letraMax(f).toFixed(1)} box ${f.box.w.toFixed(1)}×${f.box.h.toFixed(1)}`);
    for (const f of fora.slice(0, 6)) console.log(`          fora: ${f.id} box ${f.box.x.toFixed(1)},${f.box.y.toFixed(1)} ${f.box.w.toFixed(1)}×${f.box.h.toFixed(1)}`);
  }
}
console.log("");
console.log(falhas ? `FALHAS: ${falhas} lâmina(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
