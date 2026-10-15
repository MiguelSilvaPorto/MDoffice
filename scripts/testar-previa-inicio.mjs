// Testa a estrutura da prévia dos cartões da tela Início (src/homePrevia.ts): o tipo e o texto que
// o Rust devolve viram a FORMA de cada cartão — página (Word), página com markdown (Markdown),
// lâmina (PowerPoint) e grade (Excel) — com os limites do cartão.
// Uso: node scripts/testar-previa-inicio.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "md-previa-"));
await build({ entryPoints: [join(raiz, "src/homePrevia.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "previa.mjs"), logLevel: "error" });
const P = await import(pathToFileURL(join(tmp, "previa.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

// 1) vazio: o cartão fica com o ícone do formato
{
  const e = P.estruturarPrevia("docx", "   \n  \n");
  ok("sem texto a prévia é vazia (o ícone do formato fica)", e.forma === "vazia", JSON.stringify(e));
  ok("um tipo desconhecido com texto também não vira forma", P.estruturarPrevia("outro", "oi").forma === "pagina");
}

// 2) Word: uma página com o título (a 1ª linha) e os parágrafos seguintes
{
  const texto = "teste de escrita\nSegundo parágrafo\nTerceiro";
  const e = P.estruturarPrevia("docx", texto);
  ok("Word vira PÁGINA com o primeiro parágrafo no título", e.forma === "pagina" && e.titulo === "teste de escrita", JSON.stringify({ forma: e.forma, titulo: e.titulo }));
  ok("Word leva os parágrafos seguintes para o corpo", e.linhas.length === 2 && e.linhas[0] === "Segundo parágrafo", JSON.stringify(e.linhas));
  ok("as linhas em branco do arquivo somem", JSON.stringify(P.estruturarPrevia("docx", "A\n\n\nB").linhas) === '["B"]');
}

// 3) o corpo é limitado ao que o cartão mostra
{
  const muitas = Array.from({ length: 40 }, (_, i) => `linha ${i}`).join("\n");
  const e = P.estruturarPrevia("docx", muitas);
  ok("a página corta o corpo no limite do cartão", e.linhas.length === P.LINHAS_PAGINA, String(e.linhas.length));
  const l = P.estruturarPrevia("pptx", muitas);
  ok("a lâmina corta em menos linhas ainda", l.linhas.length === P.LINHAS_LAMINA, String(l.linhas.length));
}

// 4) Markdown: a forma manda a tela renderizar o texto inteiro
{
  const md = "# Título\n\n- um\n- dois\n\n[Desenho](assets/desenho.png)\n\n**forte**";
  const e = P.estruturarPrevia("md", md);
  ok("Markdown vira PÁGINA-MD com o texto inteiro (a tela renderiza)", e.forma === "pagina-md" && e.bruto === md.trim(), JSON.stringify({ forma: e.forma, bruto: e.bruto.slice(0, 20) }));
  ok("o título do markdown é a primeira linha", e.titulo === "# Título", e.titulo);
}

// 5) PowerPoint: a lâmina com o primeiro texto no título
{
  const e = P.estruturarPrevia("pptx", "Sua apresentação\nNome do apresentador · data\nmais");
  ok("PowerPoint vira LÂMINA", e.forma === "lamina" && e.titulo === "Sua apresentação", JSON.stringify({ forma: e.forma, titulo: e.titulo }));
  ok("o resto do texto vira o corpo da lâmina", e.linhas.join("|") === "Nome do apresentador · data|mais", JSON.stringify(e.linhas));
}

// 6) Excel: a grade com as células separadas por TAB
{
  const e = P.estruturarPrevia("xlsx", "Nome\tIdade\tCidade\nAna\t32\tRecife\n\nBia\t\tOlinda");
  ok("Excel vira GRADE", e.forma === "grade", JSON.stringify({ forma: e.forma }));
  ok("as células ficam nas colunas certas", JSON.stringify(e.grade[0]) === '["Nome","Idade","Cidade"]' && JSON.stringify(e.grade[2]) === '["Bia","","Olinda"]', JSON.stringify(e.grade));
  ok("a linha toda vazia não entra na grade", e.grade.length === 3, String(e.grade.length));
  const g = P.estruturarPrevia("xlsx", Array.from({ length: 9 }, (_, i) => `a${i}\tb${i}`).join("\n")).grade;
  ok("a grade corta no limite do cartão", g.length === P.LINHAS_GRADE && g[0].length === 2, JSON.stringify(g.map((l) => l.length)));
  ok("uma linha com colunas de mais é cortada", P.gradeDoTexto(["a\tb\tc\td\te\tf"])[0].length === P.COLUNAS_GRADE);
}

// 7) as células com espaços duplos são arrumadas
{
  const g = P.gradeDoTexto(["Ana    Maria\t32"])[0];
  ok("os espaços internos da célula viram um só", g[0] === "Ana Maria", JSON.stringify(g));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
