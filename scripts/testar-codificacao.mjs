// Testa que NENHUM arquivo do app tem texto corrompido por duplo-encode.
//
// O que aconteceu: um arquivo gravado com o UTF-8 reinterpretado como Windows-1252 (o
// "duplo encode" clássico). O resultado é o texto na tela virando "A©", "A¡", "A§Aµes" —
// o aviso do selo do PowerPoint apareceu assim ("Este .pptx A© um arquivo seu...").
// Como o bug só aparece na TELA (o TypeScript compila qualquer byte), nada o pegava.
//
// Este teste:
//  - varre src/, scripts/, docs/ e os arquivos da raiz atrás das marcas do duplo-encode
//    (uma linha com o marcador `codificacao-ok` é ignorada: assim a documentação pode
//    citar o texto corrompido de propósito);
//  - confere que o aviso do selo sai com os acentos certos (o texto que o usuário lê).
// Uso: node scripts/testar-codificacao.mjs
import { readFileSync, readdirSync, statSync, mkdtempSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

// ---------------------------------------------------------------------------
// 1) as marcas do duplo-encode
// ---------------------------------------------------------------------------
// Cada padrão abaixo é o que o UTF-8 vira quando lido como Windows-1252: "é" -> "A©",
// "—" -> "a€"", "ã" -> "A£". As sequências são montadas por CÓDIGO DE CARACTERE (e não
// escritas literal), para o próprio teste não casar com a própria regra.
const C = (c) => String.fromCharCode(c);
const LAT = `[${C(0x80)}-${C(0xbf)}]`;
const MARCAS = [
  { re: new RegExp(`${C(0xc3)}${LAT}`, "g"), nome: "acento virando A+byte (Latin-1)" },
  { re: new RegExp(`${C(0xc2)}${LAT}`, "g"), nome: "A+byte (Latin-1)" },
  { re: new RegExp(`${C(0xe2)}${LAT}${LAT}`, "g"), nome: "a+2 bytes (Latin-1)" },
  { re: new RegExp(`${C(0xd0)}${LAT}`, "g"), nome: "D+byte (Latin-1)" },
  { re: new RegExp(`${C(0xd1)}${LAT}`, "g"), nome: "N+byte (Latin-1)" },
];

/** A linha é uma citação intencional do texto corrompido? */
const EXCECAO = "codificacao-ok";

const EXTENSOES = [".ts", ".tsx", ".js", ".mjs", ".mts", ".cjs", ".css", ".html", ".json", ".md"];
const IGNORAR = new Set(["node_modules", ".git", "dist", ".worktrees", "public", "temp", "target"]);

/** Arquivos de texto do repositório (o que o git versiona). */
function arquivos(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const p = join(dir, nome);
    const s = statSync(p);
    if (s.isDirectory()) arquivos(p, saida);
    else if (EXTENSOES.some((e) => nome.endsWith(e))) saida.push(p);
  }
  return saida;
}

const alvos = [...arquivos(join(raiz, "src")), ...arquivos(join(raiz, "scripts")), ...arquivos(join(raiz, "docs"))];
for (const nome of ["README.md", "CHANGELOG.md", "AGENTS.md"]) {
  try {
    alvos.push(join(raiz, nome));
  } catch {
    /* não existe */
  }
}

const sujos = [];
for (const p of alvos) {
  const linhas = readFileSync(p, "utf8").split(/\r?\n/);
  linhas.forEach((linha, i) => {
    if (linha.includes(EXCECAO)) return;
    for (const { re, nome } of MARCAS) {
      const achados = linha.match(re);
      if (achados) sujos.push({ p: relative(raiz, p), linha: i + 1, nome, n: achados.length });
    }
  });
}
ok(
  "nenhum arquivo do app tem texto com duplo-encode",
  sujos.length === 0,
  sujos.map((s) => `${s.p}:${s.linha} (${s.n}x ${s.nome})`).join(" | "),
);

// ---------------------------------------------------------------------------
// 2) o aviso do selo: o texto que o usuário lê na tela
// ---------------------------------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), "codif-"));
await build({ entryPoints: [join(raiz, "src/app/seloAutosave.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "selo.mjs"), logLevel: "error" });
const selo = await import(pathToFileURL(join(tmp, "selo.mjs")).href);

const aviso = selo.avisoOfficeSemAutosave("ppt");
ok("o aviso do .pptx tem os acentos certos", aviso.includes("é um arquivo seu") && aviso.includes("automático não reescreve") && aviso.includes("alterações ficam no histórico"), aviso.slice(0, 60) + "...");
ok("o aviso do .pptx não tem marca de duplo-encode", !MARCAS.some(({ re }) => re.test(aviso)));
ok("o aviso do .docx sai com a extensão certa", selo.avisoOfficeSemAutosave("word").startsWith("Este .docx é um arquivo seu"));
ok("o aviso do .xlsx sai com a extensão certa", selo.avisoOfficeSemAutosave("xlsx").startsWith("Este .xlsx é um arquivo seu"));
ok("o aviso do .pptx sai com a extensão certa", aviso.startsWith("Este .pptx é um arquivo seu"));

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
