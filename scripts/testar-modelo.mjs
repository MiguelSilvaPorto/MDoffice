// Testa o MODELO de box e as cópias vinculadas (Estúdio, fase 5): o caso do usuário é o cartão
// repetido com nomes diferentes — o conteúdo segue o modelo, o nome se desvincula.
//
// Uso: node scripts/testar-modelo.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-modelo-"));
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

const M = await empacotar("src/powerpoint/edicao/modelo.ts", "modelo.mjs");
const { unidadesDaBox, criarModelo, desfazerModelo, novaCopia, desvincular, revincular, sincronizarCopias, cardDoModelo, cardDaCopia, ehParteDeCopia, temModelo, podeDesvincular, podeRevincular } = M;

const D = { w: 960, h: 540 };
const forma = (id, box, extra = {}) => ({
  id,
  kind: "forma",
  box,
  text: "",
  fontFamily: "S",
  fontSize: 18,
  color: "0",
  bold: false,
  italic: false,
  align: "esquerda",
  fill: "",
  src: "",
  rot: 0,
  ...extra,
});
const slide = (...shapes) => ({ md: "", layout: "conteudo", notes: "", shapes });
/** O cartão de 20..60% x 20..60% com o logo e o nome dentro (o caso do usuário). */
const cartao = (id, x = 20, y = 20, nome = "Diego Souza") => [
  forma(id, { x, y, w: 40, h: 40 }, { cantos: [10, 10, 10, 10], fillX: { kind: "solid", color: "ffffff", alpha: 1 } }),
  forma(id + "-logo", { x: x + 12, y: y + 4, w: 16, h: 16 }, { geom: "ellipse" }),
  forma(id + "-nome", { x: x + 8, y: y + 26, w: 24, h: 8 }, { text: nome }),
];
const porId = (s) => new Map(s.shapes.map((x) => [x.id, x]));

console.log("a unidade da box (o cartão e o que está dentro)");
{
  const s = slide(...cartao("c1"), forma("fora", { x: 70, y: 70, w: 10, h: 10 }));
  const unidade = unidadesDaBox(s, "c1", D);
  ok("o cartão e os dois elementos de dentro", unidade.join(",") === "c1,c1-logo,c1-nome", unidade.join(","));
  ok("o que está fora não entra", !unidade.includes("fora"));
}

console.log("\ncriar o modelo e a cópia vinculada");
{
  const base = slide(...cartao("c1"));
  const comModelo = criarModelo(base, "c1", D);
  ok("a unidade inteira fica marcada como modelo", comModelo.shapes.every((s) => s.ehModelo === true));
  ok("o cartão é a raiz do modelo", cardDoModelo(comModelo)?.id === "c1");

  const { slide: comCopia, card } = novaCopia(comModelo, "c1", D, 45, 0);
  ok("a cópia tem o cartão e as duas partes", card === "c1-c1" || card.startsWith("c1"), card);
  const depois = porId(comCopia);
  const cartao2 = depois.get(card);
  ok("o cartão da cópia aponta para o cartão do modelo", cartao2.modelo === "c1" && !cartao2.ehModelo);
  ok("as partes apontam para as partes do modelo", [...depois.values()].filter((s) => s.modelo === "c1-logo" || s.modelo === "c1-nome").length === 2);
  ok("a cópia entra logo depois da origem (na frente dela)", comCopia.shapes.slice(0, 3).map((s) => s.id).join(",") === "c1,c1-logo,c1-nome");
  ok("e a cópia nasce sem grupo de camada (herdar moveria as duas)", [...depois.values()].every((s) => !s.modelo || s.grupo === undefined));
  ok("a lâmina é reconhecida como 'tem modelo'", temModelo(comCopia) === true);
}

console.log("\nmudar o MODELO muda a cópia (o nome se desvincula)");
{
  const comModelo = criarModelo(slide(...cartao("c1")), "c1", D);
  const { slide: comCopia, card } = novaCopia(comModelo, "c1", D, 45, 0);
  const copiaIds = comCopia.shapes.filter((s) => ehParteDeCopia(s)).map((s) => s.id);

  // o modelo muda a COR e o TEXTO
  const alterado = {
    ...comCopia,
    shapes: comCopia.shapes.map((s) => (s.id === "c1" ? { ...s, fillX: { kind: "solid", color: "4f46e5", alpha: 1 } } : s.id === "c1-nome" ? { ...s, text: "Maria Silva" } : s)),
  };
  const sync = sincronizarCopias(alterado, D);
  const depois = porId(sync);
  ok("o preenchimento do cartão do modelo chega à cópia", depois.get(card).fillX.color === "4f46e5");
  ok("e o texto também", depois.get(copiaIds.find((id) => id.includes("nome")) ?? "").text === "Maria Silva");

  // a cópia pode ter sido MOVIDA: o arranjo segue, o lugar da cópia não muda
  const movida = { ...sync, shapes: sync.shapes.map((s) => (s.id === card ? { ...s, box: { ...s.box, x: 60, y: 5 } } : s)) };
  const sync2 = sincronizarCopias(movida, D);
  const cartao2 = porId(sync2).get(card);
  ok("mover a cópia não é desfeito pela sincronização", cartao2.box.x === 60 && cartao2.box.y === 5);
  const logo2 = porId(sync2).get(copiaIds.find((id) => id.includes("logo")) ?? "");
  ok("e as partes seguem o ARRANJO do modelo dentro da cópia", Math.abs(logo2.box.x - (60 + 12)) < 0.01 && Math.abs(logo2.box.y - (5 + 4)) < 0.01, JSON.stringify(logo2.box));
}

