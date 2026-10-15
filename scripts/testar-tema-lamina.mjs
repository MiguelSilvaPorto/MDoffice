// Testa a regra "o tema do app não decide o papel da apresentação": a apresentação nova nasce
// CLARA (papel branco) e quem quiser lâmina escura escolhe o tema "Escuro" na apresentação.
// Prende também o que não pode mudar junto: o documento que já existia mantém o tema que tinha,
// a importação de .pptx segue clara e nenhum módulo da apresentação pergunta o tema do app.
// Uso: node scripts/testar-tema-lamina.mjs
import { build } from "esbuild";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-tema-"));
const empacotar = async (entrada, saida) => {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

const M = await empacotar("src/powerpoint/model.ts", "model.mjs");
const S = await empacotar("src/powerpoint/schema.ts", "schema.mjs");
const T = await empacotar("src/powerpoint/themes.ts", "themes.mjs");

// A apresentação nova (DEFAULT_SETUP) e o que ela pinta: o papel branco do tema Claro.
console.log("a apresentação nova nasce clara");
ok("o padrão de fábrica é o tema claro", M.DEFAULT_SETUP.theme === "claro", `theme: ${M.DEFAULT_SETUP.theme}`);
ok("o papel do tema claro é branco", S.THEME_COLORS.claro.bg === "FFFFFF", `#${S.THEME_COLORS.claro.bg}`);
const novo = T.stageVars({ ...M.DEFAULT_SETUP });
ok("o palco da apresentação nova pinta papel branco", novo["--slide-bg"] === "#FFFFFF", novo["--slide-bg"]);
ok("a tinta sobre o papel branco é escura (o texto não some)", novo["--slide-fg"] === "#1C212B", novo["--slide-fg"]);

// O outro lado da regra: escurecer a lâmina é ESCOLHA da apresentação, não do app.
console.log("\nescolher o tema Escuro é o que escurece a lâmina (de propósito)");
const escolhido = T.stageVars({ ...M.DEFAULT_SETUP, theme: "escuro" });
ok("com o tema Escuro escolhido a lâmina fica escura", escolhido["--slide-bg"] === "#0E1014", escolhido["--slide-bg"]);
ok("a tinta vira clara", escolhido["--slide-fg"] === "#F4F5F8", escolhido["--slide-fg"]);

// Trocar o padrão de fábrica não pode repintar o que já existe: o tema salvo no documento vence.
console.log("\no documento que já existia mantém o tema que tinha");
const salvo = (setup) => JSON.stringify({ v: 1, setup, slides: [] });
ok("o documento salvo com o tema Escuro continua Escuro", M.deserialize(salvo({ theme: "escuro" }))?.setup.theme === "escuro");
ok("o documento salvo sem tema cai no papel branco", M.deserialize(salvo({}))?.setup.theme === "claro");
ok("o documento de contraste continua contraste", M.deserialize(salvo({ theme: "contraste" }))?.setup.theme === "contraste");
ok("o fundo próprio do documento vence o do tema", M.deserialize(salvo({ theme: "escuro", bg: "123456" }))?.setup.bg === "123456");

// A importação não herda o tema de quem chamou (o app passa o padrão dele como base).
console.log("\na importação de .pptx também nasce clara");
const importador = readFileSync(join(raiz, "src/powerpoint/pptximport/index.ts"), "utf8");
ok(
  "o pptxToDeck fixa o tema claro depois de espalhar a base",
  /\.\.\.setupBase,[\s\S]{0,400}?theme: "claro"/.test(importador),
  "o tema da base (o do app) voltaria a mandar no papel da lâmina"
);

// A regra, virada em vigilância: nada do motor de apresentações pergunta o tema do app.
console.log("\nnem o tema do app entra na lâmina");
const arquivos = [];
const varrer = (dir) => {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, item.name);
    if (item.isDirectory()) varrer(caminho);
    else if (item.name.endsWith(".ts")) arquivos.push(caminho);
  }
};
varrer(join(raiz, "src/powerpoint"));
const perguntam = arquivos.filter((f) => /dataset\.theme|prefers-color-scheme/.test(readFileSync(f, "utf8"))).map((f) => f.slice(raiz.length).replace(/\\/g, "/"));
ok("nenhum módulo da apresentação lê o tema do app", perguntam.length === 0, perguntam.join(", "));

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
