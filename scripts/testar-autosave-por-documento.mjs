// Trava do salvamento automático POR DOCUMENTO:
//  - cada aba tem a sua flag (o botão do topo liga/desliga o documento à vista);
//  - a aba sem flag herda o padrão das Configurações (vale para os documentos novos);
//  - a sessão guarda (e devolve) a escolha de cada documento;
//  - o caminho de gravação do app olha a flag do DOCUMENTO, e não um flag global.
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-autosave-"));
await build({ entryPoints: [join(raiz, "src/app/autosave.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "auto.mjs"), logLevel: "error" });
const { autosaveDoDoc, mapaDeAutosave } = await import(pathToFileURL(join(tmp, "auto.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
  if (!cond) falhas++;
};

// ---------- a regra ----------
ok("aba sem flag herda o padrão ligado", autosaveDoDoc({}, true) === true);
ok("aba sem flag herda o padrão desligado", autosaveDoDoc({}, false) === false);
ok("aba com flag desligada vence o padrão", autosaveDoDoc({ autosave: false }, true) === false);
ok("aba com flag ligada vence o padrão", autosaveDoDoc({ autosave: true }, false) === true);

// ---------- a sessão ----------
const mapa = mapaDeAutosave([
  { path: "C:/Docs/A.md", autosave: false },
  { path: "C:/Docs/B.md", autosave: true },
  { path: "C:/Docs/C.md" }, // herda o padrão: não precisa ir na sessão
  { path: null, autosave: false }, // sem caminho (rascunho): não vai no mapa do Tauri
]);
ok("a sessão guarda o desligado", mapa["c:/docs/a.md"] === false, JSON.stringify(mapa));
ok("a sessão guarda o ligado", mapa["c:/docs/b.md"] === true);
ok("quem herda o padrão não vai na sessão", !("c:/docs/c.md" in mapa));
ok("aba sem caminho não vai no mapa", Object.keys(mapa).length === 2, JSON.stringify(mapa));

// ---------- o app usa a flag do documento ----------
const app = readFileSync(join(raiz, "src/app/app.ts"), "utf8");
ok("o app tem o atalho do documento à vista", app.includes("get autosaveLigado()"), "");
const layout = readFileSync(join(raiz, "src/app/layout.ts"), "utf8");
ok("o botão do topo mexe na aba do documento", layout.includes("tab.autosave = next"), "");
ok("o botão do topo não mexe mais no flag global", !/toggleAutosave[\s\S]{0,900}settings\.autosaveOn\s*=/.test(layout), "");
ok("o selo diz de qual documento é o estado", layout.includes("ligado em ${ligados} de ${docs.length} documentos"), "");
const docs = readFileSync(join(raiz, "src/app/documents.ts"), "utf8");
ok("a gravação automática olha o documento", docs.includes("if (!this.autosaveLigado) return;"), "");
const word = readFileSync(join(raiz, "src/app/wordDocs.ts"), "utf8");
ok("o Word olha o documento", word.includes("if (!this.autosaveLigado) return;"), "");
const sessoes = readFileSync(join(raiz, "src/app/tabs.ts"), "utf8");
ok("a sessão devolve a flag de cada documento", sessoes.includes("saved.autosave?.[p.toLowerCase()]"), "");
ok("a sessão do navegador também guarda", sessoes.includes("autosave: t.autosave"), "");

const modelo = readFileSync(join(raiz, "src/tabs.ts"), "utf8");
ok("a aba tem a sua flag", modelo.includes("autosave?: boolean"), "");

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