console.log("\ndesvincular e re-vincular (por PARTE)");
{
  const comModelo = criarModelo(slide(...cartao("c1")), "c1", D);
  const { slide: comCopia, card } = novaCopia(comModelo, "c1", D, 45, 0);
  const nomeId = comCopia.shapes.filter((s) => ehParteDeCopia(s) && s.modelo === "c1-nome").map((s) => s.id)[0];

  ok("a cópia tem partes vinculadas (dá para desvincular)", podeDesvincular(comCopia, [nomeId]) === true);
  const solta = desvincular(comCopia, [nomeId]);
  ok("a parte desvinculada fica marcada", porId(solta).get(nomeId).desvinculado === true);
  ok("e dá para re-vincular", podeRevincular(solta, [nomeId]) === true);

  // o modelo muda o nome: a parte SOLTA não segue, a vinculada segue
  const alterado = { ...solta, shapes: solta.shapes.map((s) => (s.id === "c1-nome" ? { ...s, text: "Maria" } : s)) };
  const comNomeProprio = { ...alterado, shapes: alterado.shapes.map((s) => (s.id === nomeId ? { ...s, text: "Diego Souza" } : s)) };
  const sync = sincronizarCopias(comNomeProprio, D);
  ok("a parte desvinculada mantém o que era dela", porId(sync).get(nomeId).text === "Diego Souza");

  const volta = revincular(sync, [nomeId], D);
  ok("re-vincular traz o que o modelo tem agora", porId(volta).get(nomeId).text === "Maria");
  ok("e limpa a marca de desvinculado", !("desvinculado" in porId(volta).get(nomeId)));

  const cartaoVinculado = comCopia.shapes.filter((s) => ehParteDeCopia(s) && s.modelo === "c1")[0].id;
  ok("o cartão da cópia também é uma parte (dá para desvincular o estilo dele)", podeDesvincular(comCopia, [cartaoVinculado]) === true);
}

console.log("\no que não muda nada não é redesenhado");
{
  const comModelo = criarModelo(slide(...cartao("c1")), "c1", D);
  const { slide: comCopia } = novaCopia(comModelo, "c1", D, 45, 0);
  const igual = sincronizarCopias(comCopia, D);
  ok("sincronizar de novo devolve O MESMO slide (sem redesenho à toa)", igual === comCopia);
}

console.log("\ndesfazer o modelo solta as cópias");
{
  const comModelo = criarModelo(slide(...cartao("c1")), "c1", D);
  const { slide: comCopia } = novaCopia(comModelo, "c1", D, 45, 0);
  const sem = desfazerModelo(comCopia, "c1", D);
  ok("o modelo sai", sem.shapes.every((s) => !s.ehModelo));
  ok("e as cópias perdem o vínculo (não apontam para o que não existe)", sem.shapes.every((s) => !s.modelo && !s.desvinculado));
  ok("a lâmina deixa de ter modelo", temModelo(sem) === false);
}

// ---------------------------------------------------------------- a fiação

console.log("\no grupo Modelo e o gancho na edição");
{
  const fita = ler("src/powerpoint/ui/fita.ts");
  const ppt = ler("src/powerpoint/powerpoint.ts");
  const schema = ler("src/powerpoint/schema.ts");
  const css = ler("src/styles/powerpoint-edicao.css");
  ok("o schema ganhou os três campos do vínculo", /ehModelo\?: boolean;/.test(schema) && /modelo\?: string;/.test(schema) && /desvinculado\?: boolean;/.test(schema));
  ok(
    "o grupo Modelo tem criar, copiar, desvincular e re-vincular",
    /grupo\(\s*"Modelo",/.test(fita) && /grande\("modelo-criar"/.test(fita) && /grande\("modelo-copia"/.test(fita) && /pequeno\("modelo-desvincular"/.test(fita) && /pequeno\("modelo-revincular"/.test(fita)
  );
  ok("os botões seguem o estado", /dis\("modelo-criar", !tem\)/.test(fita) && /dis\("modelo-desvincular", !st\.desvinculavel\)/.test(fita) && /on\("modelo-criar", st\.modelo\)/.test(fita));
  ok("o host liga os quatro comandos", /case "modelo-criar"/.test(ppt) && /case "modelo-copia"/.test(ppt) && /case "modelo-desvincular"/.test(ppt) && /case "modelo-revincular"/.test(ppt));
  ok(
    "editar uma parte vinculada DESVINCULA sozinho (com o aviso)",
    /const soltas = this\.idsMudados\(antes, depois\)\.filter/.test(ppt) && /deixou de seguir o modelo/.test(ppt) && /ehParteDeCopia\(s\) && !s\.desvinculado/.test(ppt)
  );
  ok("e as cópias acompanham o modelo a cada edição", /if \(temModelo\(depois\)\) depois = sincronizarCopias\(depois, this\.dim\(\)\)/.test(ppt));
  ok("o estado leva modelo/desvinculável/re-vinculável", /modelo: boolean;/.test(ler("src/powerpoint/ui/estado.ts")) && /desvinculavel: podeDesvincular\(this\.atual\(\), this\.selecao\)/.test(ppt));
  ok("o ícone do grupo é desenhado no CSS (não é arte do Office)", /\.ppr-modelo-ic\s*\{/.test(css));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
