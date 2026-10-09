// Testa o motor de apresentações sem abrir o app:
//   1) a edição de texto por trecho (parasComTexto) mantém cor/fonte/tamanho do que não mudou;
//   2) o importador lê cada .pptx de uma pasta (argumento ou variável PPTX_DIR) sem erro, com formas e imagens.
// Uso: node scripts/testar-pptx.mjs [pasta-com-pptx]
import { build } from "esbuild";
import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pptx-test-"));
const empacotar = async (entrada, saida) => {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

// ---------------------------------------------------------------- 1) edição de texto por trecho
const { parasComTexto } = await empacotar("src/powerpoint/render/forma.ts", "forma.mjs");
const run = (text, color, extra = {}) => ({ text, size: 36, bold: false, italic: false, underline: false, strike: false, color, font: "X", ...extra });
const mk = (runs) => [{ runs, align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 36 }];
const base = () => mk([run("TECNOLOGIA DA INFORMAÇÃO", "000000"), run("\n", "000000", { br: true }), run("REINTEGRAÇÃO DE T.I.", "00FF00")]);
const t = "TECNOLOGIA DA INFORMAÇÃO\nREINTEGRAÇÃO DE T.I.";
let p = parasComTexto(base(), t.replace("TECNOLOGIA", "TEC"));
ok("edição no meio da 1ª linha só muda o trecho preto", p[0].runs[0].text === "TEC DA INFORMAÇÃO" && p[0].runs[0].color === "000000" && p[0].runs[2].color === "00FF00");
p = parasComTexto(base(), t + "!");
ok("digitar no fim prolonga o trecho verde", p[0].runs[2].text.endsWith("T.I.!") && p[0].runs[2].color === "00FF00");
p = parasComTexto(base(), "X" + t);
ok("digitar no começo prolonga o primeiro trecho", p[0].runs[0].text.startsWith("XTEC") && p[0].runs[0].color === "000000");
p = parasComTexto(base(), t + "\nNova linha");
ok("linha nova no fim herda o estilo do último trecho", p.length === 2 && p[1].runs[0].color === "00FF00" && p[0].runs[2].color === "00FF00");
ok("sem mudança devolve os mesmos parágrafos", (() => { const b = base(); return parasComTexto(b, t) === b; })());
ok("apagar tudo deixa um parágrafo vazio", parasComTexto(base(), "").length === 1);

// ---------------------------------------------------------------- 2) importação de arquivos reais
const pasta = process.argv[2] ?? process.env.PPTX_DIR;
if (!pasta || !existsSync(pasta)) {
  console.log("(sem pasta de .pptx: passe uma pasta como argumento ou defina PPTX_DIR para testar a importação)");
} else {
  const { pptxToDeck } = await empacotar("src/powerpoint/pptximport/index.ts", "imp.mjs");
  const arquivos = readdirSync(pasta).filter((n) => /\.pptx$/i.test(n) && !n.startsWith("~$"));
  for (const nome of arquivos) {
    try {
      const r = await pptxToDeck(new Uint8Array(readFileSync(join(pasta, nome))));
      const formas = r.deck.slides.reduce((a, s) => a + s.shapes.length, 0);
      const imagens = Object.keys(r.setup.media ?? {}).length;
      const vazias = r.deck.slides.filter((s) => !s.shapes.length).length;
      ok(`importa ${nome}`, r.deck.slides.length > 0 && formas > 0, `${r.deck.slides.length} lâminas, ${formas} formas, ${imagens} imagens, ${vazias} sem formas, ${r.avisos.length} aviso(s)`);
    } catch (e) {
      ok(`importa ${nome}`, false, String(e));
    }
  }
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
