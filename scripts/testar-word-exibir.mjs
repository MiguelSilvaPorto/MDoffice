// Trava da aba Exibir do Word:
//  - a régua marca os centímetros na medida certa (e o número sai a cada 2 cm quando ela
//    está apertada);
//  - a aba Exibir existe e fica ENTRE Revisão e Tabela (a ordem pedida);
//  - a régua horizontal e a vertical existem na folha e o ícone da fita também.
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-word-exibir-"));
await build({ entryPoints: [join(raiz, "src/word/regua.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "regua.mjs"), logLevel: "error" });
const { marcasDaRegua, ESPESSURA } = await import(pathToFileURL(join(tmp, "regua.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
  if (!cond) falhas++;
};

// ---------- a régua ----------
const CM = 96 / 2.54; // pixels por centímetro
const marcas = marcasDaRegua(21 * CM, 1); // uma folha A4 de largura (21 cm)
ok("a régua marca um centímetro", marcas[1]?.cm === 1, JSON.stringify(marcas[1]));
ok("a marca cai na medida certa", Math.abs((marcas[1]?.pos ?? 0) - CM) < 0.001, String(marcas[1]?.pos));
ok("o número sai a cada centímetro (régua folgada)", marcas.filter((m) => m.numero).length === 21, String(marcas.filter((m) => m.numero).length));
ok("a régua não passa da folha", marcas[marcas.length - 1]?.pos === 21 * CM, String(marcas[marcas.length - 1]?.pos));

const apertada = marcasDaRegua(21 * CM, 0.5);
ok("régua apertada: o número sai a cada 2 cm", apertada.filter((m) => m.numero).length === 10, String(apertada.filter((m) => m.numero).length));
ok("régua apertada: a marca continua a cada centímetro", apertada[2]?.cm === 2 && Math.abs(apertada[2].pos - CM) < 0.001, JSON.stringify(apertada[2]));

const zoom2 = marcasDaRegua(21 * CM, 2);
ok("no zoom 200% a marca dobra de distância", Math.abs((zoom2[1]?.pos ?? 0) - CM * 2) < 0.001, String(zoom2[1]?.pos));
ok("a régua tem espessura de tela", ESPESSURA >= 16 && ESPESSURA <= 28, String(ESPESSURA));

// ---------- a fita e a folha ----------
const fita = readFileSync(join(raiz, "src/word/ribbon.ts"), "utf8");
const abas = [...fita.matchAll(/<button[^>]*data-tab="([a-z]+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]);
const nomes = abas.map((a) => a[0]);
ok("a aba Exibir existe", nomes.includes("view"), nomes.join(","));
const iRev = nomes.indexOf("review");
const iView = nomes.indexOf("view");
const iTab = nomes.indexOf("table");
ok("a aba Exibir fica entre Revisão e Tabela", iRev < iView && iView < iTab, `${iRev} < ${iView} < ${iTab}`);
const iHome = nomes.indexOf("home");
const iInsert = nomes.indexOf("insert");
const iLayout = nomes.indexOf("layout");
ok("a ordem das abas é Início, Inserir, Layout, Revisão, Exibir, Tabela", iHome < iInsert && iInsert < iLayout && iLayout < iRev && iRev < iView && iView < iTab, nomes.join(","));
const rotulos = abas.filter((a) => a[0] === "view").map((a) => a[1]);
ok("a aba se chama Exibir", rotulos[0] === "Exibir", rotulos[0] ?? "");

const html = readFileSync(join(raiz, "index.html"), "utf8");
ok("a régua horizontal existe na folha", html.includes('id="wd-regua-h"'));
ok("a régua vertical existe na folha", html.includes('id="wd-regua-v"'));
ok("o ícone da régua existe", html.includes('id="i-regua"'));

const css = readFileSync(join(raiz, "src/styles/word.css"), "utf8");
ok("o modo Rascunho tem estilo", css.includes("wd-modo-rascunho"));
ok("o modo Leitura tem estilo", css.includes("wd-modo-leitura"));
ok("a régua desligada some (o display do .wd-regua não vence o [hidden])", css.includes(".wd-regua[hidden]"));

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
