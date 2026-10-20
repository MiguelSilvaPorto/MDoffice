// Testa o CLIQUE do corretor do Word (src/word/cliqueSugestao.ts): o popup de sugestões só
// abre quando o clique cai no TEXTO sublinhado — nunca numa imagem, no espaço da linha ou na
// margem — e um problema que atravessa uma imagem/quebra fica sem sugestão (aplicar
// substituiria a faixa inteira e apagaria o que não é texto).
//
//   1) a marca sob o clique (palavra, marca dentro dela, imagem, parágrafo, alvo vazio);
//   2) a faixa do problema contra os nós do documento (imagem no meio, na borda, quebra);
//   3) a fiação no corretor (o handleClick usa a marca e a âncora; a varredura descarta a faixa).
//
// Uso: node scripts/testar-corretor-word.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "wd-corretor-"));
const empacotar = async (entrada, saida) => {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const ler = (rel) => readFileSync(join(raiz, rel), "utf8");

const C = await empacotar("src/word/cliqueSugestao.ts", "clique.mjs");
const { marcaSobClique, atravessaNaoTexto } = C;

// ---------------------------------------------------------------- 1) a marca sob o clique

console.log("corretor do Word: o clique que abre a sugestão");

/** Uma cadeia de elementos como no DOM: o 1º é o alvo; `closest` sobe a partir dele. */
const cadeia = (...seletores) => {
  const nos = seletores.map((s) => ({ sel: s }));
  nos.forEach((no, i) => {
    no.closest = (consulta) => {
      for (let j = i; j < nos.length; j++) if (nos[j].sel.split(" ").some((s) => s.includes(consulta))) return nos[j];
      return null;
    };
  });
  return nos[0];
};

{
  const palavra = cadeia("span.wd-issue.spell", "p.wd-par");
  ok("clique na palavra sublinhada devolve a marca", marcaSobClique(palavra) === palavra);

  const negrito = cadeia("strong", "span.wd-issue.spell", "p");
  ok(
    "clique numa marca dentro da palavra devolve a marca do problema",
    marcaSobClique(negrito)?.sel === "span.wd-issue.spell",
    "o negrito é filho da marca; o alvo sobe até ela"
  );

  ok(
    "clique na IMAGEM não abre sugestão (mesmo com a marca em volta dela)",
    marcaSobClique(cadeia("img", "span.wd-issue.style", "p")) === null
  );
  ok("clique no espaço/parágrafo não abre sugestão", marcaSobClique(cadeia("p")) === null);
  ok("alvo sem closest (nó de texto, nulo) não abre sugestão", marcaSobClique({}) === null && marcaSobClique(null) === null);
}

// ---------------------------------------------------------------- 2) a faixa do problema

console.log("\ncorretor do Word: problema que atravessa imagem fica de fora");

/** O mínimo de `doc.nodesBetween` do ProseMirror: visita os nós cujo início cai em [de, ate). */
const docFake = (...nos) => ({
  nodesBetween: (de, ate, f) => {
    for (const n of nos) if (n.pos >= de && n.pos < ate) f(n.node, n.pos);
  },
});
const texto = { isInline: true, isText: true };
const imagem = { isInline: true, isText: false };
const quebra = { isInline: true, isText: false };
const paragrafo = { isBlock: true };

{
  // "Awdaw" nas posições 1..5 e a imagem em 6 (o caso do print: a palavra termina onde a imagem começa)
  const doc = docFake({ pos: 1, node: texto }, { pos: 6, node: imagem });
  ok("palavra só de texto: a sugestão vale", atravessaNaoTexto(doc, 1, 6) === false);
  ok(
    "imagem NA BORDA (o fim da palavra é o começo dela): a palavra continua valendo",
    atravessaNaoTexto(doc, 1, 6) === false,
    "o clique na imagem é barrado pelo alvo, não pela faixa"
  );
  ok("imagem NO MEIO da faixa: o problema fica de fora", atravessaNaoTexto(doc, 1, 7) === true);
  ok("quebra de linha no meio: o problema fica de fora", atravessaNaoTexto(docFake({ pos: 3, node: quebra }), 1, 6) === true);
  ok("um parágrafo dentro da faixa não descarta (só o que não é texto inline)", atravessaNaoTexto(docFake({ pos: 2, node: paragrafo }), 1, 6) === false);
}

// ---------------------------------------------------------------- 3) a fiação no corretor

console.log("\ncorretor do Word: a fiação no plugin");

const spell = ler("src/word/spell.ts");
ok(
  "o popup só abre pela marca do texto (e ancora nela)",
  /const marca = marcaSobClique\(event\.target as HTMLElement\)/.test(spell) &&
    /if \(!marca\) return false;/.test(spell) &&
    /showPopup\(view, f, marca\.getBoundingClientRect\(\)/.test(spell),
  "antes o alvo caía no parágrafo (popup no canto da página) e o clique na imagem abria a sugestão"
);
ok(
  "a varredura descarta o problema que atravessa imagem/quebra",
  /if \(atravessaNaoTexto\(doc, a\.pos, to\)\) continue;/.test(spell)
);

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
