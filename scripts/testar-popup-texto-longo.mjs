// Trava do popup de sugestao: a palavra apontada pelo corretor pode ser GIGANTE e sem
// espaco nenhum - sem uma quebra, ela atravessa a borda do popup (o texto "vaza" para
// fora da caixa). O popup tem que ter largura E altura limitadas e quebrar a palavra.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
  if (!cond) falhas++;
};

/** O bloco de uma regra do CSS (o que esta entre as chaves). */
const bloco = (css, seletor) => {
  const i = css.indexOf(seletor);
  if (i < 0) return "";
  const abre = css.indexOf("{", i);
  if (abre < 0) return "";
  const fecha = css.indexOf("}", abre);
  return css.slice(abre + 1, fecha < 0 ? css.length : fecha);
};
const tem = (css, seletor, ...props) => {
  const b = bloco(css, seletor);
  if (!b) return false;
  return props.every((p) => b.includes(p));
};

const word = readFileSync(join(raiz, "src/styles/word.css"), "utf8");
const slides = readFileSync(join(raiz, "src/styles/slides.css"), "utf8");

// ---------- o popup do Word ----------
ok("o popup do Word tem largura limitada", tem(word, ".wd-pop {", "max-width:"), "");
ok("o popup do Word tem altura limitada", tem(word, ".wd-pop {", "max-height:"), "");
ok("o popup do Word rola por dentro", tem(word, ".wd-pop {", "overflow-y: auto"), "");
ok("a mensagem do Word quebra a palavra gigante", tem(word, ".wd-pop-msg {", "overflow-wrap: anywhere"), "");
ok("a sugestao do Word quebra a palavra gigante", tem(word, ".wd-pop-item {", "overflow-wrap: anywhere"), "");

// ---------- o popup do Markdown ----------
ok("o popup do Markdown tem largura limitada", tem(slides, ".cm-issue-popup {", "max-width:"), "");
ok("o popup do Markdown tem altura limitada", tem(slides, ".cm-issue-popup {", "max-height:"), "");
ok("o popup do Markdown rola por dentro", tem(slides, ".cm-issue-popup {", "overflow-y: auto"), "");
ok("a mensagem do Markdown quebra a palavra gigante", tem(slides, ".cm-issue-title {", "overflow-wrap: anywhere"), "");

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
