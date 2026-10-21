// Trava do Pacote IA: a leitura das imagens do Markdown (a parte pura).
//
// O ZIP em si é montado com o JSZip e precisa do disco (handles) — é exercitado no navegador.
// O que dá para travar no Node é a decisão de **quais** imagens entram: as locais, uma vez
// cada, sem as URLs e sem os `data:` (que já estão dentro do texto).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-pacote-"));
await build({
  entryPoints: [join(raiz, "src/disco/pacote.ts")],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: join(tmp, "pacote.mjs"),
  logLevel: "error",
});
const { imagensDoMarkdown } = await import(pathToFileURL(join(tmp, "pacote.mjs")).href);

let falhas = 0;
const ok = (nome, cond, extra = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${extra ? `  ${extra}` : ""}`);
  if (!cond) falhas++;
};

const lista = (md) => imagensDoMarkdown(md).join(",");

ok("uma imagem local", lista("![a](assets/a.png)") === "assets/a.png");
ok("duas imagens", lista("![a](assets/a.png) e ![b](assets/b.jpg)") === "assets/a.png,assets/b.jpg");
ok("a mesma imagem duas vezes entra uma vez", lista("![a](assets/a.png) ![a](assets/a.png)") === "assets/a.png");
ok("imagem com título", lista('![a](assets/a.png "o título")') === "assets/a.png");
ok("destino entre <>", lista("![a](<assets/com espaço.png>)") === "assets/com espaço.png");
ok("a leitura entrega o data: (o export é que filtra)", imagensDoMarkdown("![a](data:image/png;base64,xx)")[0] === "data:image/png;base64,xx");
ok("texto sem imagem não devolve nada", imagensDoMarkdown("só texto, [link](x) e ![sem fechar").length === 0);
ok("Markdown quebrado não quebra a leitura", imagensDoMarkdown("![a](").length === 0);

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
