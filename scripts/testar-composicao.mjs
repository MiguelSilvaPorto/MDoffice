// Testa a fornada da Composição (src/powerpoint/edicao/sugestoes.ts): a escolha determinística de
// arrumação × visual, a variedade dentro da fornada (sem repetir vizinhos), o encolhimento quando a
// lâmina tem poucas arrumações e os designs criados na hora em toda fornada.
// Uso: node scripts/testar-composicao.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-composicao-"));
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/sugestoes.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "sugestoes.mjs"), logLevel: "error" });
const S = await import(pathToFileURL(join(tmp, "sugestoes.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

/** Catálogo de mentira: só o que a fornada olha (id, nome, tema, fundo, fonte). */
const modelo = (id, nome) => ({ id, nome, descricao: `${nome} (teste)`, tema: "claro", bg: "", fonte: "Inter" });
const modelos = [modelo("a", "Alfa"), modelo("b", "Beta"), modelo("c", "Gama")];
const chave = (s) => `${s.arranjo}|${s.variante}|${s.modelo.id}|${s.tratamento}`;
const arrumacao = (s) => `${s.arranjo}|${s.variante}`;
const visual = (s) => `${s.modelo.id}|${s.tratamento}`;

// 1) determinismo: o mesmo lote devolve sempre a mesma fornada
{
  const a = S.sugestoesDe({ unidades: 4, modelos, lote: 3 }).map(chave).join(" · ");
  const b = S.sugestoesDe({ unidades: 4, modelos, lote: 3 }).map(chave).join(" · ");
  ok("o mesmo lote devolve a mesma fornada (a prévia é o que o clique aplica)", a === b && a.length > 0, a.slice(0, 90));
}

// 2) o lote seguinte muda a fornada (a arrumação anda de um em um)
{
  const lotes = [0, 1, 2, 3].map((l) => S.sugestoesDe({ unidades: 4, modelos, lote: l }).map(arrumacao).join(" · "));
  ok("cada lote começa numa arrumação diferente", new Set(lotes).size === lotes.length, lotes.join(" || "));
}

// 3) dentro da fornada não repete arrumação nem visual (o olho não vê dois cartões iguais)
{
  for (const lote of [0, 1, 5, 9]) {
    const lista = S.sugestoesDe({ unidades: 4, modelos, lote });
    const arrs = lista.map(arrumacao);
    const vis = lista.filter((s) => !s.modelo.gerado).map(visual);
    ok(`lote ${lote}: arrumações e visuais sem repetição`, new Set(arrs).size === arrs.length && new Set(vis).size === vis.length, `${arrs.length} cartões · ${new Set(vis).size} visuais`);
  }
}

// 4) toda fornada tem designs criados na hora (o cartão diz "Novo") e eles mudam a cada lote
{
  const criados = [0, 1, 2, 3, 4].map((lote) => S.sugestoesDe({ unidades: 4, modelos, lote }).filter((s) => s.modelo.gerado).map((s) => s.modelo.id));
  ok("toda fornada traz designs criados na hora", criados.every((c) => c.length >= 1), JSON.stringify(criados));
  ok("os criados não se repetem entre fornadas seguidas", new Set(criados.flat()).size === criados.flat().length, JSON.stringify(criados));
}

// 5) a fornada encolhe quando a lâmina tem poucas arrumações (em vez de repetir)
{
  const poucas = S.sugestoesDe({ unidades: 2, modelos, lote: 0 });
  ok("lâmina com 2 unidades: a fornada encolhe (grade 2×1, lista, destaque, faixa)", poucas.length === 4, `${poucas.length} cartões: ${poucas.map(arrumacao).join(" ")}`);
  ok("lâmina com 1 unidade: sobra lista, destaque e faixa", S.sugestoesDe({ unidades: 1, modelos, lote: 0 }).length === 3);
  ok("lâmina vazia (não arrumável) sai só de visual", S.sugestoesDe({ unidades: 0, arrumavel: false, modelos, lote: 0 }).every((s) => s.arranjo === null));
}

// 5b) lâmina que não é arrumável (título e subtítulo soltos): só visuais, sem prometer fórmula
{
  const visuais = S.sugestoesDe({ unidades: 2, arrumavel: false, modelos, lote: 0 });
  ok("não arrumável: todos os cartões são só visual (arranjo null)", visuais.length >= 3 && visuais.every((s) => s.arranjo === null), `${visuais.length} cartões`);
  ok("não arrumável: ainda mistura catálogo e criados na hora", visuais.some((s) => !s.modelo.gerado) && visuais.some((s) => s.modelo.gerado));
  ok("não arrumável: o lote seguinte muda os visuais", visuais.map(chave).join() !== S.sugestoesDe({ unidades: 2, arrumavel: false, modelos, lote: 1 }).map(chave).join());
}

// 5c) a condição de "dá para arrumar" é a mesma do aplicar (a lâmina de título fica como está)
{
  ok("a lâmina vazia não é arrumável, a com três unidades é", S.arrumacoesDe(0).length === 0 && S.arrumacoesDe(3).length >= 3);
}

// 6) a grade abre em variantes conforme as unidades (3 unidades → 2 e 3 colunas; 8 → 2, 3 e 4)
{
  const grade = (u) => S.arrumacoesDe(u).filter((a) => a.arranjo === "grade").map((a) => a.variante);
  ok("a grade acompanha as unidades (3 → 2×2 e 3×1; 8 → 2×4, 3×3 e 4×2)", JSON.stringify(grade(3)) === "[2,3]" && JSON.stringify(grade(8)) === "[2,3,4]", `${grade(3)} · ${grade(8)}`);
}

// 7) sem catálogo a fornada é toda criada na hora (não quebra)
{
  const semCatalogo = S.sugestoesDe({ unidades: 4, modelos: [], lote: 1 });
  ok("sem catálogo, a fornada sai toda criada na hora", semCatalogo.length > 0 && semCatalogo.every((s) => s.modelo.gerado), `${semCatalogo.length} cartões`);
}

// 8) o passo do catálogo espalha os visuais (não sai tudo vizinho)
{
  const lista = S.sugestoesDe({ unidades: 8, modelos, lote: 0 }).filter((s) => !s.modelo.gerado);
  const ids = lista.map((s) => s.modelo.id);
  ok("com 3 modelos, os visuais do catálogo não repetem na fornada", new Set(lista.map(visual)).size === lista.length, ids.join(" "));
}

// 9) os acabamentos da Composição
{
  ok("os acabamentos são cores novas, cartão, sombra, cantos e contorno", JSON.stringify(S.ACABAMENTOS) === '["recolorir","cartao","sombra","cantos","contorno"]', JSON.stringify(S.ACABAMENTOS));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
