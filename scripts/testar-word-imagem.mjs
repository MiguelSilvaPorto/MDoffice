// Trava: parágrafo com IMAGEM não aplica entrelinha fixa — a imagem inline é mais alta que a linha e,
// com `line-height` fixo, vaza por cima do texto e captura o clique (o texto fica impossível de editar).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-word-img-"));
await build({ entryPoints: [join(raiz, "src/word/schema.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "schema.mjs"), logLevel: "error" });
const { schema } = await import(pathToFileURL(join(tmp, "schema.mjs")).href);

const estilo = (no) => {
  const spec = schema.nodes.paragraph.spec.toDOM(no);
  return Array.isArray(spec) ? String(spec[1]?.style ?? "") : "";
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
  if (!cond) falhas++;
};

const img = schema.nodes.image.create({ src: "data:image/png;base64,AAAA", width: 300, height: 200 });
const comImagem = schema.nodes.paragraph.create({ lineHeight: 1 }, [img]);
const semImagem = schema.nodes.paragraph.create({ lineHeight: 1.5 }, [schema.text("texto")]);

ok("parágrafo com imagem não fixa a entrelinha", !estilo(comImagem).includes("line-height"), JSON.stringify(estilo(comImagem)));
ok("parágrafo sem imagem mantém a entrelinha", estilo(semImagem).includes("line-height:1.5"), JSON.stringify(estilo(semImagem)));

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
