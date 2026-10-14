// Teste do corpus dos n-gramas: o limpador de HTML (o que entra no modelo) e os utilitários
// do build. O download em si não entra aqui (depende da rede): o que se prende é a REGRA —
// tabela, referência e nota de edição ficam fora; prosa fica.
//
// Roda com: npm run test:corpus
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { textoDoHtml } from "./corpus-texto.mjs";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

console.log("limpador do HTML da Wikipédia (o que vira texto do modelo)");
{
  const html = `
    <style>.x{color:red}</style>
    <p>Conteúdo é o conjunto de informações de um documento. A norma estabelece como apresentar
    as citações, as referências e os elementos pré-textuais, com regras de formato para cada caso,
    e o texto corrido é o que interessa ao modelo de n-gramas do aplicativo.</p>
    <table class="info"><tr><td>Nascimento</td><td>1940</td></tr></table>
    <p>A normalização estabelece regras de formato para citações.<sup class="reference">[1]</sup></p>
    <span class="mw-editsection">[<a href="#">editar</a>]</span>
    <h2>Referências</h2>
    <ol><li>SILVA, A. Livro. Rio: Editora, 2020.</li></ol>`;
  const texto = textoDoHtml(html);
  ok("a prosa fica", texto.includes("Conteúdo é o conjunto de informações de um documento"), texto.slice(0, 60));
  ok("a prosa seguinte também", texto.includes("A normalização estabelece regras de formato"), "");
  ok("a prosa vira linha (não um parágrafo só)", texto.split("\n").length >= 2, String(texto.split("\n").length));
  ok("tabela sai", !texto.includes("Nascimento") && !texto.includes("1940"));
  ok("nota de edição sai", !texto.includes("editar"));
  ok("referência sai", !texto.includes("SILVA, A. Livro") && !texto.includes("Referências"));
  ok("marcação sai", !/[<>]/.test(texto), texto.match(/[<>]/g)?.join("") ?? "");
  ok("linha curta (legenda solta) sai", textoDoHtml("<p>Ok</p><p>Uma frase de verdade com mais de vinte e cinco caracteres.</p>").split("\n").every((l) => l.length > 25));
}
{
  const comRev = textoDoHtml(`<p>Escrevemos uma frase longa e correta para o corpus de n-gramas do aplicativo.</p><h2>Ver também</h2><ul><li>Outro artigo qualquer</li></ul>`);
  ok("o rabo de 'Ver também' é cortado", !comRev.includes("Outro artigo qualquer"), comRev.slice(0, 70));
}
{
  const soEntidades = textoDoHtml(`<p>&nbsp;Testamos &amp; entidades &quot;assim&quot; com acentos: ação, coração, você e referência.</p>`);
  ok("entidades viram texto limpo", !/&[a-z]+;|&#\d+;/i.test(soEntidades), soEntidades.slice(0, 80));
}

console.log("o repositório tem o que o build precisa");
{
  const build = readFileSync(join(raiz, "scripts/build-ngrams.mjs"), "utf8");
  ok("o build aceita uma PASTA de corpus", /readdirSync\(caminho\)/.test(build) && /isDirectory\(\)/.test(build));
  const baixador = readFileSync(join(raiz, "scripts/baixar-corpus.mjs"), "utf8");
  ok("o baixador grava o manifesto dos títulos", /MANIFESTO/.test(baixador) && /corpus-wikipedia\.txt/.test(baixador));
  const gitignore = readFileSync(join(raiz, ".gitignore"), "utf8").split(/\r?\n/);
  ok("o manifesto não é ignorado pelo Git", !gitignore.includes("scripts/corpus-wikipedia.txt"));
  ok("o corpus fica fora do Git", gitignore.includes("corpus/"));
}

console.log(falhas ? `\n${falhas} falha(s).` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
