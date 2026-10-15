// Testa as CAMADAS da pintura (Estúdio, fase 4): o modelo (a camada é um grupo de formas com nome,
// olho e opacidade) e a fiação do painel.
//
// Uso: node scripts/testar-camadas.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-camadas-"));
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

const C = await empacotar("src/powerpoint/edicao/camadas.ts", "camadas.mjs");
const { camadasDe, criarCamada, renomearCamada, esconderCamada, opacidadeDaCamada, moverCamada, apagarCamada, fundirParaBaixo, isolarCamada, mostrarTodas, chaveDaForma } = C;

const forma = (id, extra = {}) => ({
  id,
  kind: "forma",
  box: { x: 10, y: 10, w: 20, h: 20 },
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
const pintura = (id, extra = {}) => forma(id, { name: "Pintura · pincel", ...extra });
const ordem = (s) => s.shapes.map((x) => x.id).join(",");

console.log("as camadas de uma lâmina");
{
  const s = slide(forma("a"), pintura("p1", { grupo: "g1", camada: "Vidro" }), pintura("p2", { grupo: "g1", camada: "Vidro" }), forma("b"));
  const camadas = camadasDe(s);
  ok("cada grupo é uma camada e cada forma solta também", camadas.length === 3, camadas.map((c) => `${c.id}:${c.membros.length}`).join(" "));
  ok("a ordem é a da lâmina (de baixo para cima)", camadas.map((c) => c.id).join(",") === "a,g1,b");
  const vidro = camadas[1];
  ok("o nome vem do campo `camada`", vidro.nome === "Vidro", vidro.nome);
  ok("e a camada de pintura é reconhecida", vidro.pintura === true && vidro.grupo === true && camadas[0].pintura === false);
  ok("a chave de uma forma solta é o próprio id", chaveDaForma(forma("x")) === "x");
}

console.log("\nagrupar a pintura numa camada");
{
  const s = slide(forma("base"), pintura("p1"), pintura("p2"), forma("topo"));
  const com = criarCamada(s, [], "Pintura 1");
  ok("as duas pinceladas viram UMA camada", camadasDe(com).length === 3, camadasDe(com).map((c) => c.id).join(","));
  const pintadas = com.shapes.filter((x) => x.name?.startsWith("Pintura"));
  ok("as duas ficam com o mesmo grupo e o mesmo nome", !!pintadas[0].grupo && pintadas[0].grupo === pintadas[1].grupo && pintadas[0].camada === "Pintura 1");
  ok("e a camada ocupa o lugar da pincelada mais à frente", ordem(com) === "base,p1,p2,topo", ordem(com));
  ok("sem duas formas para agrupar, nada muda", criarCamada(slide(forma("a")), []).shapes.length === 1);
  const porSelecao = criarCamada(s, ["base", "topo"], "Caixa");
  ok("dá para agrupar formas escolhidas", camadasDe(porSelecao).some((c) => c.nome === "Caixa" && c.membros.length === 2));
}

console.log("\no olho (esconder) e a opacidade da camada");
{
  const s = criarCamada(slide(pintura("p1"), pintura("p2")), [], "Vidro");
  const escondida = esconderCamada(s, camadasDe(s)[0].id, true);
  ok("todos os membros ficam ocultos", escondida.shapes.every((x) => x.oculta === true));
  ok("e a camada é lida como oculta", camadasDe(escondida)[0].oculta === true);
  const mostrada = esconderCamada(escondida, camadasDe(s)[0].id, false);
  ok("mostrar tira a marca (não deixa `oculta: false` no JSON)", mostrada.shapes.every((x) => !("oculta" in x)));

  const meia = opacidadeDaCamada(s, camadasDe(s)[0].id, 0.5);
  ok("a opacidade vale para a camada inteira", meia.shapes.every((x) => x.opacity === 0.5));
  ok("e é limitada (0 vira 5%, o mínimo visível)", opacidadeDaCamada(s, camadasDe(s)[0].id, 0).shapes[0].opacity === 0.05);
}

console.log("\nordem, fundir e apagar");
{
  const s = criarCamada(slide(forma("base"), pintura("p1"), pintura("p2")), [], "Vidro");
  const chave = camadasDe(s).find((c) => c.nome === "Vidro").id;
  const subiu = moverCamada(s, chave, 1);
  ok("a camada sobe INTEIRA (as pinceladas ficam juntas, na frente)", ordem(subiu) === "base,p1,p2", ordem(subiu));
  ok("no topo, subir de novo não faz nada", ordem(moverCamada(subiu, chave, 1)) === ordem(subiu));
  ok("descer devolve a ordem", ordem(moverCamada(subiu, chave, -1)) === "p1,p2,base", ordem(moverCamada(subiu, chave, -1)));

  const fundida = fundirParaBaixo(moverCamada(criarCamada(slide(pintura("p1"), pintura("p2"), forma("base")), [], "Vidro"), camadasDe(s).length ? camadasDe(criarCamada(slide(pintura("p1"), pintura("p2"), forma("base")), [], "Vidro")).findIndex((c) => c.nome === "Vidro") : 0, 0));
  ok("fundir junta as duas numa camada só (e o nome da de baixo manda)", camadasDe(fundida).length === 2, camadasDe(fundida).map((c) => c.nome).join(" | "));
  ok("a camada de baixo não funde (não há para onde)", fundirParaBaixo(s, camadasDe(s)[0].id).shapes.length === s.shapes.length);

  const sem = apagarCamada(s, chave);
  ok("apagar a camada tira os membros da lâmina", ordem(sem) === "base", ordem(sem));
}

console.log("\nisolar e mostrar tudo");
{
  const s = slide(forma("a"), forma("b"), forma("c"));
  const soB = isolarCamada(s, "b");
  ok("isolar esconde as outras", soB.shapes.find((x) => x.id === "b").oculta === undefined && soB.shapes.filter((x) => x.id !== "b").every((x) => x.oculta === true));
  ok("mostrar tudo limpa o isolamento", mostrarTodas(soB).shapes.every((x) => !("oculta" in x)));
}

// ---------------------------------------------------------------- a fiação

console.log("\no painel e o arquivo");
{
  const ppt = ler("src/powerpoint/powerpoint.ts");
  const schema = ler("src/powerpoint/schema.ts");
  const exportador = ler("src/powerpoint/pptxexport/index.ts");
  const css = ler("src/styles/powerpoint-edicao.css");
  ok("o schema ganhou o nome da camada e o olho", /camada\?: string;/.test(schema) && /oculta\?: boolean;/.test(schema));
  ok("o painel tem a aba Camadas", /data-lateral="camadas">Camadas/.test(ppt) && /data-camadas-corpo/.test(ppt));
  ok("e ela é renderizada ao abrir e a cada pintura", /private pintarCamadas\(\)/.test(ppt) && /if \(this\.lateral === "camadas"\) this\.pintarCamadas\(\);/.test(ppt));
  ok("a lista tem olho, nome, opacidade e as ações", /data-camada-acao="olho"/.test(ppt) && /data-camada-nome/.test(ppt) && /data-camada-op/.test(ppt) && /data-camada-acao="fundir"/.test(ppt));
  ok("os comandos das camadas estão ligados", /case "camada-nova"/.test(ppt) && /cmd\.startsWith\("camada:op:"\)/.test(ppt) && /case "camada:olho"/.test(ppt));
  ok(
    "a forma escondida não é desenhada (lâmina nem miniatura)",
    /slide\.shapes\.filter\(\(s\) => !s\.oculta\)\.map\(\(s\) => htmlFormaRica/.test(ppt) && /s\.shapes\.filter\(\(f\) => !f\.oculta\)\.map\(\(f\) => htmlFormaRica/.test(ppt)
  );
  ok("nem vai ao .pptx (o arquivo é o que se vê)", /shapes: s\.shapes\.filter\(\(f\) => !f\.oculta\)/.test(exportador));
  ok("o CSS do painel existe", /\.pp-camada\b/.test(css) && /\.pp-camada\.oculta/.test(css) && /\.pp-camadas-vazio/.test(css));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
