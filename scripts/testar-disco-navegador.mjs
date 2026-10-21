// Trava da camada de disco do navegador (a parte pura).
//
// O acesso ao disco (o File System Access API) só existe no navegador — e é testado no próprio
// navegador. O que dá para travar no Node é o que **decide**: a leitura do XML do Office (a
// prévia do cartão da Início), a limpeza do texto e a grade da planilha.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import JSZip from "jszip";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-disco-"));
await build({ entryPoints: [join(raiz, "src/disco/zip.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "zip.mjs"), logLevel: "error" });
const { textoDeXml, limparPrevia, limparGrade, previaDoArquivo, PREVIA_CHARS } = await import(pathToFileURL(join(tmp, "zip.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
  if (!cond) falhas++;
};

// ---------- o XML do Office ----------
ok("o texto do w:t sai", textoDeXml("<w:p><w:r><w:t>Ola</w:t></w:r></w:p>").trim() === "Ola");
ok("o fim do parágrafo vira quebra", limparPrevia(textoDeXml("<w:p><w:r><w:t>a</w:t></w:r></w:p><w:p><w:r><w:t>b</w:t></w:r></w:p>")) === "a\nb");
ok("o fim do trecho não gruda as palavras", textoDeXml("<w:p><w:r><w:t>uma</w:t></w:r><w:r><w:t>outra</w:t></w:r></w:p>").trim() === "uma outra");

// ---------- a limpeza ----------
ok("os espaços repetidos viram um", limparPrevia("a     b") === "a b");
ok("as linhas em branco somem", limparPrevia("a\n\n\nb") === "a\nb");
ok("a prévia corta no tamanho", limparPrevia("x".repeat(2000)).length === PREVIA_CHARS, String(limparPrevia("x".repeat(2000)).length));

// ---------- a grade da planilha ----------
ok("as células mantêm o TAB", limparGrade("a\tb\tc") === "a\tb\tc");
ok("a linha sem valor some", limparGrade("a\tb\n\t\nc\td") === "a\tb\nc\td");

// ---------- a prévia de verdade, com um .docx montado ----------
const zi = new JSZip();
zi.file("[Content_Types].xml", "<Types/>");
zi.file(
  "word/document.xml",
  `<w:document><w:body>
     <w:p><w:pPr/><w:r><w:t>Contrato de prestacao</w:t></w:r></w:p>
     <w:p><w:r><w:t>Primeira clausula</w:t></w:r></w:p>
   </w:body></w:document>`,
);
const bytes = await zi.generateAsync({ type: "uint8array" });
const previa = await previaDoArquivo("contrato.docx", bytes);
ok("reconhece o .docx", previa.tipo === "docx", previa.tipo);
ok("tira o texto do documento", previa.texto.includes("Contrato de prestacao"), JSON.stringify(previa.texto));
ok("mantém as duas linhas", previa.texto.split("\n").length === 2, JSON.stringify(previa.texto));

const md = await previaDoArquivo("notas.md", new TextEncoder().encode("# Titulo\n\ntexto"));
ok("reconhece o .md", md.tipo === "md" && md.texto.startsWith("# Titulo"), JSON.stringify(md));

const outro = await previaDoArquivo("foto.png", new Uint8Array([1, 2, 3]));
ok("formato desconhecido não quebra", outro.tipo === "outro" && outro.texto === "", JSON.stringify(outro));

const quebrado = await previaDoArquivo("ruim.docx", new Uint8Array([1, 2, 3, 4]));
ok("zip quebrado devolve prévia vazia", quebrado.tipo === "docx" && quebrado.texto === "", JSON.stringify(quebrado));

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
