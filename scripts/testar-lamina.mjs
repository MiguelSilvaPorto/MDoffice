// Testa as LÂMINAS do PowerPoint: a troca da lâmina no editor, a fusão do modelo e —
// o que estava quebrado — o botão de esconder: esconder a lâmina e depois mostrar de novo.
//
// O defeito: o modelo da lâmina é uma FUSÃO (`replaceSlide` junta a lâmina nova com a antiga),
// então apagar uma chave do patch não tirava o valor antigo: o `show: false` sobrevivia e o
// botão ficava em "Mostrar" sem efeito (relato com print). O mesmo valia para o nome da
// lâmina: renomear para o vazio deixava o nome antigo.
//
// A correção: no patch, "apagar" é `undefined` — e `replaceSlide` tira a chave de vez.
//
// Uso: node scripts/testar-lamina.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-lamina-"));
await build({ entryPoints: [join(raiz, "src/powerpoint/slides.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "slides.mjs"), logLevel: "error" });
const { replaceSlide, duplicateSlide } = await import(pathToFileURL(join(tmp, "slides.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

const lamina = (extra = {}) => ({ md: "", layout: "conteudo", notes: "", shapes: [], ...extra });
const deck = { setup: { aspect: "16:9", theme: "claro" }, slides: [lamina(), lamina({ nome: "Duas" })] };

// ---------------------------------------------------------------------------
// esconder e mostrar a lâmina (o botão da fita)
// ---------------------------------------------------------------------------
const escondido = replaceSlide(deck, 0, { ...deck.slides[0], show: false });
ok("esconder a lâmina marca `show: false`", escondido.slides[0].show === false);
ok("esconder a lâmina não mexe nas outras", escondido.slides[1].show === undefined);

// o botão "Mostrar": a lâmina nova tem `show: undefined` (é assim que se "apaga" a chave)
const mostrado = replaceSlide(escondido, 0, { ...escondido.slides[0], show: undefined });
ok("mostrar de novo tira o `show` da lâmina", mostrado.slides[0].show === undefined && !("show" in mostrado.slides[0]));
ok("mostrar de novo devolve a lâmina ao estado inicial", JSON.stringify(mostrado.slides[0]) === JSON.stringify(deck.slides[0]), JSON.stringify(mostrado.slides[0]));

// e o botão continua alternando (o que a fita faz a cada clique)
let atual = deck;
for (let i = 0; i < 4; i++) {
  const s = atual.slides[0];
  atual = replaceSlide(atual, 0, { ...s, show: s.show === false ? undefined : false });
}
ok("o botão alterna a cada clique (parou de novo em Mostrar)", atual.slides[0].show === undefined, JSON.stringify(atual.slides[0].show));

// ---------------------------------------------------------------------------
// renomear para o vazio
// ---------------------------------------------------------------------------
const renomeada = replaceSlide(deck, 1, { ...deck.slides[1], nome: undefined });
ok("renomear para o vazio tira o nome", renomeada.slides[1].nome === undefined && !("nome" in renomeada.slides[1]));
const comNome = replaceSlide(deck, 1, { ...deck.slides[1], nome: "Novo" });
ok("renomear põe o nome novo", comNome.slides[1].nome === "Novo");

// ---------------------------------------------------------------------------
// o resto da lâmina sobrevive à fusão
// ---------------------------------------------------------------------------
const comNotas = replaceSlide(deck, 0, { ...deck.slides[0], notes: "anotação", show: false });
ok("a fusão guarda o resto da lâmina", comNotas.slides[0].notes === "anotação" && comNotas.slides[0].layout === "conteudo");

// duplicar uma lâmina escondida: a cópia continua escondida
const dup = duplicateSlide(comNotas, 0);
ok("duplicar uma lâmina escondida mantém o escondido", dup.deck.slides[dup.index].show === false);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
