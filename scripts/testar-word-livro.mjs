// Trava do MODO LIVRO do Word:
//  - a página N cai na casa certa da grade (duas por faixa: a ímpar à esquerda, a par à
//    direita; a faixa seguinte embaixo);
//  - a folha mede duas páginas de largura e a lombada fica no meio;
//  - a medição da paginação acontece SEM o deslocamento (senão a quebra sai errada);
//  - no impresso, o livro volta a ter uma página de largura.
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-word-livro-"));
await build({ entryPoints: [join(raiz, "src/word/pagination.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "pag.mjs"), logLevel: "error" });
const { lugarDaPagina, passoDaPagina } = await import(pathToFileURL(join(tmp, "pag.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
  if (!cond) falhas++;
};

const L = 794; // a largura da página (A4)
const P = 1151; // o passo (a altura da página + o vão)

// onde cada página acaba: a casa na grade (a linha = a faixa, a coluna = o lado)
const casa = (i) => {
  const { dx, dy } = lugarDaPagina(i, L, P);
  return { linha: Math.floor(i / 2), coluna: i % 2, x: i * P + dy, y: dx };
};

ok("a primeira página fica no canto", casa(0).linha === 0 && casa(0).coluna === 0 && casa(0).x === 0 && casa(0).y === 0, JSON.stringify(casa(0)));
ok("a segunda página fica ao lado (mesma faixa)", casa(1).linha === 0 && casa(1).coluna === 1 && casa(1).x === 0, JSON.stringify(casa(1)));
ok("a terceira página desce para a faixa de baixo", casa(2).linha === 1 && casa(2).coluna === 0 && casa(2).x === P, JSON.stringify(casa(2)));
ok("a quarta página fica ao lado da terceira", casa(3).linha === 1 && casa(3).coluna === 1 && casa(3).x === P, JSON.stringify(casa(3)));
ok("a quinta página abre a terceira faixa", casa(4).linha === 2 && casa(4).coluna === 0 && casa(4).x === 2 * P, JSON.stringify(casa(4)));

// o deslocamento é o que o CSS aplica: o X vai para a direita, o Y sobe
const d1 = lugarDaPagina(1, L, P);
ok("a segunda página anda uma página para a direita", d1.dx === L, JSON.stringify(d1));
ok("a segunda página sobe um passo", d1.dy === -P, JSON.stringify(d1));
const d3 = lugarDaPagina(3, L, P);
ok("a quarta página sobe dois passos", d3.dy === -2 * P, JSON.stringify(d3));
ok("a quarta página anda para a direita", d3.dx === L, JSON.stringify(d3));

// o passo é a altura da página mais o vão entre elas
const passo = passoDaPagina({ size: "A4", landscape: false, margins: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, header: "", footer: "", pageNumbers: true, defaultFont: "Calibri", defaultSize: 11 });
ok("o passo é a página mais o vão", passo > 1123, String(passo));

// ---------- o desenho e a medição ----------
const css = readFileSync(join(raiz, "src/styles/word.css"), "utf8");
ok("a folha mede duas páginas de largura", css.includes("width: calc(var(--pg-w) * 2)"), "");
ok("a lombada fica no meio da folha", css.includes("rgba(0, 0, 0, 0.16) 50%"), "");
ok("a medição desliga o deslocamento", css.includes(".wd-doc.wd-measuring .wd-livro"), "");
ok("no impresso o livro volta a uma página", css.includes("body.word-open #word-pane.wd-modo-livro .wd-sheet"), "");

const pag = readFileSync(join(raiz, "src/word/pagination.ts"), "utf8");
ok("a paginação sabe o modo da folha", pag.includes("modo?: () => ModoPagina"), "");
ok("o modo livro divide o espaçador (rodapé e cabeçalho)", pag.includes("buildRodape") && pag.includes("buildTopo"), "");

const host = readFileSync(join(raiz, "src/word/host.ts"), "utf8");
ok("o host tem o modo livro", host.includes('"livro"'), "");
ok("a altura do livro acompanha o número de páginas", host.includes("alturaDoLivro"), "");

const fita = readFileSync(join(raiz, "src/word/ribbon.ts"), "utf8");
ok("a fita tem o botão Livro", fita.includes("view-book"), "");

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
