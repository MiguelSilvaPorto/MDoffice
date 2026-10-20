// Trava do motor de imagem FLUTUANTE do Word:
//  - a imagem fica sozinha no parágrafo (o parágrafo é o flutuante);
//  - cada modo de quebra produz o estilo certo (float, contorno, absoluto);
//  - o texto acompanha o desenho (shape-outside com o PNG).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-word-float-"));
await build({ entryPoints: [join(raiz, "src/word/imagemFlutuante.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "flut.mjs"), logLevel: "error" });
const { dadosDaImagem, estiloDoFlutuante, ehFlutuante, ehContorno, deixarImagemSozinha, classeDoContorno } = await import(
  pathToFileURL(join(tmp, "flut.mjs")).href
);
await build({ entryPoints: [join(raiz, "src/word/schema.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "schema.mjs"), logLevel: "error" });
const { schema } = await import(pathToFileURL(join(tmp, "schema.mjs")).href);
const { EditorState } = await import("prosemirror-state");

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
  if (!cond) falhas++;
};

// ---------- os estilos de cada modo ----------
const img = (attrs) => schema.nodes.image.create({ src: "data:image/png;base64,AAAA", width: 300, height: 200, ...attrs });
const estilo = (wrap, extra = {}) => estiloDoFlutuante(dadosDaImagem({ wrap, ...extra }), 600, 300);

const alinhado = estilo("alinhado");
ok("alinhado não flutua", !alinhado.paragrafo && !alinhado.imagem, alinhado.paragrafo);

const quadrado = estilo("quadrado");
ok("quadrado flutua à esquerda", quadrado.paragrafo.includes("float:left"), quadrado.paragrafo);
ok("quadrado tem a largura da imagem", quadrado.paragrafo.includes("width:300px"), quadrado.paragrafo);
ok("quadrado deixa a folga para o texto", quadrado.paragrafo.includes("margin-right:8px"), quadrado.paragrafo);

const quadradoDireita = estilo("quadrado", { hAlign: "right" });
ok("quadrado à direita", quadradoDireita.paragrafo.includes("float:right"), quadradoDireita.paragrafo);

const contorno = estilo("contorno");
ok("contorno não usa margem para a folga (é o shape-margin)", contorno.paragrafo.includes("margin-right:0"), contorno.paragrafo);
ok("contorno é reconhecido como contorno", ehContorno(dadosDaImagem({ wrap: "contorno" })));
ok("contorno tem classe de shape", classeDoContorno("data:image/png;base64,AAAA").startsWith("wd-contorno-"));

const topoBase = estilo("topo-base");
ok("topo e base é um bloco no fluxo (o texto passa por cima e por baixo)", !topoBase.paragrafo.includes("float:") && topoBase.paragrafo.includes("width:300px"), topoBase.paragrafo);

const atras = estilo("atras");
ok("atrás tira a imagem do fluxo", atras.imagem.includes("position:absolute") && atras.imagem.includes("z-index:-1"), atras.imagem);
ok("atrás zera a âncora", atras.paragrafo.includes("height:0"), atras.paragrafo);

const frente = estilo("frente");
ok("à frente vem por cima do texto", frente.imagem.includes("z-index:2"), frente.imagem);

const centro = estilo("quadrado", { hAlign: "center" });
ok("centralizado usa a sobra da linha", centro.paragrafo.includes("margin-left:calc(150px"), centro.paragrafo);

// o deslocamento do arrasto entra por VARIÁVEL: o style do flutuante é a regra que manda
ok("a margem do arrasto é uma variável", quadrado.paragrafo.includes("var(--wd-fx"), quadrado.paragrafo);
ok("a altura do arrasto é uma variável", quadrado.paragrafo.includes("var(--wd-fy"), quadrado.paragrafo);
ok("a distância do texto no contorno é o shape-margin", contorno.paragrafo.includes("shape-margin:8px"), contorno.paragrafo);

// ---------- a imagem sozinha no parágrafo ----------
const doc = schema.node("doc", null, [
  schema.node("paragraph", null, [schema.text("a"), img({}), schema.text("b")]),
]);
const st = EditorState.create({ schema, doc });
let pos = -1;
st.doc.descendants((n, p) => {
  if (n.type.name === "image") pos = p;
});
const r = deixarImagemSozinha(st, pos);
const novos = r.tr.doc.childCount;
ok("o parágrafo foi dividido em três", novos === 3, String(novos));
const meio = r.tr.doc.child(1);
ok("a imagem ficou sozinha no parágrafo do meio", meio.childCount === 1 && meio.firstChild.type.name === "image", String(meio.childCount));
ok("o texto antes foi preservado", r.tr.doc.child(0).textContent === "a", r.tr.doc.child(0).textContent);
ok("o texto depois foi preservado", r.tr.doc.child(2).textContent === "b", r.tr.doc.child(2).textContent);
const achou = (() => {
  let p = -1;
  r.tr.doc.descendants((n, q) => {
    if (n.type.name === "image") p = q;
  });
  return p;
})();
ok("a posição devolvida aponta para a imagem", achou === r.pos, `${achou} vs ${r.pos}`);

// ---------- imagem já sozinha: nada muda ----------
const st2 = EditorState.create({ schema, doc: schema.node("doc", null, [schema.node("paragraph", null, [img({})])]) });
let pos2 = -1;
st2.doc.descendants((n, p) => {
  if (n.type.name === "image") pos2 = p;
});
const r2 = deixarImagemSozinha(st2, pos2);
ok("imagem sozinha não mexe no documento", r2.tr.doc.eq(st2.doc) && r2.pos === pos2);

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
