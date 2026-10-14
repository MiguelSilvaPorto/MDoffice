// Testa o diff da troca que colore o popup do aviso: o que sai (vermelho) e o que entra (verde),
// com o comum ficando neutro. Uso: node scripts/testar-diff-troca.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "diff-troca-"));
await build({ entryPoints: [join(raiz, "src/md/diffTroca.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "diff.mjs"), logLevel: "error" });
const D = await import(pathToFileURL(join(tmp, "diff.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const partes = (velho, fix) => D.partesDaTroca(velho, fix).map((p) => `${p.tipo}:${p.texto}`).join(" | ");
const igual = (nome, velho, fix, esperado) => {
  const r = partes(velho, fix);
  ok(nome, r === esperado, r === esperado ? "" : `→ ${JSON.stringify(r)}`);
};

// ---- exibição (partesDaTroca)
igual("ponto final: só o ponto entra verde", "pronto", "pronto.", "texto:pronto | add:.");
igual("palavra trocada: antiga vermelha, nova verde", "responsavo", "responsável", "rem:responsavo | add:responsável");
igual("inserção pura", "", "texto", "add:texto");
igual("remoção pura", "texto", "", "rem:texto");
igual("sem mudança: tudo neutro", "igual", "igual", "texto:igual");
igual("vírgula antes: vírgula entra, palavra fica", "mas", ", mas", "add:,  | texto:mas");
igual("expressão intercalada: trecho antigo e novo", " no entanto", ", no entanto,", "rem: no entanto | add:, no entanto,");
igual("pontuação duplicada: o ponto extra sai riscado", "..", ".", "texto:. | rem:.");
igual("maiúscula no começo: trecho antigo e novo", "o projeto", "O projeto", "rem:o projeto | add:O projeto");

// ---- diff mínimo (diffDaTroca)
{
  const r = D.diffDaTroca("o gato", "o rato");
  ok("diff mínimo: comum, saída, entrada e fim", r.comumIni === "o " && r.rem === "g" && r.add === "r" && r.comumFim === "ato", JSON.stringify(r));
}
{
  const r = D.diffDaTroca("pronto", "pronto.");
  ok("diff mínimo: nada sai, ponto entra", r.comumIni === "pronto" && r.rem === "" && r.add === "." && r.comumFim === "");
}
{
  const r = D.diffDaTroca("", "texto");
  ok("diff mínimo com um lado vazio", r.comumIni === "" && r.rem === "" && r.add === "texto" && r.comumFim === "");
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
